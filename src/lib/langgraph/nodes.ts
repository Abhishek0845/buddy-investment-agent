import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentState } from "./state";
import {
  intentSchema,
  thesisSchema,
  IntentResponse,
  ThesisResponse,
} from "@/lib/schemas/zod";
import { INTENT_PROMPT, SYNTHESIS_PROMPT, QA_PROMPT } from "@/lib/prompts";
import { generateCompanyReportData } from "@/services/researchService";
import { CompanyReport, DashboardData, ActiveResearchContext } from "@/types";

const modelName = process.env.GOOGLE_MODEL || "DUMMY_MODEL";
const apiKey = process.env.GOOGLE_API_KEY || "DUMMY_KEY";

console.log("Model:", modelName);
console.log("Key length:", apiKey.length);
console.log("Key first 12:", apiKey.substring(0, 12));
console.log("Key last 10:", apiKey.substring(apiKey.length - 10));

const llm = new ChatGoogleGenerativeAI({
  model: modelName,
  apiKey: apiKey,
  temperature: 0.2,
});

export async function intentRouterNode(
  state: typeof AgentState.State
): Promise<Partial<typeof AgentState.State>> {
  console.log("intentRouterNode START");
  const userInput = state.userInput;

  let result: Partial<typeof AgentState.State>;

  // Fast-path regex for explicit tickers (e.g., "AAPL")
  const tickerRegex = /\b[A-Z]{1,5}\b/;
  if (tickerRegex.test(userInput) && userInput.split(" ").length <= 3) {
    const tickers = userInput.match(/\b[A-Z]{1,5}\b/g) || [];
    if (tickers.length === 1) {
      result = { intent: "SINGLE", tickers };
    } else if (tickers.length > 1 && tickers.length <= 5) {
      result = { intent: "MULTI", tickers };
    } else {
      result = { intent: null, tickers: [] };
    }
  } else {
    // LLM Slow-path for ambiguous inputs
    const currentDate = new Date().toISOString().split("T")[0];
    const structuredLlm = llm.withStructuredOutput(intentSchema);
    console.log("intentRouterNode: Calling structuredLlm.invoke START");
    const response = (await structuredLlm.invoke([
      {
        role: "system",
        content: INTENT_PROMPT.replace("{currentDate}", currentDate),
      },
      { role: "user", content: userInput },
    ])) as IntentResponse;
    console.log("intentRouterNode: Calling structuredLlm.invoke END");

    result = { intent: response.intent, tickers: response.tickers || [] };
  }

  console.log("intentRouterNode END");
  return result;
}

export async function mapReduceFetchNode(
  state: typeof AgentState.State
): Promise<Partial<typeof AgentState.State>> {
  console.log("mapReduceFetchNode START");
  const tickers = state.tickers;

  // Execute data fetches in parallel
  const reportPromises = tickers.map((t) => generateCompanyReportData(t));
  const reports = await Promise.all(reportPromises);

  // Filter out failed fetches
  const validReports = reports.filter((r) => r.ticker) as CompanyReport[];

  if (validReports.length === 0) {
    console.log("mapReduceFetchNode END");
    return { error: "Failed to fetch data for the requested companies." };
  }

  // Synthesize LLM reasoning for each report
  const synthesisPromises = validReports.map(async (report) => {
    const structuredLlm = llm.withStructuredOutput(thesisSchema);
    console.log(`mapReduceFetchNode: Calling structuredLlm.invoke START for ${report.ticker}`);
    const llmResponse = (await structuredLlm.invoke([
      { role: "system", content: SYNTHESIS_PROMPT },
      { role: "user", content: JSON.stringify(report) },
    ])) as ThesisResponse;
    console.log(`mapReduceFetchNode: Calling structuredLlm.invoke END for ${report.ticker}`);

    // Merge LLM reasoning into the report
    report.investmentThesis = llmResponse.investmentThesis;
    report.confidenceRationale = llmResponse.confidenceRationale;
    report.categories.fundamentals.reasoning =
      llmResponse.categories.fundamentals.reasoning;
    report.categories.technicals.reasoning =
      llmResponse.categories.technicals.reasoning;
    report.categories.sentiment.reasoning =
      llmResponse.categories.sentiment.reasoning;
    report.categories.risk.reasoning = llmResponse.categories.risk.reasoning;

    return report;
  });

  const finalReports = await Promise.all(synthesisPromises);

  const dashboardData: DashboardData = {
    type: state.intent === "MULTI" ? "MULTI" : "SINGLE",
    companies: finalReports,
  };

  // Determine winner for MULTI
  if (dashboardData.type === "MULTI" && finalReports.length > 1) {
    dashboardData.winner = finalReports.reduce((max, r) =>
      r.overallScore > max.overallScore ? r : max
    ).ticker;
    // LLM could generate comparative thesis here, but keeping it simple for MVP
  }

  // Update Active Research Context
  const activeResearchContext: ActiveResearchContext = {
    activeTickers: finalReports.map((r) => r.ticker),
    reportType: dashboardData.type,
    conversationMetadata: { lastInteraction: "Generated report" },
    reports: finalReports.reduce((acc, r) => {
      acc[r.ticker] = {
        overallScore: r.overallScore,
        tier: r.tier,
        categoryScores: {
          fund: r.categories.fundamentals.score,
          tech: r.categories.technicals.score,
          sent: r.categories.sentiment.score,
          risk: r.categories.risk.score,
        },
        thesis: r.investmentThesis.keyStrengths.join(" "),
        keyRisks: r.investmentThesis.majorRisks,
      };
      return acc;
    }, {} as ActiveResearchContext["reports"]),
  };

  console.log("mapReduceFetchNode END");
  return { dashboardData, activeResearchContext };
}

export async function qaNode(
  state: typeof AgentState.State
): Promise<Partial<typeof AgentState.State>> {
  console.log("qaNode START");
  const context = JSON.stringify(state.activeResearchContext, null, 2);
  const prompt = QA_PROMPT.replace("{activeResearchContext}", context);

  console.log("qaNode: Calling llm.invoke START");
  const response = await llm.invoke([
    { role: "system", content: prompt },
    { role: "user", content: state.userInput },
  ]);
  console.log("qaNode: Calling llm.invoke END");

  // Return a dummy dashboardData object to carry the chat response,
  // or handle this differently in the route. We will use the error field
  // temporarily to carry chat text for MVP simplicity,
  // but let's add a proper chatResponse to state instead.
  console.log("qaNode END");
  return { error: `CHAT_RESPONSE::${response.content}` };
}

export async function rejectNode(
  state: typeof AgentState.State
): Promise<Partial<typeof AgentState.State>> {
  console.log("rejectNode START");
  if (state.tickers.length > 5) {
    console.log("rejectNode END");
    return { error: "You can only compare up to 5 companies at a time." };
  }
  console.log("rejectNode END");
  return {
    error:
      "I am an AI Investment Research Assistant. I specialize in analyzing public companies, comparing stocks, and answering financial questions. I cannot assist with non-investment-related requests.",
  };
}


