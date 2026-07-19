import pLimit from "p-limit";
import { resolveCompany, resolveCompanyTickersBulk } from "@/services/companyResolver";
import { AgentState } from "./state";
import { deterministicPreRouter } from "./router";
import {
  intentSchema,
  thesisSchema,
  portfolioPositionSchema,
  IntentResponse,
  ThesisResponse,
  PortfolioPositionResponse,
} from "@/lib/schemas/zod";
import { INTENT_PROMPT, SYNTHESIS_PROMPT, QA_PROMPT, COMPARISON_PROMPT } from "@/lib/prompts";
import { generateCompanyReportData } from "@/services/researchService";
import { CompanyReport, DashboardData, ActiveResearchContext } from "@/types";
import { invokeLlmWithRetry, llm } from "@/lib/utils/gemini";
import { logger } from "@/lib/utils/logger";
import { CONCURRENCY_LIMIT } from "@/lib/config";
import { generateDeterministicSummary } from "@/lib/utils/fallbacks";
import { FmpQuotaError } from "@/lib/api/fmp";

interface NodeConfig {
  configurable?: {
    sendEvent?: (event: string, data: unknown) => void;
    requestId?: string;
  };
}

const PORTFOLIO_PROMPT = `You are a portfolio position parser. Your task is to extract details about a user's stock holdings from their message.
Analyze the message and extract:
- Ticker: Resolve the company name to a standard stock ticker symbol (e.g. AAPL for Apple, TSLA for Tesla).
- Average price: The price per share they bought the stock at. Look for phrases like "at $180", "bought at 135", "average cost 420".
- Shares: The number of shares they own. Look for phrases like "20 shares", "own 10", etc.
- Is position query: Set to true if the user's query is about owning, buying, selling, holding, profit booking, averaging down, or exit advice for a stock position.

Examples:
"I own Apple at 180" -> { ticker: "AAPL", averagePrice: 180, shares: null, isPositionQuery: true }
"bought Nvidia at 135" -> { ticker: "NVDA", averagePrice: 135, shares: null, isPositionQuery: true }
"I own 20 shares of Microsoft" -> { ticker: "MSFT", averagePrice: null, shares: 20, isPositionQuery: true }
"Should I sell Google?" -> { ticker: "GOOGL", averagePrice: null, shares: null, isPositionQuery: true }
"Should I buy Apple?" -> { ticker: "AAPL", averagePrice: null, shares: null, isPositionQuery: false }

Return strict JSON matching the schema.`;

