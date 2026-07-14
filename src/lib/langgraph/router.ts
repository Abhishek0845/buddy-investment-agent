/**
 * Deterministic Fast Pre-Router
 *
 * Executes BEFORE LangGraph nodes, before any LLM calls, before any FMP calls.
 * Pure TypeScript — no network I/O, no Gemini, no FMP.
 *
 * Returns one of three routing decisions:
 *  - "RESEARCH"      → explicit ticker or unambiguous financial intent found
 *  - "FOLLOW_UP"     → no new research signals, but dashboard context exists
 *  - "GEMINI_INTENT" → ambiguous; delegate to Gemini for single intent call
 */

export type PreRouteDecision = "RESEARCH" | "FOLLOW_UP" | "GEMINI_INTENT";

/**
 * Whitelist of positive financial signal keywords.
 * We use a whitelist (never a blacklist) to avoid false positives.
 */
const FINANCIAL_SIGNAL_WORDS = new Set([
  "buy", "sell", "hold", "invest", "investment", "portfolio", "valuation",
  "market", "earnings", "stock", "stocks", "shares", "analysis", "analyze",
  "analyse", "compare", "vs", "versus", "risk", "technical", "fundamental",
  "pe", "p/e", "rsi", "beta", "moving average", "market cap", "balance sheet",
  "financial", "revenue", "profit", "loss", "dividend", "ipo", "equity",
  "bond", "yield", "inflation", "gdp", "recession", "bull", "bear",
  "momentum", "volatility", "hedge", "options", "futures", "commodities",
  "etf", "index", "nasdaq", "nyse", "nse", "bse", "dow", "s&p",
  "quarter", "annual report", "eps", "roe", "roa", "debt", "cash flow",
  "price target", "analyst", "upgrade", "downgrade", "recommendation",
  "position", "average down", "profit booking", "stop loss",
]);

/**
 * Ticker regex: 1-5 uppercase letters, optionally followed by a dot and
 * 1-3 uppercase letters (e.g. TCS.NS, BRK-B style handled separately).
 */
const TICKER_REGEX = /^[A-Z]{1,5}(\.[A-Z]{1,3})?$/;

/**
 * Stop-words that should never be treated as tickers even if they are uppercase.
 */
const TICKER_STOP_WORDS = new Set([
  "I", "A", "AN", "THE", "AND", "OR", "BUT", "FOR", "TO", "IN", "ON",
  "AT", "BY", "WITH", "US", "IS", "ARE", "DO", "DID", "CAN", "NO",
  "NOT", "IT", "IF", "AS", "UP", "OF", "MY", "ME", "BE", "GO",
  "OK", "VS", "ETF", "CEO", "CFO", "AI", "ML", "IT",
]);

/**
 * Detect whether the user input contains an explicit ticker symbol.
 * Scans whitespace-split tokens for TICKER_REGEX matches (excluding stop words).
 */
function hasExplicitTicker(input: string): boolean {
  const tokens = input.trim().split(/\s+/);
  for (const token of tokens) {
    // Strip trailing punctuation (commas, question marks, etc.)
    const clean = token.replace(/[^A-Z0-9.]/gi, "").toUpperCase();
    if (
      clean.length >= 1 &&
      TICKER_REGEX.test(clean) &&
      !TICKER_STOP_WORDS.has(clean)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detect whether the user input contains any financial signal keyword.
 */
function hasFinancialSignal(input: string): boolean {
  const lower = input.toLowerCase();
  for (const signal of FINANCIAL_SIGNAL_WORDS) {
    // Word-boundary check for single-word signals
    if (signal.includes(" ")) {
      if (lower.includes(signal)) return true;
    } else {
      // Use word boundary via regex for single tokens
      const re = new RegExp(`\\b${signal}\\b`);
      if (re.test(lower)) return true;
    }
  }
  return false;
}

export interface PreRouterInput {
  /** The raw user message */
  userInput: string;
  /**
   * True if the current tab already has a completed dashboard loaded.
   * Passed from the frontend payload so we never inspect global store state here.
   */
  hasDashboard: boolean;
  /**
   * Tickers currently active in the dashboard, if any.
   */
  activeTickers?: string[];
}

/**
 * Deterministic pre-router.
 *
 * Rules (in priority order):
 * 1. If hasDashboard is true, immediately delegate to GEMINI_INTENT.
 *    Gemini is better equipped to determine if the user is discussing the active
 *    dashboard (FOLLOW_UP) or requesting a completely new company (SINGLE/MULTI).
 * 2. Explicit ticker detected → RESEARCH
 * 3. Financial signal keywords found → GEMINI_INTENT (Gemini confirms company names)
 * 4. Else → GEMINI_INTENT (Gemini will classify as OUT_OF_DOMAIN / KNOWLEDGE / etc.)
 *
 * IMPORTANT: We never classify out-of-domain ourselves.
 * Gemini is the sole authority for KNOWLEDGE and OUT_OF_DOMAIN.
 */
export function deterministicPreRouter(input: PreRouterInput): PreRouteDecision {
  const { userInput, hasDashboard } = input;

  // 1. If there's an active dashboard, always let Gemini decide between FOLLOW_UP and NEW RESEARCH.
  // This prevents the blunt hasExplicitTicker from accidentally wiping the dashboard.
  if (hasDashboard) {
    return "GEMINI_INTENT";
  }

  // 2. Fast-path new research if there's an explicit ticker (e.g. "AAPL")
  if (hasExplicitTicker(userInput)) {
    return "RESEARCH";
  }

  // 3. Check for financial signals (e.g. "buy", "sell", "compare")
  if (hasFinancialSignal(userInput)) {
    return "GEMINI_INTENT";
  }

  return "GEMINI_INTENT";
}

// ─── LangGraph conditional edge function (post-intent switch) ───────────────
// This remains for the graph.ts conditional edge after intentRouterNode.
import { AgentState } from "./state";

export function routeNextNode(state: typeof AgentState.State): string {
  switch (state.intent as string | null) {
    case "SINGLE":
      return "SINGLE";

    case "MULTI":
      return "MULTI";

    case "FOLLOW_UP":
      return "FOLLOW_UP";

    case "KNOWLEDGE":
      return "KNOWLEDGE";

    case "OUT_OF_DOMAIN":
      return "OUT_OF_DOMAIN";

    case "ERROR":
    default:
      return "ERROR";
  }
}