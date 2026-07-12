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
  // US Large Caps
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
  amd: { ticker: "AMD", companyName: "Advanced Micro Devices, Inc." },
  "bank of america": { ticker: "BAC", companyName: "Bank of America Corporation" },
  "coca-cola": { ticker: "KO", companyName: "Coca-Cola Company" },
  // Indian Large Caps - full names
  "hdfc bank": { ticker: "HDFCBANK.NS", companyName: "HDFC Bank Limited" },
  "icici bank": { ticker: "ICICIBANK.NS", companyName: "ICICI Bank Limited" },
  "reliance industries": { ticker: "RELIANCE.NS", companyName: "Reliance Industries Limited" },
  "tata motors": { ticker: "TATAMOTORS.NS", companyName: "Tata Motors Limited" },
  "tata consultancy": { ticker: "TCS.NS", companyName: "Tata Consultancy Services Limited" },
  "tata consultancy services": { ticker: "TCS.NS", companyName: "Tata Consultancy Services Limited" },
  infosys: { ticker: "INFY.NS", companyName: "Infosys Limited" },
  tcs: { ticker: "TCS.NS", companyName: "Tata Consultancy Services Limited" },
  wipro: { ticker: "WIPRO.NS", companyName: "Wipro Limited" },
  // Indian Large Caps - short/common names
  hdfc: { ticker: "HDFCBANK.NS", companyName: "HDFC Bank Limited" },
  hdfcbank: { ticker: "HDFCBANK.NS", companyName: "HDFC Bank Limited" },
  "hdfc bank limited": { ticker: "HDFCBANK.NS", companyName: "HDFC Bank Limited" },
  icici: { ticker: "ICICIBANK.NS", companyName: "ICICI Bank Limited" },
  icicibank: { ticker: "ICICIBANK.NS", companyName: "ICICI Bank Limited" },
  "icici bank limited": { ticker: "ICICIBANK.NS", companyName: "ICICI Bank Limited" },
  reliance: { ticker: "RELIANCE.NS", companyName: "Reliance Industries Limited" },
  "tata motors limited": { ticker: "TATAMOTORS.NS", companyName: "Tata Motors Limited" },
  tatamotors: { ticker: "TATAMOTORS.NS", companyName: "Tata Motors Limited" },
  "axis bank": { ticker: "AXISBANK.NS", companyName: "Axis Bank Limited" },
  axisbank: { ticker: "AXISBANK.NS", companyName: "Axis Bank Limited" },
  "kotak mahindra": { ticker: "KOTAKBANK.NS", companyName: "Kotak Mahindra Bank Limited" },
  "kotak bank": { ticker: "KOTAKBANK.NS", companyName: "Kotak Mahindra Bank Limited" },
  kotak: { ticker: "KOTAKBANK.NS", companyName: "Kotak Mahindra Bank Limited" },
  "bajaj finance": { ticker: "BAJFINANCE.NS", companyName: "Bajaj Finance Limited" },
  "bajaj finserv": { ticker: "BAJAJFINSV.NS", companyName: "Bajaj Finserv Limited" },
  "maruti suzuki": { ticker: "MARUTI.NS", companyName: "Maruti Suzuki India Limited" },
  maruti: { ticker: "MARUTI.NS", companyName: "Maruti Suzuki India Limited" },
  "state bank": { ticker: "SBIN.NS", companyName: "State Bank of India" },
  sbi: { ticker: "SBIN.NS", companyName: "State Bank of India" },
  "lt": { ticker: "LT.NS", companyName: "Larsen & Toubro Limited" },
  "larsen toubro": { ticker: "LT.NS", companyName: "Larsen & Toubro Limited" },
  "larsen & toubro": { ticker: "LT.NS", companyName: "Larsen & Toubro Limited" },
  "sun pharma": { ticker: "SUNPHARMA.NS", companyName: "Sun Pharmaceutical Industries Limited" },
  "dr reddy": { ticker: "DRREDDY.NS", companyName: "Dr. Reddy's Laboratories Limited" },
  "asian paints": { ticker: "ASIANPAINT.NS", companyName: "Asian Paints Limited" },
  "ultratech cement": { ticker: "ULTRACEMCO.NS", companyName: "UltraTech Cement Limited" },
  "hcl tech": { ticker: "HCLTECH.NS", companyName: "HCL Technologies Limited" },
  "hcl technologies": { ticker: "HCLTECH.NS", companyName: "HCL Technologies Limited" },
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
  const lowercaseMessage = message.toLowerCase();

  // 1. Check ALIAS_CACHE for multi-word and single-word matches first
  //    Sort by length descending so longer (more specific) aliases take priority
  const aliasNames = Object.keys(ALIAS_CACHE).sort((a, b) => b.length - a.length);
  const coveredRanges: Array<[number, number]> = [];

  for (const alias of aliasNames) {
    const idx = lowercaseMessage.indexOf(alias);
    if (idx !== -1) {
      // Check not already covered by a longer alias
      const end = idx + alias.length;
      const alreadyCovered = coveredRanges.some(([s, e]) => idx >= s && end <= e);
      if (!alreadyCovered) {
        candidates.add(alias);
        coveredRanges.push([idx, end]);
      }
    }
  }

  // 2. Extract uppercase words matching ticker format, skip words covered by alias ranges
  const uppercaseMatches = [...message.matchAll(/\b[A-Z]{1,5}(?:\.[A-Z]{2})?\b/g)];
  for (const m of uppercaseMatches) {
    const word = m[0];
    const idx = m.index ?? 0;
    if (STOP_WORDS.has(word)) continue;
    const end = idx + word.length;
    const coveredByAlias = coveredRanges.some(([s, e]) => idx >= s && end <= e);
    if (!coveredByAlias) {
      candidates.add(word);
    }
  }

  // 3. Extract other capitalized single words not covered by aliases
  const capitalizedMatches = [...message.matchAll(/\b[A-Z][a-z]+\b/g)];
  for (const m of capitalizedMatches) {
    const word = m[0];
    const idx = m.index ?? 0;
    if (STOP_WORDS.has(word)) continue;
    const end = idx + word.length;
    const coveredByAlias = coveredRanges.some(([s, e]) => idx >= s && end <= e);
    if (!coveredByAlias) {
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
