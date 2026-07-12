import axios from "axios";
import { getEnv } from "@/lib/validation/env";
import {
  SearchResult,
  StockProfile,
  StockQuote,
  HistoricalBar,
  FinancialMetric,
} from "@/types/stock";
import { InvalidTickerError } from "@/lib/errors";
import { withRetry } from "@/lib/utils/retry";
import { handleAxiosError } from "./axios";
import { logger } from "@/lib/utils/logger";
import { API_TIMEOUT_MS } from "@/lib/config";

export class FmpQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FmpQuotaError";
  }
}

const BASE_URL = "https://financialmodelingprep.com/stable";

export const fmpClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT_MS * 2,
});

fmpClient.interceptors.request.use((config) => {
  const env = getEnv();
  config.params = {
    ...config.params,
    apikey: env.FMP_API_KEY,
  };
  return config;
});

fmpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMsg =
      error.response?.data?.["Error Message"] ||
      error.response?.data?.error ||
      error.message ||
      "FMP API request failed";
    logger.error("FMP API Error", { error: errorMsg });
    return Promise.reject(new Error(errorMsg));
  }
);

async function executeFmpRequest<T>(
  url: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fmpClient.get<T>(url, {
        params,
        signal: controller.signal,
      });

      // Check response body for Error Message indicating quota/limit
      if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
        const dataObj = response.data as Record<string, unknown>;
        if ("Error Message" in dataObj || "error" in dataObj) {
          const errMsg = String(dataObj["Error Message"] || dataObj["error"]);
          if (
            errMsg.includes("Limit Reach") ||
            errMsg.includes("upgrade your subscription plan") ||
            errMsg.includes("quota")
          ) {
            throw new FmpQuotaError(errMsg);
          }
        }
      }

      return response.data;
    } catch (error) {
      if (error instanceof FmpQuotaError) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new FmpQuotaError("FMP API Rate limit/quota exceeded");
        }
        const responseData = error.response?.data;
        if (responseData && typeof responseData === "object" && !Array.isArray(responseData)) {
          const errMsg = String(responseData["Error Message"] || responseData.error || "");
          if (
            errMsg.includes("Limit Reach") ||
            errMsg.includes("upgrade your subscription plan") ||
            errMsg.includes("quota")
          ) {
            throw new FmpQuotaError(errMsg);
          }
        }
      }
      return handleAxiosError(error, url);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

/**
 * Searches for stock symbols matching the query.
 * FMP stable endpoint: GET /stable/search-symbol?query={query}
 */
export async function searchStocks(query: string): Promise<SearchResult[]> {
  return executeFmpRequest<SearchResult[]>("/search-symbol", { query });
}

/**
 * Fetches the company profile summary.
 * FMP stable endpoint: GET /stable/profile?symbol={symbol}
 */
export async function getCompanyProfile(symbol: string): Promise<StockProfile> {
  const data = await executeFmpRequest<StockProfile[]>("/profile", { symbol });
  if (!data || data.length === 0) {
    throw new InvalidTickerError(`Company profile not found for symbol: ${symbol}`);
  }
  return data[0];
}

/**
 * Fetches the real-time stock quote.
 * FMP stable endpoint: GET /stable/quote?symbol={symbol}
 */
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const data = await executeFmpRequest<StockQuote[]>("/quote", { symbol });
  if (!data || data.length === 0) {
    throw new InvalidTickerError(`Stock quote not found for symbol: ${symbol}`);
  }
  return data[0];
}

/**
 * Fetches historical daily prices (sorted chronologically: oldest first).
 * FMP stable endpoint: GET /stable/historical-price-eod/full?symbol={symbol}
 */
export async function getHistoricalPrices(
  symbol: string,
  limit: number = 1250
): Promise<HistoricalBar[]> {
  const data = await executeFmpRequest<FmpHistoricalPrice[]>("/historical-price-eod/full", { symbol });
  // Return sliced and reversed (chronological order)
  return data
    .slice(0, limit)
    .reverse()
    .map((item: FmpHistoricalPrice) => ({
      ...item,
      price: item.close, // map 'close' to 'price' for backward compatibility
    }));
}

interface FMPIncomeStatement {
  date: string;
  revenue: number;
  netIncome: number;
  operatingIncome: number;
  eps: number;
  ebitda: number;
}

