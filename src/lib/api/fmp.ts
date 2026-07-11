import axios from "axios";
import { getEnv } from "@/lib/validation/env";
import {
  SearchResult,
  StockProfile,
  StockQuote,
  HistoricalBar,
  FinancialMetric,
} from "@/types/stock";

const BASE_URL = "https://financialmodelingprep.com/stable";

export const fmpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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
    console.error("❌ FMP API Error:", errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
);

/**
 * Searches for stock symbols matching the query.
 * FMP stable endpoint: GET /stable/search-symbol?query={query}
 */
export async function searchStocks(query: string): Promise<SearchResult[]> {
  const response = await fmpClient.get<SearchResult[]>("/search-symbol", {
    params: { query },
  });
  return response.data;
}

/**
 * Fetches the company profile summary.
 * FMP stable endpoint: GET /stable/profile?symbol={symbol}
 */
export async function getCompanyProfile(symbol: string): Promise<StockProfile> {
  const response = await fmpClient.get<StockProfile[]>("/profile", {
    params: { symbol },
  });
  if (!response.data || response.data.length === 0) {
    throw new Error(`Company profile not found for symbol: ${symbol}`);
  }
  return response.data[0];
}

/**
 * Fetches the real-time stock quote.
 * FMP stable endpoint: GET /stable/quote?symbol={symbol}
 */
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const response = await fmpClient.get<StockQuote[]>("/quote", {
    params: { symbol },
  });
  if (!response.data || response.data.length === 0) {
    throw new Error(`Stock quote not found for symbol: ${symbol}`);
  }
  return response.data[0];
}

/**
 * Fetches historical daily prices (sorted chronologically: oldest first).
 * FMP stable endpoint: GET /stable/historical-price-eod/full?symbol={symbol}
 */
export async function getHistoricalPrices(
  symbol: string,
  limit: number = 180
): Promise<HistoricalBar[]> {
  const response = await fmpClient.get<FmpHistoricalPrice[]>("/historical-price-eod/full", {
    params: { symbol },
  });
  const historical = response.data || [];
  // Return sliced and reversed (chronological order)
  return historical
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
  const [incomeRes, cashFlowRes, ratiosRes] = await Promise.all([
    fmpClient.get<FMPIncomeStatement[]>("/income-statement", {
      params: { symbol, period, limit },
    }),
    fmpClient.get<FMPCashFlowStatement[]>("/cash-flow-statement", {
      params: { symbol, period, limit },
    }),
    fmpClient.get<FmpRatio[]>("/ratios", {
      params: { symbol, period, limit },
    }),
  ]);

  const incomeStatements = incomeRes.data || [];
  const cashFlowStatements = cashFlowRes.data || [];
  const ratiosData = ratiosRes.data || [];

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
    const [profileRes, incomeRes, balanceRes, histRes, rsiRes, ratiosRes] =
      await Promise.all([
        fmpClient.get<FmpProfile[]>("/profile", { params: { symbol: ticker } }),
        fmpClient.get<FmpIncomeStatement[]>("/income-statement", {
          params: { symbol: ticker, limit: 1 },
        }),
        fmpClient.get<FmpBalanceSheet[]>("/balance-sheet-statement", {
          params: { symbol: ticker, limit: 1 },
        }),
        fmpClient.get<FmpHistoricalPrice[]>("/historical-price-eod/full", {
          params: { symbol: ticker },
        }),
        fmpClient.get<FmpTechnicalRsi[]>("/technical-indicators/rsi", {
          params: { symbol: ticker, periodLength: 14, timeframe: "1day", limit: 1 },
        }),
        fmpClient.get<FmpRatio[]>("/ratios", { params: { symbol: ticker, limit: 1 } }),
      ]);

    if (!profileRes.data || profileRes.data.length === 0) return null;

    const ratios: Partial<FmpRatio> =
      ratiosRes.data && ratiosRes.data.length > 0 ? ratiosRes.data[0] : {};

    // Inject PE and Net Margin from ratios endpoint for backward compatibility
    const profile: FmpProfile = {
      ...profileRes.data[0],
      pe: ratios.priceToEarningsRatio ?? null,
    };

    const incomeStatement: FmpIncomeStatement | Record<string, never> =
      incomeRes.data && incomeRes.data.length > 0
        ? {
            ...incomeRes.data[0],
            netIncomeRatio: ratios.netProfitMargin ?? null,
          }
        : {};

    const balanceSheet: FmpBalanceSheet | Record<string, never> =
      balanceRes.data && balanceRes.data.length > 0 ? balanceRes.data[0] : {};

    // Map historical prices: map 'close' to 'price'
    const historicalPrices: FmpHistoricalPrice[] = (histRes.data || [])
      .slice(0, 200)
      .map((p: FmpHistoricalPrice) => ({
        ...p,
        price: p.close,
      }));

    const technicals: FmpTechnicalRsi | Record<string, never> =
      rsiRes.data && rsiRes.data.length > 0 ? rsiRes.data[0] : {};

    return {
      profile,
      incomeStatement,
      balanceSheet,
      historicalPrices,
      technicals,
    };
  } catch (error) {
    console.error(`[FMP] Error fetching data for ${ticker}:`, error);
    return null;
  }
}
