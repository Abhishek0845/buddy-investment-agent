import { searchStocks, FmpQuotaError } from "@/lib/api/fmp";
import { SearchResult } from "@/types";
import { logger } from "@/lib/utils/logger";
import { llmForResolution } from "@/lib/utils/gemini";
import { z } from "zod";

export interface CompanyResolution {
  ticker: string;
  companyName: string;
}

export type ResolveResult = 
  | { success: true; resolution: CompanyResolution }
  | { success: false; reason: "unsupported" | "rate_limit" | "network_error" };

export interface BulkResolveResult {
  tickers: string[];
  unresolved: string[];
  status: "success" | "rate_limit" | "network_error";
}

// In-memory runtime cache for company resolutions
const resolutionCache = new Map<string, CompanyResolution>();

// Lightweight local alias cache
const ALIAS_CACHE: Record<string, CompanyResolution> = {
  apple: { ticker: "AAPL", companyName: "Apple Inc." },
  google: { ticker: "GOOGL", companyName: "Alphabet Inc." },
  alphabet: { ticker: "GOOGL", companyName: "Alphabet Inc." },
  meta: { ticker: "META", companyName: "Meta Platforms, Inc." },
  facebook: { ticker: "META", companyName: "Meta Platforms, Inc." },
  tesla: { ticker: "TSLA", companyName: "Tesla, Inc." },
  nvidia: { ticker: "NVDA", companyName: "NVIDIA Corporation" },
  amazon: { ticker: "AMZN", companyName: "Amazon.com, Inc." },
  microsoft: { ticker: "MSFT", companyName: "Microsoft Corporation" },
  netflix: { ticker: "NFLX", companyName: "Netflix, Inc." },
  "hdfc bank": { ticker: "HDFCBANK.NS", companyName: "HDFC Bank Limited" },
  "icici bank": { ticker: "ICICIBANK.NS", companyName: "ICICI Bank Limited" },
  "reliance industries": { ticker: "RELIANCE.NS", companyName: "Reliance Industries Limited" },
  "tata motors": { ticker: "TATAMOTORS.NS", companyName: "Tata Motors Limited" },
  infosys: { ticker: "INFY.NS", companyName: "Infosys Limited" },
  tcs: { ticker: "TCS.NS", companyName: "Tata Consultancy Services Limited" },
  wipro: { ticker: "WIPRO.NS", companyName: "Wipro Limited" },
  "bank of america": { ticker: "BAC", companyName: "Bank of America Corporation" },
  "coca-cola": { ticker: "KO", companyName: "Coca-Cola Company" }
};



const extractedCompaniesSchema = z.object({
  companies: z.array(z.string()).describe("A list of company names or stock ticker symbols mentioned in the text"),
});

async function extractCompaniesWithLlm(message: string): Promise<string[]> {
  try {
    const structuredLlm = llmForResolution.withStructuredOutput(extractedCompaniesSchema);
    const prompt = `You are a financial entity extractor. Your job is to extract names of publicly traded companies or stock ticker symbols from the user's message.
Do not extract general terms, concept words, or private companies if not relevant.
Examples:
"Should I buy Apple?" -> { "companies": ["Apple"] }
"Is Tesla a good investment?" -> { "companies": ["Tesla"] }
"Compare Microsoft and Amazon" -> { "companies": ["Microsoft", "Amazon"] }
"Tell me about weather" -> { "companies": [] }

Message: "${message}"`;

    const response = await structuredLlm.invoke([
      { role: "user", content: prompt }
    ]);
    return response.companies || [];
  } catch (err) {
    logger.warn("LLM company extraction failed, falling back", { error: String(err) });
    return [];
  }
}