interface FMPCashFlowStatement {
  date: string;
  freeCashFlow: number;
}

/**
 * Fetches historical financials by merging income statements, cash flow statements, and ratios.
 * FMP stable endpoints:
 *   - GET /stable/income-statement?symbol={symbol}
 *   - GET /stable/cash-flow-statement?symbol={symbol}
 */
export async function getFinancials(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FinancialMetric[]> {
  const [incomeStatements, cashFlowStatements, ratiosData] = await Promise.all([
    executeFmpRequest<FMPIncomeStatement[]>("/income-statement", { symbol, period, limit }),
    executeFmpRequest<FMPCashFlowStatement[]>("/cash-flow-statement", { symbol, period, limit }),
    executeFmpRequest<FmpRatio[]>("/ratios", { symbol, period, limit }),
  ]);

  // Map cash flow statements by date for O(1) lookups
  const cashFlowMap = new Map<string, number>();
  for (const cf of cashFlowStatements) {
    cashFlowMap.set(cf.date, cf.freeCashFlow);
  }

  // Map ratios by date for O(1) lookups
  const ratiosMap = new Map<string, FmpRatio>();
  for (const r of ratiosData) {
    ratiosMap.set(r.date, r);
  }

  // Merge the statements into the unified FinancialMetric schema
  const financials: FinancialMetric[] = incomeStatements.map((inc) => {
    const freeCashFlow = cashFlowMap.get(inc.date) ?? 0;
    const ratio = ratiosMap.get(inc.date);
    return {
      date: inc.date,
      revenue: inc.revenue || 0,
      netIncome: inc.netIncome || 0,
      operatingIncome: inc.operatingIncome || 0,
      eps: inc.eps || 0,
      ebitda: inc.ebitda || 0,
      freeCashFlow,
      netIncomeRatio: ratio?.netProfitMargin ?? inc.netIncome / (inc.revenue || 1),
    } as FinancialMetric;
  });

  return financials;
}

export interface FmpProfile {
  symbol: string;
  price: number;
  marketCap: number;
  beta: number;
  lastDividend: number;
  range: string;
  change: number;
  changePercentage: number;
  volume: number;
  averageVolume: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchangeFullName: string;
  exchange: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  image: string;
  ipoDate: string;
  defaultImage: boolean;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isAdr: boolean;
  isFund: boolean;
  pe?: number | null;
}

export interface FmpIncomeStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  filingDate: string;
  acceptedDate: string;
  fiscalYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  researchAndDevelopmentExpenses: number;
  generalAndAdministrativeExpenses: number;
  sellingAndMarketingExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  otherExpenses: number;
  operatingExpenses: number;
  costAndExpenses: number;
  netInterestIncome: number;
  interestIncome: number;
  interestExpense: number;
  depreciationAndAmortization: number;
  ebitda: number;
  ebit: number;
  nonOperatingIncomeExcludingInterest: number;
  operatingIncome: number;
  totalOtherIncomeExpensesNet: number;
  incomeBeforeTax: number;
  incomeTaxExpense: number;
  netIncomeFromContinuingOperations: number;
  netIncomeFromDiscontinuedOperations: number;
  otherAdjustmentsToNetIncome: number;
  netIncome: number;
  netIncomeDeductions: number;
  bottomLineNetIncome: number;
  eps: number;
  epsDiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
  netIncomeRatio?: number | null;
}

export interface FmpBalanceSheet {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  filingDate: string;
  acceptedDate: string;
  fiscalYear: string;
  period: string;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  cashAndShortTermInvestments: number;
  netReceivables: number;
  accountsReceivables: number;
  otherReceivables: number;
  inventory: number;
  prepaids: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  propertyPlantEquipmentNet: number;
  goodwill: number;
  intangibleAssets: number;
  goodwillAndIntangibleAssets: number;
  longTermInvestments: number;
  taxAssets: number;
  otherNonCurrentAssets: number;
  totalNonCurrentAssets: number;
  otherAssets: number;
  totalAssets: number;
  totalPayables: number;
  accountPayables: number;
  otherPayables: number;
  accruedExpenses: number;
  shortTermDebt: number;
  capitalLeaseObligationsCurrent: number;
  taxPayables: number;
  deferredRevenue: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  capitalLeaseObligationsNonCurrent: number;
  deferredRevenueNonCurrent: number;
  deferredTaxLiabilitiesNonCurrent: number;
  otherNonCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  otherLiabilities: number;
  capitalLeaseObligations: number;
  totalLiabilities: number;
  treasuryStock: number;
  preferredStock: number;
  commonStock: number;
  retainedEarnings: number;
  additionalPaidInCapital: number;
  accumulatedOtherComprehensiveIncomeLoss: number;
  otherTotalStockholdersEquity: number;
  totalStockholdersEquity: number;
  totalEquity: number;
  minorityInterest: number;
  totalLiabilitiesAndTotalEquity: number;
  totalInvestments: number;
  totalDebt: number;
  netDebt: number;
}