export async function intentRouterNode(
  state: typeof AgentState.State,
  config?: NodeConfig
): Promise<Partial<typeof AgentState.State>> {
  const startTime = Date.now();
  const requestId = config?.configurable?.requestId || "N/A";

  logger.info("[PIPELINE] Step 1: intentRouterNode started", {
    requestId,
    userInput: state.userInput,
    hasActiveContext: !!state.activeResearchContext,
    hasDashboard: state.hasDashboard,
    cachedTickers: Object.keys(state.activeResearchContext?.reports || {}),
  });

  const sendEvent = config?.configurable?.sendEvent;
  const userInput = state.userInput;
  let result: Partial<typeof AgentState.State> | undefined = undefined;

  // ─── Stage 1: Deterministic Pre-Router ──────────────────────────────────────
  // Runs before ANY LLM or FMP call. Guards out-of-domain traffic at the gate.
  const preRouteDecision = deterministicPreRouter({
    userInput,
    hasDashboard: state.hasDashboard,
    activeTickers: state.activeResearchContext?.activeTickers,
  });

  logger.info("[PIPELINE] Step 1a: Deterministic pre-router decision", {
    requestId,
    preRouteDecision,
    hasDashboard: state.hasDashboard,
  });

  // FOLLOW_UP fast-path: dashboard exists, no financial signals, no ticker.
  // Skip all company resolution — go straight to QA.
  if (preRouteDecision === "FOLLOW_UP") {
    logger.info("[PIPELINE] Pre-router: FOLLOW_UP fast-path — skipping company resolution", { requestId });
    if (sendEvent) {
      sendEvent("intent", { intent: "FOLLOW_UP", tickers: [] });
    }
    const duration = Date.now() - startTime;
    logger.info("[PIPELINE] intentRouterNode finished (pre-router FOLLOW_UP)", { requestId, durationMs: duration });
    return {
      intent: "FOLLOW_UP",
      tickers: [],
      error: null,
      activeResearchContext: state.activeResearchContext,
    };
  }

  // ─── Portfolio Position Extraction ──────────────────────────────────────────
  const hasPositionKeywords = /\b(own|holding|shares|bought|buy price|average price|average cost|sell|reduce|exit|average down|book profits|profit|loss|portfolio|position|down \d+%|up \d+%)\b/i.test(userInput);
  let extractedPosition: PortfolioPositionResponse | null = null;
  let activeResearchContext = state.activeResearchContext;

  const activeTickers = activeResearchContext?.activeTickers || [];
  const activeTicker = activeTickers[0] || null;

  if (hasPositionKeywords) {
    try {
      const positionLlm = llm.withStructuredOutput(portfolioPositionSchema);
      const extResponse = await invokeLlmWithRetry(() =>
        positionLlm.invoke([
          { role: "system", content: PORTFOLIO_PROMPT },
          { role: "user", content: `<user_input>\n${userInput}\n</user_input>` },
        ])
      ) as PortfolioPositionResponse;

      if (extResponse && extResponse.isPositionQuery) {
        extractedPosition = extResponse;
      }
    } catch (e) {
      logger.warn("Portfolio extraction failed, falling back", { error: String(e) });
    }
  }

  if (extractedPosition) {
    const rawTicker = extractedPosition.ticker;
    let finalTicker = activeTicker;
    if (rawTicker) {
      const res = await resolveCompany(rawTicker);
      if (res.success) {
        finalTicker = res.resolution.ticker;
      }
    }
    if (finalTicker) {
      if (!activeResearchContext) {
        activeResearchContext = {
          activeTickers: [finalTicker],
          reportType: "SINGLE",
          conversationMetadata: { lastInteraction: "Position extraction", chatHistory: [] },
          reports: {},
        };
      }
      if (!activeResearchContext.portfolioPositions) {
        activeResearchContext.portfolioPositions = {};
      }
      const existing = activeResearchContext.portfolioPositions[finalTicker] || {};
      activeResearchContext.portfolioPositions[finalTicker] = {
        ticker: finalTicker,
        averagePrice: extractedPosition.averagePrice !== null && extractedPosition.averagePrice !== undefined ? extractedPosition.averagePrice : existing.averagePrice,
        shares: extractedPosition.shares !== null && extractedPosition.shares !== undefined ? extractedPosition.shares : existing.shares,
      };

      logger.info("Merged extracted portfolio position info", {
        ticker: finalTicker,
        price: extractedPosition.averagePrice,
        shares: extractedPosition.shares,
      });
    }
  }

  // ─── Stage 2: Company Resolution ────────────────────────────────────────────
  // RESEARCH path: resolve tickers from the raw message (bulk resolver).
  // GEMINI_INTENT path: call Gemini for intent, then resolve only the company
  //   NAMES returned by Gemini (never the raw user message).

  if (preRouteDecision === "RESEARCH") {
    const bulkResult = await resolveCompanyTickersBulk(userInput);
    const resolved = bulkResult.tickers;

    logger.info("[PIPELINE] Step 2: Company resolution completed (RESEARCH path)", {
      requestId,
      bulkStatus: bulkResult.status,
      resolvedTickers: resolved,
      unresolved: bulkResult.unresolved,
    });

    if (bulkResult.status === "rate_limit") {
      result = { intent: "OUT_OF_DOMAIN", tickers: [], error: "Market data provider API rate limit reached. Please wait a moment and try again." };
    } else if (bulkResult.status === "network_error") {
      result = { intent: "OUT_OF_DOMAIN", tickers: [], error: "A network error occurred while resolving the company. Please check your connection." };
    }

    // All resolved tickers already cached → FOLLOW_UP
    if (!result?.intent && resolved.length > 0 && activeResearchContext?.reports) {
      const allCached = resolved.every((t) => activeResearchContext!.reports?.[t]);
      if (allCached) {
        logger.info("[PIPELINE] All tickers cached — routing as FOLLOW_UP", { requestId, resolved });
        result = { intent: "FOLLOW_UP", tickers: [], error: null };
      }
    }

    if (!result?.intent) {
      if (sendEvent) sendEvent("progress", { message: "Resolving company names..." });
      if (resolved.length === 0) {
        result = {
          intent: "OUT_OF_DOMAIN",
          tickers: [],
          error: `CHAT_RESPONSE::I couldn't find a publicly traded company matching your query. Try US stocks like AAPL, NVDA, MSFT, or Indian ADRs like INFY.`,
        };
      } else {
        const intent = resolved.length === 1 ? "SINGLE" : "MULTI";
        result = { intent, tickers: resolved, error: null };
      }
    }
  } else {
    // GEMINI_INTENT path
    logger.info("[PIPELINE] Step 2: Calling Gemini for intent classification", { requestId });
    try {
      const structuredLlm = llm.withStructuredOutput(intentSchema);
      const currentDate = new Date().toISOString().split("T")[0];
      const wrappedInput = `<user_input>\n${userInput}\n</user_input>`;

      const activeTickersStr = (state.activeResearchContext?.activeTickers || []).join(", ") || "None";
      const promptContext = INTENT_PROMPT
        .replace("{currentDate}", currentDate)
        .replace(/{activeTickers}/g, activeTickersStr);

      const response = await invokeLlmWithRetry(() =>
        structuredLlm.invoke([
          { role: "system", content: promptContext },
          { role: "user", content: wrappedInput },
        ])
      ) as IntentResponse & { error?: string };

      logger.info("[PIPELINE] Gemini intent classifier response", {
        requestId,
        geminiIntent: response.intent,
        // response.tickers contains raw company names from Gemini, not resolved tickers
        geminiCompanyNames: response.tickers,
      });

      // ── CRITICAL: Gemini returns raw company NAMES in response.tickers.
      // Pass each name individually to resolveCompany — NEVER pass the raw user message.
      const geminiResolved: string[] = [];
      const unresolvedNames: string[] = [];
      let rateLimitHit = false;
      let networkErrorHit = false;

      if (response.tickers && response.tickers.length > 0) {
        for (const companyName of response.tickers) {
          const trimmedName = companyName.trim();
          if (!trimmedName || trimmedName.length > 100) {
            logger.warn("[PIPELINE] Skipping suspiciously long name from Gemini", { requestId, name: trimmedName });
            continue;
          }
          const res = await resolveCompany(trimmedName);
          if (res.success) {
            geminiResolved.push(res.resolution.ticker);
          } else {
            if (res.reason === "rate_limit") { rateLimitHit = true; break; }
            if (res.reason === "network_error") { networkErrorHit = true; break; }
            unresolvedNames.push(trimmedName);
          }
        }
      }

      if (sendEvent) sendEvent("progress", { message: "Resolving company names..." });

      if (rateLimitHit) {
        result = { intent: "OUT_OF_DOMAIN", tickers: [], error: "Market data provider API rate limit reached. Please wait a moment and try again." };
      } else if (networkErrorHit) {
        result = { intent: "OUT_OF_DOMAIN", tickers: [], error: "A network error occurred while resolving the company. Please check your connection and try again." };
      } else if (unresolvedNames.length > 0 && geminiResolved.length === 0) {
        const firstUnresolved = unresolvedNames[0];
        result = {
          intent: "OUT_OF_DOMAIN",
          tickers: [],
          error: `CHAT_RESPONSE::I couldn't find a publicly traded company matching "${firstUnresolved}". ${firstUnresolved} may be a private company or not supported. Buddy supports publicly listed companies.`,
        };
      } else if (geminiResolved.length > 0 && (response.intent === "SINGLE" || response.intent === "MULTI")) {
        const finalIntent = geminiResolved.length === 1 ? "SINGLE" : "MULTI";
        const geminiAllLoaded = geminiResolved.every(t => activeResearchContext?.reports?.[t]);
        if (geminiAllLoaded) {
          result = { intent: "FOLLOW_UP", tickers: [], error: null };
        } else {
          result = { intent: finalIntent, tickers: geminiResolved, error: null };
        }
      } else if (response.intent === "FOLLOW_UP") {
        result = { intent: "FOLLOW_UP", tickers: [], error: null };
      } else if (response.intent === "KNOWLEDGE") {
        result = { intent: "KNOWLEDGE", tickers: [], error: null };
      } else if (response.intent === "OUT_OF_DOMAIN") {
        const errMsg = response.error || "I am an AI Investment Research Assistant. I specialize in analyzing public companies, comparing stocks, and answering financial questions. I cannot assist with non-investment-related requests.";
        result = { intent: "OUT_OF_DOMAIN", tickers: [], error: "CHAT_RESPONSE::" + errMsg };
      } else {
        result = { intent: response.intent || "OUT_OF_DOMAIN", tickers: [], error: response.error ? "CHAT_RESPONSE::" + response.error : null };
      }
    } catch (e) {
      logger.error("[PIPELINE] Gemini classification failed — falling back to OUT_OF_DOMAIN", {
        requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      result = { intent: "OUT_OF_DOMAIN", tickers: [], error: null };
    }
  }

  // Position query upgrade: if we have loaded context + position data, promote to FOLLOW_UP
  const targetTicker = (result?.tickers || [])[0] || activeTicker;
  const isReportLoaded = targetTicker && activeResearchContext?.reports?.[targetTicker];
  if (
    result?.intent !== "FOLLOW_UP" &&
    result?.intent !== "SINGLE" &&
    result?.intent !== "MULTI" &&
    extractedPosition?.isPositionQuery &&
    isReportLoaded
  ) {
    result = { ...result, intent: "FOLLOW_UP", tickers: [] };
  }

  logger.info("[PIPELINE] Step 4: Intent routing decided", {
    requestId,
    intent: result?.intent,
    tickers: result?.tickers,
    hasError: !!result?.error,
  });

  if (result?.intent && sendEvent) {
    sendEvent("intent", { intent: result.intent, tickers: result.tickers || [] });
  }

  const duration = Date.now() - startTime;
  logger.info("[PIPELINE] intentRouterNode finished", {
    requestId,
    durationMs: duration,
    intent: result?.intent,
    tickersResolved: result?.tickers,
  });

  return { ...result, activeResearchContext: activeResearchContext || state.activeResearchContext };
}


export async function mapReduceFetchNode(
  state: typeof AgentState.State,
  config?: NodeConfig
): Promise<Partial<typeof AgentState.State>> {
  const startTime = Date.now();
  const requestId = config?.configurable?.requestId || "N/A";
  logger.info("[PIPELINE] Step 5: mapReduceFetchNode started", {
    requestId,
    intent: state.intent,
    tickers: state.tickers,
  });

  const sendEvent = config?.configurable?.sendEvent;
  const tickers = state.tickers;

  if (tickers.length === 0) {
    logger.error("[PIPELINE] mapReduceFetchNode aborted — empty tickers list", { requestId });
    return { error: "No companies resolved to analyze." };
  }

  // 1. Parallel data collection (FMP skip / Finnhub continue)
  if (sendEvent) {
    sendEvent("progress", { message: "Fetching company profile..." });
  }

  const limit = pLimit(CONCURRENCY_LIMIT);
  // const hasRefresh = /\b(refresh|reload|re-run|update|again)\b/i.test(state.userInput || "");
  const existingMap = new Map<string, CompanyReport>();
  // Disabled caching to force fresh data fetch
  /*
  if (state.activeResearchContext?.reports) {
    for (const [ticker, report] of Object.entries(state.activeResearchContext.reports)) {
      existingMap.set(ticker.toUpperCase(), report);
    }
  }
  if (state.dashboardData?.companies) {
    for (const company of state.dashboardData.companies) {
      existingMap.set(company.ticker.toUpperCase(), company);
    }
  }
  */

  logger.info("[PIPELINE] Step 5a: Cache check complete", {
    requestId,
    cachedTickers: Array.from(existingMap.keys()),
    tickersToFetch: tickers.filter(t => !existingMap.has(t.toUpperCase())),
  });

  let reports;
  try {
    reports = await Promise.all(
      tickers.map((t) =>
        limit(async () => {
          const uppercaseTicker = t.toUpperCase();
          if (existingMap.has(uppercaseTicker)) {
            logger.info(`[PIPELINE] Reusing cached report for ${uppercaseTicker}`, { requestId });
            return existingMap.get(uppercaseTicker)!;
          }

          try {
            if (sendEvent) {
              sendEvent("progress", { message: `Fetching profile for ${t}...` });
            }
            logger.info(`[PIPELINE] Step 5b: Calling FMP for ${uppercaseTicker}`, { requestId });
            const report = await generateCompanyReportData(t);
            logger.info(`[PIPELINE] Step 5b: FMP completed for ${uppercaseTicker}`, {
              requestId,
              ticker: report.ticker,
              hasProfile: !!report.companyName,
              currentPrice: report.currentPrice,
            });
            return report;
          } catch (err) {
            if (err instanceof FmpQuotaError) {
              throw err;
            }
            logger.error(`[PIPELINE] FMP fetch failure for ${uppercaseTicker}`, {
              requestId,
              error: err instanceof Error ? err.message : String(err),
            });
            return null;
          }
        })
      )
    );
  } catch (error) {
    if (error instanceof FmpQuotaError) {
      logger.error("[PIPELINE] FMP Quota Limit reached — aborting", { requestId });
      throw new Error(`QUOTA_LIMIT::${error.message}`);
    }
    throw error;
  }

  const validReports = reports.filter((r) => r && r.ticker) as CompanyReport[];

  if (validReports.length === 0) {
    logger.error("[PIPELINE] All FMP fetches failed — no valid reports", { requestId, tickers });
    
    const tickerList = tickers.join(", ");
    return { 
      error: `CHAT_RESPONSE::⚠️ **Data Not Available for "${tickerList}"**\n\nThe current market data provider (**Financial Modeling Prep free plan**) only supports **major US stocks** listed on NYSE and NASDAQ.\n\n**This means the following will NOT work on the free plan:**\n- 🇮🇳 Indian stocks (NSE/BSE) — HDFC Bank, ICICI, Reliance, etc.\n- 🇮🇳 Indian ADRs — HDB, IBN, WIT, INFY, TTM, RDY, etc.\n- Most international/foreign-exchange stocks\n\n**What DOES work ✅:**\n- **US Tech:** Apple (AAPL), Nvidia (NVDA), Microsoft (MSFT), Google (GOOGL), Meta (META)\n- **US Finance:** JPMorgan (JPM), Goldman Sachs (GS), Visa (V)\n- **US Other:** Tesla (TSLA), Amazon (AMZN), Netflix (NFLX), Disney (DIS)\n\nTry asking: *"Should I buy Apple?"* or *"Compare Tesla vs Nvidia"*\n\nTo enable Indian stock support, the FMP API key needs to be upgraded to a paid plan at [financialmodelingprep.com](https://financialmodelingprep.com) 🔑` 
    };
  }

  logger.info("[PIPELINE] Step 5c: FMP fetch complete — starting synthesis", {
    requestId,
    validTickers: validReports.map(r => r.ticker),
  });

  // 2. Granular analysis stages for progress reporting
  if (sendEvent) {
    sendEvent("progress", { message: "Analyzing fundamentals, technical indicators, and risks..." });
  }

  // 3. Synthesis with Gemini (Zod validation retry / fallback)
  const synthesisPromises = validReports.map(async (report) => {
    if (report.recommendationDecision && report.whyScore) {
      logger.info(`[PIPELINE] Skipping synthesis — already synthesized: ${report.ticker}`, { requestId });
      return report;
    }

    if (sendEvent) {
      sendEvent("progress", { message: `Generating investment thesis and decision for ${report.ticker}...` });
    }
    const structuredLlm = llm.withStructuredOutput(thesisSchema);
    const userPositions = state.activeResearchContext?.portfolioPositions || {};
    const pos = userPositions[report.ticker];

    let positionDetailsContext = "";
    if (pos && (pos.averagePrice || pos.shares)) {
      positionDetailsContext = `\n[PORTFOLIO POSITION INFORMATION]\n` +
        `The user currently owns shares of this stock.\n` +
        `- User's Average Purchase Price (Cost Basis): $${pos.averagePrice || "unknown"}\n` +
        `- User's Number of Shares Owned: ${pos.shares || "unknown"}\n` +
        `- Current Market Price: $${report.currentPrice || "unknown"}\n` +
        `Provide tailored positionAdvice considering these entry variables relative to our quantitative metrics.`;
    } else {
      positionDetailsContext = `\n[PORTFOLIO POSITION INFORMATION]\nThe user does NOT currently own shares of this stock. Set the 'positionAdvice' property to null.`;
    }
    
    let llmResponse: ThesisResponse;
    try {
      logger.info(`[PIPELINE] Step 5d: Starting Gemini synthesis for ${report.ticker}`, { requestId });
      llmResponse = await invokeLlmWithRetry(() =>
        structuredLlm.invoke([
          { role: "system", content: SYNTHESIS_PROMPT },
          { role: "user", content: JSON.stringify(report) + positionDetailsContext },
        ])
      ) as ThesisResponse;
      logger.info(`[PIPELINE] Step 5d: Gemini synthesis complete for ${report.ticker}`, { requestId });
    } catch (e) {
      // ── Diagnostic: full synthesis error detail ───────────────────────────
      // This shows what error surface AFTER invokeLlmWithRetry has run (and
      // possibly retried). By this point the original error may already have
      // been wrapped into a ProviderUnavailableError — see the
      // "[LLM Retry] Original error BEFORE wrapping" log for the raw stack.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = e as any;
      logger.error(`[PIPELINE] Synthesis error detail for ${report.ticker}`, {
        requestId,
        errorClass: e instanceof Error ? e.constructor.name : typeof e,
        errorMessage: e instanceof Error ? e.message : String(e),
        isSyntaxError: e instanceof SyntaxError,
        isZodError: errObj?.constructor?.name === "ZodError" || !!errObj?._errors,
        isProviderUnavailable: errObj?.constructor?.name === "ProviderUnavailableError",
        looksLikeFenceError: e instanceof Error && e.message?.includes("`"),
        stack: e instanceof Error ? e.stack : undefined,
      });
      logger.warn(`[PIPELINE] Synthesis failed for ${report.ticker} — using deterministic fallback`, {
        requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      // Safe fallback reasoning generating polished deterministic reports
      const deterministicFallback = generateDeterministicSummary(report);
      
      // Calculate position advice fallback
      let fallbackPosAdvice = null;
      if (pos && pos.averagePrice) {
        const curPrice = report.currentPrice || 0;
        const gainPercent = parseFloat((((curPrice - pos.averagePrice) / pos.averagePrice) * 100).toFixed(2));
        
        let rec: "Buy More" | "Hold" | "Wait" | "Reduce Position" | "Exit" = "Hold";
        let reason = "Continuing to hold is reasonable under current parameters.";
        let action = "Hold current shares.";
        if (report.overallScore && report.overallScore >= 8.0) {
          if (gainPercent < -15) {
            rec = "Buy More";
            reason = "Fundamentals are excellent and price is significantly below average cost.";
            action = "Average down.";
          }
        } else if (report.overallScore && report.overallScore < 5.0) {
          rec = "Exit";
          reason = "Deteriorating investment score suggests exiting to preserve capital.";
          action = "Consider exiting position.";
        }
        
        fallbackPosAdvice = {
          recommendation: rec,
          reason,
          risk: (report.overallScore && report.overallScore >= 8.0 ? "Low" : report.overallScore && report.overallScore < 5.0 ? "High" : "Medium") as "Low" | "Medium" | "High",
          suggestedAction: action,
        };
      }

      llmResponse = {
        confidenceRationale: deterministicFallback.confidenceRationale,
        investmentThesis: deterministicFallback.investmentThesis,
        categories: {
          fundamentals: deterministicFallback.categories.fundamentals,
          technicals: deterministicFallback.categories.technicals,
          sentiment: deterministicFallback.categories.sentiment,
          risk: deterministicFallback.categories.risk,
        },
        whyScore: deterministicFallback.whyScore,
        recommendationDecision: deterministicFallback.recommendationDecision,
        decisionExplanation: deterministicFallback.decisionExplanation,
        valuationStatus: deterministicFallback.valuationStatus,
        investmentHorizon: deterministicFallback.investmentHorizon,
        suitableFor: deterministicFallback.suitableFor,
        expectedVolatility: deterministicFallback.expectedVolatility,
        portfolioSuitability: deterministicFallback.portfolioSuitability,
        buddyConclusion: deterministicFallback.buddyConclusion,
        newsIntelligence: deterministicFallback.newsIntelligence,
        investmentMemo: deterministicFallback.investmentMemo,
        positionAdvice: fallbackPosAdvice,
      };
    }

    // Merge LLM reasoning into the report (preserve deterministic scores)
    report.confidenceRationale = llmResponse.confidenceRationale;
    report.investmentThesis = llmResponse.investmentThesis;
    
    report.categories.fundamentals.reasoning = llmResponse.categories.fundamentals.reasoning;
    report.categories.fundamentals.whyScore = llmResponse.categories.fundamentals.whyScore;
    
    report.categories.technicals.reasoning = llmResponse.categories.technicals.reasoning;
    report.categories.technicals.whyScore = llmResponse.categories.technicals.whyScore;
    
    report.categories.sentiment.reasoning = llmResponse.categories.sentiment.reasoning;
    report.categories.sentiment.whyScore = llmResponse.categories.sentiment.whyScore;
    
    report.categories.risk.reasoning = llmResponse.categories.risk.reasoning;
    report.categories.risk.whyScore = llmResponse.categories.risk.whyScore;

    report.whyScore = llmResponse.whyScore;
    report.recommendationDecision = llmResponse.recommendationDecision;
    report.decisionExplanation = llmResponse.decisionExplanation;
    report.valuationStatus = llmResponse.valuationStatus;
    report.investmentHorizon = llmResponse.investmentHorizon;
    report.suitableFor = llmResponse.suitableFor;
    report.expectedVolatility = llmResponse.expectedVolatility;
    report.portfolioSuitability = llmResponse.portfolioSuitability;
    report.buddyConclusion = llmResponse.buddyConclusion;
    report.newsIntelligence = llmResponse.newsIntelligence;
    report.investmentMemo = llmResponse.investmentMemo;

    if (pos && (pos.averagePrice || pos.shares)) {
      const avgPrice = pos.averagePrice || 0;
      const curPrice = report.currentPrice || 0;
      const gainPercent = avgPrice > 0 ? parseFloat((((curPrice - avgPrice) / avgPrice) * 100).toFixed(2)) : undefined;
      
      report.positionAdvice = {
        recommendation: llmResponse.positionAdvice?.recommendation || "Hold",
        reason: llmResponse.positionAdvice?.reason || "Fundamentals remain healthy.",
        risk: llmResponse.positionAdvice?.risk || "Medium",
        suggestedAction: llmResponse.positionAdvice?.suggestedAction || "No immediate changes",
        averageCost: pos.averagePrice || undefined,
        currentPrice: curPrice,
        gainPercent: gainPercent,
        shares: pos.shares || undefined,
      };
    } else {
      report.positionAdvice = undefined;
    }

    return report;
  });

  const finalReports = await Promise.all(synthesisPromises);

  if (sendEvent) {
    sendEvent("progress", { message: "Preparing dashboard..." });
  }

  const dashboardData: DashboardData = {
    type: state.intent === "MULTI" ? "MULTI" : "SINGLE",
    companies: finalReports,
  };

  if (dashboardData.type === "MULTI" && finalReports.length > 1) {
    dashboardData.winner = finalReports.reduce((max, r) =>
      r.overallScore > max.overallScore ? r : max
    ).ticker;

    // Run Comparison report synthesis
    try {
      const companiesSummary = finalReports.map(r => ({
        ticker: r.ticker,
        companyName: r.companyName,
        overallScore: r.overallScore,
        tier: r.tier,
        thesis: r.investmentThesis.keyStrengths.join("; "),
        positives: r.whyScore?.positiveFactors?.join("; "),
        negatives: r.whyScore?.negativeFactors?.join("; "),
        valuation: r.valuationStatus,
        expectedVolatility: r.expectedVolatility,
      }));

      const compPrompt = COMPARISON_PROMPT.replace(
        "{companiesData}",
        JSON.stringify(companiesSummary, null, 2)
      );

      const compResponse = await invokeLlmWithRetry(() =>
        llm.invoke([
          { role: "system", content: compPrompt },
          { role: "user", content: "Analyze the companies and output the comparison report." }
        ])
      );

      dashboardData.comparisonSummary = compResponse.content as string;
      logger.info("[PIPELINE] Generated comparative summary via LLM", { requestId });
    } catch (e) {
      logger.warn("[PIPELINE] Comparison summary LLM run failed — using fallback", { error: String(e) });
      const ticker1 = finalReports[0].ticker;
      const ticker2 = finalReports[1].ticker;
      dashboardData.comparisonSummary = `### 🏆 Overall Winner\n**Winner:** **${dashboardData.winner}**\nThis asset shows superior overall rating indicators.\n\n### 🎯 Who Should Choose What?\n* **Choose ${ticker1} if:** You seek long-term stability and conservative margins.\n* **Choose ${ticker2} if:** You seek active volatility and technical momentum patterns.`;
    }
  }

  const previous = state.activeResearchContext ?? {
    reports: {},
    activeTickers: [],
    portfolioPositions: {},
    reportType: dashboardData.type,
    conversationMetadata: { lastInteraction: "", chatHistory: [] },
  };

  const mergedReports = {
    ...previous.reports,
  };
  for (const report of finalReports) {
    mergedReports[report.ticker] = report;
  }

  const mergedTickers = Array.from(
    new Set([
      ...previous.activeTickers,
      ...finalReports.map((r) => r.ticker),
    ])
  );

  const activeResearchContext: ActiveResearchContext = {
    activeTickers: mergedTickers,
    reportType: dashboardData.type,
    conversationMetadata: { 
      ...previous.conversationMetadata,
      lastInteraction: "Generated report" 
    },
    portfolioPositions: {
      ...previous.portfolioPositions,
      ...(state.activeResearchContext?.portfolioPositions || {}),
    },
    reports: mergedReports,
  };

  logger.info("[PIPELINE] Step 5e: Dashboard generated — sending SSE events", {
    requestId,
    dashboardType: dashboardData.type,
    companies: finalReports.map(r => ({ ticker: r.ticker, score: r.overallScore })),
  });

  if (sendEvent) {
    sendEvent("dashboard", dashboardData);
    sendEvent("context", activeResearchContext);
  }

  const duration = Date.now() - startTime;
  logger.info("[PIPELINE] mapReduceFetchNode finished successfully", {
    requestId,
    durationMs: duration,
    companiesGenerated: finalReports.map((r) => r.ticker),
  });

  return { dashboardData, activeResearchContext };
}

function buildOptimizedContext(context: ActiveResearchContext | null, dashboardData: DashboardData | null): string {
  if (!context || !context.reports || Object.keys(context.reports).length === 0) {
    return dashboardData ? JSON.stringify(dashboardData, null, 2) : "No context available.";
  }

  // Stage 6: QA Context Isolation
  // Only include reports for tickers that belong to THIS tab's active research.
  // This prevents cross-tab context leakage where a prior company's report
  // bleeds into follow-up answers for a different company.
  const activeTickerSet = new Set(
    (context.activeTickers || []).map((t) => t.toUpperCase())
  );
  const filteredReports = Object.entries(context.reports).filter(
    ([ticker]) => activeTickerSet.size === 0 || activeTickerSet.has(ticker.toUpperCase())
  );


  if (filteredReports.length === 0) {
    return dashboardData ? JSON.stringify(dashboardData, null, 2) : "No context available.";
  }

  const compact = {
    type: context.reportType,
    winner: dashboardData?.winner,
    comparisonSummary: dashboardData?.comparisonSummary,
    portfolioPositions: context.portfolioPositions,
    companies: filteredReports.map(([, company]) => ({
      companyName: company.companyName,
      ticker: company.ticker,
      currentPrice: company.currentPrice,
      overallScore: company.overallScore,
      tier: company.tier,
      confidence: company.confidence,
      confidenceRationale: company.confidenceRationale,
      recommendationDecision: company.recommendationDecision,
      decisionExplanation: company.decisionExplanation,
      valuationStatus: company.valuationStatus,
      investmentHorizon: company.investmentHorizon,
      expectedVolatility: company.expectedVolatility,
      portfolioSuitability: company.portfolioSuitability,
      positionAdvice: company.positionAdvice,
      investmentThesis: {
        keyStrengths: company.investmentThesis.keyStrengths,
        keyWeaknesses: company.investmentThesis.keyWeaknesses,
        growthDrivers: company.investmentThesis.growthDrivers,
        majorRisks: company.investmentThesis.majorRisks,
        keyWatchlist: company.investmentThesis.keyWatchlist,
      },
      categoryScores: {
        fundamentals: company.categories.fundamentals.score,
        technicals: company.categories.technicals.score,
        sentiment: company.categories.sentiment.score,
        risk: company.categories.risk.score,
      },
      categoryReasoning: {
        fundamentals: company.categories.fundamentals.reasoning,
        technicals: company.categories.technicals.reasoning,
        sentiment: company.categories.sentiment.reasoning,
        risk: company.categories.risk.reasoning,
      },
    })),
  };

  return JSON.stringify(compact, null, 2);
}

// function isQuestionQuery(query: string): boolean {
//   const lowercase = query.toLowerCase().trim();
//   const questionWords = [
//     "why", "how", "what", "which", "who", "where", "when", "whether",
//     "is", "are", "do", "does", "did", "can", "could", "should", "would", "will", "shall",
//     "has", "have", "had", "was", "were"
//   ];
//   const hasQuestionMark = lowercase.includes("?");
//   const startsWithQuestionWord = questionWords.some(w => lowercase.startsWith(w + " ") || lowercase.startsWith(w + "'"));
//   const hasQuestionKeywords = /\b(why|how|what|explain|describe|question|which|who|where|when|compare|difference|score|thesis|strength|weakness|risk|should|would|could|is|are|does|do|can)\b/i.test(query);
// 
//   return hasQuestionMark || startsWithQuestionWord || hasQuestionKeywords;
// }

export async function qaNode(
  state: typeof AgentState.State,
  config?: NodeConfig
): Promise<Partial<typeof AgentState.State>> {
  const requestId = config?.configurable?.requestId || "N/A";
  logger.info("[QA Node] QA node entered", {
    requestId,
    userInput: state.userInput,
    activeTickers: state.tickers,
    activeResearchContextExists: !!state.activeResearchContext,
  });

  // 1. Build the context strictly from the active tab
  const context = buildOptimizedContext(state.activeResearchContext, state.dashboardData);
  const prompt = QA_PROMPT.replace("{activeResearchContext}", context);

  const charCount = context.length;
  const estimatedTokens = Math.ceil(charCount / 4);
  const companyCount = state.activeResearchContext?.reports 
    ? Object.keys(state.activeResearchContext.reports).length 
    : 0;
  const serializedSize = Buffer.byteLength(context, "utf8");

  logger.info("[QA Node] Context statistics", {
    requestId,
    charCount,
    estimatedTokens,
    companyCount,
    serializedSize,
  });

  const invokeStartTime = Date.now();
  try {
    logger.info("[QA Node] Immediately before llm.invoke()", {
      requestId,
    });

    // 2. Invoke LLM (blocking call, no streaming)
    const response = await llm.invoke([
      { role: "system", content: prompt },
      { role: "user", content: state.userInput }
    ]);

    const latency = Date.now() - invokeStartTime;
    logger.info("[QA Node] Immediately after llm.invoke()", {
      requestId,
      latencyMs: latency,
    });

    // Inspect the OpenRouter response details before parsing response.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResponse = response as any;
    logger.info("[QA Node] Raw AIMessage response from ChatOpenAI", {
      requestId,
      additional_kwargs: response.additional_kwargs,
      response_metadata: response.response_metadata,
      tool_calls: response.tool_calls,
      invalid_tool_calls: rawResponse.invalid_tool_calls,
      usage_metadata: rawResponse.usage_metadata,
      raw_json: JSON.parse(JSON.stringify(response)),
    });

    const contentStr = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    logger.info("[QA Node] Response metadata", {
      requestId,
      responseType: typeof response.content,
      contentLength: contentStr.length,
      first200: contentStr.slice(0, 200),
    });

    logger.info("[QA Node] Immediately before returning CHAT_RESPONSE", {
      requestId,
    });

    // 3. Return the complete text using the CHAT_RESPONSE convention
    // The API route handler is looking for this exact prefix
    return { error: `CHAT_RESPONSE::${response.content}` }; 
  } catch (error) {
    const duration = Date.now() - invokeStartTime;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    logger.error("[QA Node] Error occurred during LLM invocation", {
      requestId,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
      httpStatus: err.status ?? err.response?.status ?? err.statusCode ?? "N/A",
      responseBody: err.response?.data ?? err.body ?? err.error ?? "N/A",
      durationBeforeFailureMs: duration,
    });

    console.error("[QA Node] LLM invocation failed:", error);
    return { error: "I'm having trouble processing that right now. Please try again." };
  }
}

export async function rejectNode(
  state: typeof AgentState.State,
  config?: NodeConfig
): Promise<Partial<typeof AgentState.State>> {
  const startTime = Date.now();
  const requestId = config?.configurable?.requestId || "N/A";
  logger.info("[PIPELINE] Step 6 (reject): rejectNode started", {
    requestId,
    stateIntent: state.intent,
    stateError: state.error,
    tickers: state.tickers,
  });

  const sendEvent = config?.configurable?.sendEvent;
  
  let errorMessage =
    "I am an AI Investment Research Assistant. I specialize in analyzing public companies, comparing stocks, and answering financial questions. I cannot assist with non-investment-related requests.";
  let isChatResponse = false;

  if (state.tickers && state.tickers.length > 5) {
    errorMessage = "You can only compare up to 5 companies at a time.";
  } else if (state.error) {
    if (state.error.startsWith("CHAT_RESPONSE::")) {
      errorMessage = state.error.replace("CHAT_RESPONSE::", "");
      isChatResponse = true;
    } else {
      errorMessage = state.error;
    }
  }

  logger.info("[PIPELINE] rejectNode sending response", {
    requestId,
    isChatResponse,
    errorMessageLength: errorMessage.length,
  });

  if (sendEvent) {
    if (isChatResponse) {
      sendEvent("chat", { token: errorMessage });
    } else {
      sendEvent("error", { message: errorMessage });
    }
  }

  const duration = Date.now() - startTime;
  logger.info("[PIPELINE] rejectNode finished", {
    requestId,
    durationMs: duration,
  });

  return { error: state.error };
}
