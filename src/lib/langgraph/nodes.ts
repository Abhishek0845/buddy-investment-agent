import pLimit from "p-limit";
import { useTabStore } from "@/store/use-tab-store";
import { resolveCompany, resolveCompanyTickers, resolveCompanyTickersBulk } from "@/services/companyResolver";
import { AgentState } from "./state";
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function extractDeterministicTickers(input: string): Promise<string[]> {
  return await resolveCompanyTickers(input);
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
    cachedTickers: Object.keys(state.activeResearchContext?.reports || {}),
  });

  const sendEvent = config?.configurable?.sendEvent;
  const userInput = state.userInput;
  let result: Partial<typeof AgentState.State> | undefined = undefined;

  // Try to parse portfolio details
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

  // 1. Try deterministic routing first
  // Resolve company tickers (deterministic + LLM fallback) before intent classification
  const bulkResult = await resolveCompanyTickersBulk(userInput);
  let resolved = bulkResult.tickers;

  logger.info("[PIPELINE] Step 2: Company resolution completed", {
    requestId,
    userInput,
    bulkStatus: bulkResult.status,
    resolvedTickers: resolved,
    unresolved: bulkResult.unresolved,
  });

  // Early error handling for bulk resolution
  if (bulkResult.status === "rate_limit") {
    result = {
      intent: "OUT_OF_DOMAIN",
      tickers: [],
      error: "Market data provider API rate limit reached. Please wait a moment and try again."
    };
  } else if (bulkResult.status === "network_error") {
    result = {
      intent: "OUT_OF_DOMAIN",
      tickers: [],
      error: "A network error occurred while resolving the company. Please check your connection."
    };
  }

  // If no tickers resolved deterministically, attempt a direct company name resolution as fallback
  if (resolved.length === 0) {
    const directRes = await resolveCompany(userInput);
    if (directRes.success) {
      resolved = [directRes.resolution.ticker];
      logger.info("[PIPELINE] Fallback direct company resolution succeeded", {
        requestId,
        ticker: directRes.resolution.ticker,
        companyName: directRes.resolution.companyName,
      });
    } else {
      logger.info("[PIPELINE] Direct company resolution also failed", {
        requestId,
        reason: directRes.reason,
      });
    }
  }

  // Active workspace check (debug logging)
  const tabState = useTabStore.getState();
  const activeTabId = tabState.activeTabId;
  logger.info("[PIPELINE] Step 3: Active workspace check", {
    requestId,
    activeTabId,
    resolvedTickers: resolved,
  });

  // Cached report check: if any resolved ticker already has a report, treat as FOLLOW_UP
  if (!result?.intent && resolved.length > 0 && activeResearchContext?.reports) {
    const cachedTicker = resolved.find((t) => activeResearchContext.reports?.[t]);
    if (cachedTicker) {
      logger.info("[PIPELINE] Cached report found — routing as FOLLOW_UP", { requestId, cachedTicker });
      result = { intent: "FOLLOW_UP", tickers: [], error: null };
    }
  }

  const hasQuestionKeywords = /\b(why|how|what|explain|describe|question|which|who|where|when|difference|score|thesis|strength|weakness|risk|should|would|could|is|are|does|do|can)\b/i.test(userInput);
  const allResolvedLoaded = resolved.length > 0 && resolved.every(t => activeResearchContext?.reports?.[t]);

  // Determine target ticker for follow‑up checks
  let targetTicker = resolved[0] || activeTicker;
  if (extractedPosition?.ticker) {
    const res = await resolveCompany(extractedPosition.ticker);
    if (res.success) {
      targetTicker = res.resolution.ticker;
    }
  }
  const isReportLoaded = targetTicker && activeResearchContext?.reports?.[targetTicker];

  // If we already have a result from error handling, skip further routing
  if (!result?.intent && resolved.length > 0) {
    if (sendEvent) {
      sendEvent("progress", { message: "Resolving company names..." });
    }
    if (allResolvedLoaded && (resolved.length === 1 || hasQuestionKeywords)) {
      result = { intent: "FOLLOW_UP", tickers: [], error: null };
    } else {
      const intent = resolved.length === 1 ? "SINGLE" : "MULTI";
      result = { intent, tickers: resolved, error: null };
    }
  } else if (!result?.intent && activeResearchContext && (hasQuestionKeywords || (extractedPosition && extractedPosition.isPositionQuery && isReportLoaded))) {
    if (sendEvent) {
      sendEvent("progress", { message: "Analyzing query context..." });
    }
    result = { intent: "FOLLOW_UP", tickers: [], error: null };
  } else if (!result?.intent) {
    // 2. Fall back to Gemini slow-path classification
    logger.info("[PIPELINE] No deterministic resolution — falling back to Gemini intent classifier", { requestId });
    try {
      const structuredLlm = llm.withStructuredOutput(intentSchema);
      const currentDate = new Date().toISOString().split("T")[0];
      
      const wrappedInput = `<user_input>\n${userInput}\n</user_input>`;
      
      const response = await invokeLlmWithRetry(() =>
        structuredLlm.invoke([
          {
            role: "system",
            content: INTENT_PROMPT.replace("{currentDate}", currentDate),
          },
          { role: "user", content: wrappedInput },
        ])
      ) as IntentResponse & { error?: string };

      logger.info("[PIPELINE] Gemini intent classifier response", {
        requestId,
        geminiIntent: response.intent,
        geminiTickers: response.tickers,
      });

      const geminiResolved: string[] = [];
      const unresolvedNames: string[] = [];
      let rateLimitHit = false;
      let networkErrorHit = false;

      if (response.tickers && response.tickers.length > 0) {
        for (const t of response.tickers) {
          const res = await resolveCompany(t);
          if (res.success) {
            geminiResolved.push(res.resolution.ticker);
          } else {
            if (res.reason === "rate_limit") {
              rateLimitHit = true;
              break;
            } else if (res.reason === "network_error") {
              networkErrorHit = true;
              break;
            }
            unresolvedNames.push(t);
          }
        }
      }

      if (sendEvent) {
        sendEvent("progress", { message: "Resolving company names..." });
      }

      if (rateLimitHit) {
        result = {
          intent: "OUT_OF_DOMAIN",
          tickers: [],
          error: "Market data provider API rate limit reached. Please wait a moment and try again.",
        };
      } else if (networkErrorHit) {
        result = {
          intent: "OUT_OF_DOMAIN",
          tickers: [],
          error: "A network error occurred while resolving the company. Please check your connection and try again.",
        };
      } else if (unresolvedNames.length > 0) {
        const firstUnresolved = unresolvedNames[0];
        result = {
          intent: "OUT_OF_DOMAIN",
          tickers: [],
          error: `CHAT_RESPONSE::I couldn't find a publicly traded company matching "${firstUnresolved}". ${firstUnresolved} is currently a private company, so I can't generate an investment report. Buddy currently supports publicly listed companies available through market data providers.`,
        };
      } else if (geminiResolved.length > 0 && (response.intent === "SINGLE" || response.intent === "MULTI")) {
        const finalIntent = geminiResolved.length === 1 ? "SINGLE" : "MULTI";
        const geminiAllLoaded = geminiResolved.every(t => activeResearchContext?.reports?.[t]);
        if (geminiAllLoaded) {
          result = { intent: "FOLLOW_UP", tickers: [], error: null };
        } else {
          result = { intent: finalIntent, tickers: geminiResolved, error: null };
        }
      } else if (response.intent === "OUT_OF_DOMAIN") {
        const errMsg = response.error || "I am an AI Investment Research Assistant. I specialize in analyzing public companies, comparing stocks, and answering financial questions. I cannot assist with non-investment-related requests.";
        result = {
          intent: "OUT_OF_DOMAIN",
          tickers: [],
          error: "CHAT_RESPONSE::" + errMsg,
        };
      } else {
        result = { 
          intent: response.intent || "OUT_OF_DOMAIN", 
          tickers: [], 
          error: response.error ? "CHAT_RESPONSE::" + response.error : null 
        };
      }
    } catch (e) {
      logger.error("[PIPELINE] Gemini classification failed — falling back to OUT_OF_DOMAIN", {
        requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      result = { intent: "OUT_OF_DOMAIN", tickers: [], error: null };
    }
  }

  logger.info("[PIPELINE] Step 4: Intent routing decided", {
    requestId,
    intent: result?.intent,
    tickers: result?.tickers,
    hasError: !!result?.error,
  });

  // Stream intent event immediately
  if (result?.intent) {
    if (sendEvent) {
      sendEvent("intent", { intent: result.intent, tickers: result.tickers || [] });
    }
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
  const hasRefresh = /\b(refresh|reload|re-run|update|again)\b/i.test(state.userInput || "");
  const existingMap = new Map<string, CompanyReport>();
  if (!hasRefresh) {
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
  }

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
    return { error: "Failed to fetch data for all requested companies." };
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

  const compact = {
    type: context.reportType,
    winner: dashboardData?.winner,
    comparisonSummary: dashboardData?.comparisonSummary,
    portfolioPositions: context.portfolioPositions,
    companies: Object.values(context.reports).map((company) => ({
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

function isQuestionQuery(query: string): boolean {
  const lowercase = query.toLowerCase().trim();
  const questionWords = [
    "why", "how", "what", "which", "who", "where", "when", "whether",
    "is", "are", "do", "does", "did", "can", "could", "should", "would", "will", "shall",
    "has", "have", "had", "was", "were"
  ];
  const hasQuestionMark = lowercase.includes("?");
  const startsWithQuestionWord = questionWords.some(w => lowercase.startsWith(w + " ") || lowercase.startsWith(w + "'"));
  const hasQuestionKeywords = /\b(why|how|what|explain|describe|question|which|who|where|when|compare|difference|score|thesis|strength|weakness|risk|should|would|could|is|are|does|do|can)\b/i.test(query);

  return hasQuestionMark || startsWithQuestionWord || hasQuestionKeywords;
}

export async function qaNode(
  state: typeof AgentState.State,
  config?: NodeConfig
): Promise<Partial<typeof AgentState.State>> {
  const startTime = Date.now();
  const requestId = config?.configurable?.requestId || "N/A";
  logger.info("[PIPELINE] Step 6: qaNode started", {
    requestId,
    intent: state.intent,
    userInput: state.userInput,
    hasDashboard: !!state.dashboardData,
    dashboardCompanies: state.dashboardData?.companies?.map(c => c.ticker) || [],
    hasActiveContext: !!state.activeResearchContext,
  });

  const sendEvent = config?.configurable?.sendEvent;
  
  // Short-circuit: Research intent completed, just send a summary chat message
  if ((state.intent === "SINGLE" || state.intent === "MULTI") && !isQuestionQuery(state.userInput)) {
    const dashboardData = state.dashboardData;
    let finalChatText = "";

    if (dashboardData && dashboardData.companies && dashboardData.companies.length > 0) {
      if (dashboardData.companies.length === 1) {
        const company = dashboardData.companies[0];
        const score = typeof company.overallScore === "number" ? company.overallScore.toFixed(1) : "N/A";
        finalChatText = `### 📈 Analysis Complete for **${company.companyName || company.ticker} (${company.ticker})**\n\n` +
          `- **Overall Score:** **${score}/100** (Tier: **${company.tier || "N/A"}**)\n` +
          `- **Recommendation Decision:** **${company.recommendationDecision || "Hold / Wait"}**\n` +
          `- **Valuation Status:** **${company.valuationStatus || "N/A"}**\n` +
          `- **Bottom Line:** ${company.investmentMemo?.bottomLine || company.confidenceRationale || "See dashboard for details."}\n\n` +
          `I have generated the complete report for you. Please check the dashboard tabs for detailed sections.`;
      } else {
        finalChatText = `### 📊 Comparison Analysis Complete\n\n` +
          `I have completed the investment analysis for the requested companies: **${dashboardData.companies.map(c => c.ticker).join(", ")}**.\n\n` +
          `🏆 **Highest Score:** **${dashboardData.winner}**\n\n` +
          `You can find the detailed comparison table and individual breakdowns in the **Comparison** tab.`;
      }
    } else {
      finalChatText = "I've updated the analysis dashboard with the latest company data.";
    }

    logger.info("[PIPELINE] Step 6: qaNode sending research summary chat message", {
      requestId,
      chatTextLength: finalChatText.length,
      companies: dashboardData?.companies?.map(c => c.ticker) || [],
    });

    if (sendEvent) {
      sendEvent("chat", { token: finalChatText });
      sendEvent("context", state.activeResearchContext);
    }

    const duration = Date.now() - startTime;
    logger.info("[PIPELINE] Step 6: qaNode finished (research summary branch)", {
      requestId,
      durationMs: duration,
      chatSent: true,
    });
    return { error: `CHAT_RESPONSE::${finalChatText}`, activeResearchContext: state.activeResearchContext };
  }

  // QA path: use Gemini to answer based on context
  const context = buildOptimizedContext(state.activeResearchContext, state.dashboardData);
  const prompt = QA_PROMPT.replace("{activeResearchContext}", context);

  let finalChatText = "";
  try {
    const wrappedInput = `<user_input>\n${state.userInput}\n</user_input>`;
    const chatHistory = state.activeResearchContext?.conversationMetadata?.chatHistory || [];

    const messages = [
      { role: "system", content: prompt },
      ...chatHistory.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      })),
      { role: "user", content: wrappedInput }
    ];

    logger.info("[PIPELINE] Step 6: qaNode calling Gemini for answer", {
      requestId,
      historyLength: chatHistory.length,
      contextLength: context.length,
    });

    const response = await invokeLlmWithRetry(() =>
      llm.invoke(messages)
    );

    finalChatText = response.content as string;

    logger.info("[PIPELINE] Step 6: qaNode Gemini answer received", {
      requestId,
      responseLength: finalChatText.length,
    });

    if (sendEvent) {
      sendEvent("chat", { token: finalChatText });
    }
  } catch (err) {
    logger.error("[PIPELINE] qaNode LLM call failed — using deterministic fallback", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    let fallbackText = "⚠️ Generative AI API is currently rate-limited. However, based on the loaded research reports:\n\n";
    if (state.activeResearchContext?.reports) {
      for (const [ticker, report] of Object.entries(state.activeResearchContext.reports)) {
        fallbackText += `* **${ticker}**: Overall Score of **${report.overallScore}/100** (Tier: ${report.tier}).\n`;
        fallbackText += `  - Fundamentals: ${report.categories.fundamentals.score}/100\n`;
        fallbackText += `  - Technicals: ${report.categories.technicals.score}/100\n`;
        fallbackText += `  - Sentiment: ${report.categories.sentiment.score}/100\n`;
        fallbackText += `  - Risk: ${report.categories.risk.score}/100\n\n`;
      }
    } else {
      fallbackText += "No active research reports are currently loaded in context.";
    }
    
    finalChatText = fallbackText;
    if (sendEvent) {
      sendEvent("chat", { token: finalChatText });
    }
  }

  // Preserve positions context and trigger client-side update
  if (sendEvent) {
    sendEvent("context", state.activeResearchContext);
  }

  const duration = Date.now() - startTime;
  logger.info("[PIPELINE] Step 6: qaNode finished", {
    requestId,
    durationMs: duration,
    chatSent: !!finalChatText,
    chatTextLength: finalChatText.length,
  });

  return { error: `CHAT_RESPONSE::${finalChatText}`, activeResearchContext: state.activeResearchContext };
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