export interface FmpHistoricalPrice {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  vwap: number;
  price: number;
}

export interface FmpTechnicalRsi {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi: number;
}

export interface FmpRatio {
  symbol: string;
  date: string;
  fiscalYear: string;
  period: string;
  reportedCurrency: string;
  grossProfitMargin?: number;
  ebitMargin?: number;
  ebitdaMargin?: number;
  operatingProfitMargin?: number;
  pretaxProfitMargin?: number;
  continuousOperationsProfitMargin?: number;
  netProfitMargin?: number;
  bottomLineProfitMargin?: number;
  priceToEarningsRatio?: number;
  priceToEarningsGrowthRatio?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  debtToEquityRatio?: number;
}

export interface FmpRawData {
  profile: FmpProfile;
  incomeStatement: FmpIncomeStatement | Record<string, never>;
  balanceSheet: FmpBalanceSheet | Record<string, never>;
  historicalPrices: FmpHistoricalPrice[];
  technicals: FmpTechnicalRsi | Record<string, never>;
}

/**
 * Fetches raw FMP data for a given ticker, including profile, income statement,
 * balance sheet, historical prices (last 200 days), and technical RSI indicators.
 * Uses FMP Stable API endpoints and merges key metrics/ratios for backwards compatibility.
 */
export async function fetchFmpData(ticker: string): Promise<FmpRawData | null> {
  try {
    const [profileResData, incomeResData, balanceResData, histResData, rsiResData, ratiosResData] =
      await Promise.all([
        executeFmpRequest<FmpProfile[]>("/profile", { symbol: ticker }),
        executeFmpRequest<FmpIncomeStatement[]>("/income-statement", { symbol: ticker, limit: 1 }),
        executeFmpRequest<FmpBalanceSheet[]>("/balance-sheet-statement", { symbol: ticker, limit: 1 }),
        executeFmpRequest<FmpHistoricalPrice[]>("/historical-price-eod/full", { symbol: ticker }),
        executeFmpRequest<FmpTechnicalRsi[]>("/technical-indicators/rsi", { symbol: ticker, periodLength: 14, timeframe: "1day", limit: 1 }),
        executeFmpRequest<FmpRatio[]>("/ratios", { symbol: ticker, limit: 1 }),
      ]);

    if (!profileResData || profileResData.length === 0) return null;

    const ratios: Partial<FmpRatio> =
      ratiosResData && ratiosResData.length > 0 ? ratiosResData[0] : {};

    // Inject PE and Net Margin from ratios endpoint for backward compatibility
    const profile: FmpProfile = {
      ...profileResData[0],
      pe: ratios.priceToEarningsRatio ?? null,
    };

    const incomeStatement: FmpIncomeStatement | Record<string, never> =
      incomeResData && incomeResData.length > 0
        ? {
            ...incomeResData[0],
            netIncomeRatio: ratios.netProfitMargin ?? null,
          }
        : {};

    const balanceSheet: FmpBalanceSheet | Record<string, never> =
      balanceResData && balanceResData.length > 0 ? balanceResData[0] : {};

    // Map historical prices: map 'close' to 'price'
    const historicalPrices: FmpHistoricalPrice[] = (histResData || [])
      .slice(0, 1250)
      .map((p: FmpHistoricalPrice) => ({
        ...p,
        price: p.close,
      }));

    const technicals: FmpTechnicalRsi | Record<string, never> =
      rsiResData && rsiResData.length > 0 ? rsiResData[0] : {};

    return {
      profile,
      incomeStatement,
      balanceSheet,
      historicalPrices,
      technicals,
    };
  } catch (error) {
    if (error instanceof FmpQuotaError) {
      throw error;
    }
    logger.error("Error compiling FMP data payload", {
      ticker,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