function rankMatches(results: SearchResult[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  
  const isMajorExchange = (exchange: string, shortExchange?: string) => {
    const name = (exchange || "").toUpperCase();
    const short = (shortExchange || "").toUpperCase();
    return (
      short === "NASDAQ" ||
      short === "NYSE" ||
      short === "AMEX" ||
      short === "NSE" ||
      short === "BSE" ||
      name.includes("NASDAQ") ||
      name.includes("NEW YORK STOCK EXCHANGE") ||
      name.includes("NATIONAL STOCK EXCHANGE") ||
      name.includes("BOMBAY STOCK EXCHANGE")
    );
  };

  const scored = results.map((r, index) => {
    let score = 0;
    const symbol = r.symbol.toLowerCase();
    const name = r.name.toLowerCase();

    // 1. Exact company name match
    if (name === q) {
      score += 1000;
    } else if (name.startsWith(q + " ") || name.startsWith(q + ",")) {
      score += 500;
    } else if (name.includes(q)) {
      score += 200;
    }

    // 2. Exact ticker match
    const symbolWithoutExchange = symbol.split(".")[0];
    if (symbol === q || symbolWithoutExchange === q) {
      score += 800;
    }

    // 3. Major exchange preference
    if (isMajorExchange(r.stockExchange, r.exchangeShortName)) {
      score += 100;
    }

    // 4. Highest relevance returned by FMP
    score -= index;

    return { result: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.result);
}

export async function resolveCompany(query: string): Promise<ResolveResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { success: false, reason: "unsupported" };

  const cacheKey = cleanQuery.toLowerCase();

  // 1. Check runtime cache
  if (resolutionCache.has(cacheKey)) {
    return { success: true, resolution: resolutionCache.get(cacheKey)! };
  }

  // 2. Check local alias cache first (faster, avoids network)
  if (ALIAS_CACHE[cacheKey]) {
    const resolution = ALIAS_CACHE[cacheKey];
    resolutionCache.set(cacheKey, resolution);
    return { success: true, resolution };
  }

  // 3. Check if user typed a valid ticker directly
  try {
    const clean = cleanQuery.toUpperCase();
    if (/^[A-Z0-9.\-]{1,12}$/.test(clean)) {
      const results = await searchStocks(clean);
      const matched = results.find(r => r.symbol.toUpperCase() === clean);
      if (matched) {
        const resolution = { ticker: matched.symbol, companyName: matched.name };
        resolutionCache.set(cacheKey, resolution);
        return { success: true, resolution };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof FmpQuotaError || msg.includes("RATE_LIMIT") || msg.includes("Limit Reach") || msg.includes("429")) {
      return { success: false, reason: "rate_limit" };
    }
    return { success: false, reason: "network_error" };
  }

  // 4. Call FMP Search API
  try {
    const results = await searchStocks(cleanQuery);
    if (results && results.length > 0) {
      const ranked = rankMatches(results, cleanQuery);
      if (ranked.length > 0) {
        const bestMatch = ranked[0];
        
        const nameLower = bestMatch.name.toLowerCase();
        const symbolLower = bestMatch.symbol.toLowerCase();
        const symbolWithoutExchange = symbolLower.split(".")[0];
        const queryLower = cleanQuery.toLowerCase();
        const queryWords = queryLower.split(/\s+/);
        
        const isMatch = 
          nameLower.includes(queryLower) || 
          queryLower.includes(nameLower) ||
          symbolLower === queryLower || 
          symbolWithoutExchange === queryLower ||
          queryWords.some(word => word.length > 2 && (nameLower.includes(word) || symbolWithoutExchange.includes(word)));

        if (isMatch) {
          const resolution = { ticker: bestMatch.symbol, companyName: bestMatch.name };
          resolutionCache.set(cacheKey, resolution);
          return { success: true, resolution };
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`FMP search failed for query: ${cleanQuery}`, { error: msg });
    if (err instanceof FmpQuotaError || msg.includes("Limit Reach") || msg.includes("429")) {
      return { success: false, reason: "rate_limit" };
    }
    return { success: false, reason: "network_error" };
  }

  return { success: false, reason: "unsupported" };
}

const STOP_WORDS = new Set([
  "I", "Should", "Buy", "Sell", "Hold", "What", "Why", "How", "When", "Where", "Who", "Is", "Are", 
  "The", "And", "Or", "But", "For", "To", "In", "On", "At", "By", "With", "About", "Against", 
  "Explain", "Describe", "Question", "Which", "Compare", "Difference", "Score", "Thesis", 
  "Strength", "Weakness", "Risk", "Valuation", "Buddy", "Investment", "Report", "Company", "Stock"
]);

export function extractCandidateNames(message: string): string[] {
  const candidates = new Set<string>();
  
  // 1. Extract uppercase words matching ticker format (alphabetic only, length 1-5, e.g., AAPL)
  const uppercaseWords = message.match(/\b[A-Z]{1,5}(?:\.[A-Z]{2})?\b/g) || [];
  for (const word of uppercaseWords) {
    if (!STOP_WORDS.has(word)) {
      candidates.add(word);
    }
  }

  // 2. Check for ALIAS_CACHE lowercase matches
  const lowercaseMessage = message.toLowerCase();
  const aliasNames = Object.keys(ALIAS_CACHE);
  for (const alias of aliasNames) {
    if (lowercaseMessage.includes(alias)) {
      candidates.add(alias);
    }
  }

  // 3. Extract other capitalized words as company name candidates, filtering out common words
  const capitalizedWords = message.match(/\b[A-Z][a-z]+\b/g) || [];
  for (const word of capitalizedWords) {
    if (!STOP_WORDS.has(word)) {
      candidates.add(word);
    }
  }

  return Array.from(candidates);
}

export async function resolveCompanyTickersBulk(message: string): Promise<BulkResolveResult> {
  const candidates = extractCandidateNames(message);
  const tickers: string[] = [];
  const unresolved: string[] = [];
  let rateLimitHit = false;
  let networkErrorHit = false;

  // Resolve candidates in parallel
  const results = await Promise.all(candidates.map(candidate => resolveCompany(candidate)));

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const res = results[i];
    if (res.success) {
      tickers.push(res.resolution.ticker.toUpperCase());
    } else {
      if (res.reason === "rate_limit") rateLimitHit = true;
      else if (res.reason === "network_error") networkErrorHit = true;
      unresolved.push(candidate);
    }
  }

  // If no tickers were resolved and no rate limit/network error occurred, fall back to LLM extraction
  if (tickers.length === 0 && !rateLimitHit && !networkErrorHit) {
    const llmCandidates = await extractCompaniesWithLlm(message);
    const llmResults = await Promise.all(llmCandidates.map(async (candidate) => {
      if (candidates.some(c => c.toLowerCase() === candidate.toLowerCase())) return null;
      return { candidate, res: await resolveCompany(candidate) };
    }));
    
    for (const item of llmResults) {
      if (item && item.res.success) {
        tickers.push(item.res.resolution.ticker.toUpperCase());
      }
    }
  }

  const uniqueTickers = Array.from(new Set(tickers));

  if (rateLimitHit) return { tickers: [], unresolved, status: "rate_limit" };
  if (networkErrorHit) return { tickers: [], unresolved, status: "network_error" };

  return { tickers: uniqueTickers, unresolved, status: "success" };
}

export async function resolveCompanyTickers(message: string): Promise<string[]> {
  const result = await resolveCompanyTickersBulk(message);
  return result.tickers;
}
