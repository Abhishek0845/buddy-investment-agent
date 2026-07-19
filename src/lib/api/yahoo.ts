/**
 * Yahoo Finance Chart API — Universal Stock Data
 * ------------------------------------------------
 * Uses ONLY the /v8/finance/chart endpoint which:
 * - Works for ALL global stocks (US NYSE/NASDAQ, Indian NSE/BSE, European, Asian, etc.)
 * - Requires NO API key and NO authentication
 * - Returns price, meta (company name, exchange, currency) and OHLCV history
 *
 * Used as a fallback when FMP returns 402 (plan limitation).
 */

import { logger } from "@/lib/utils/logger";
import { calculateRSI } from "@/lib/utils/rsi";
import type { FmpRawData } from "./fmp";

const YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";



export async function fetchYahooData(ticker: string): Promise<FmpRawData | null> {
  try {
    logger.info(`[Yahoo] Fetching chart data for ${ticker}`);

    const url = new URL(`${YF_CHART}/${encodeURIComponent(ticker)}`);
    url.searchParams.set("range", "5y");
    url.searchParams.set("interval", "1d");
    url.searchParams.set("includePrePost", "false");
    url.searchParams.set("events", "div,splits");
    url.searchParams.set("ts", Date.now().toString()); // Cache buster

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn(`[Yahoo] HTTP ${res.status} for ${ticker}`);
      return null;
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      logger.warn(`[Yahoo] No chart result for ${ticker}`);
      return null;
    }

    const meta = result.meta ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const closes: number[] = quote.close ?? [];
    const opens: number[] = quote.open ?? [];
    const highs: number[] = quote.high ?? [];
    const lows: number[] = quote.low ?? [];
    const volumes: number[] = quote.volume ?? [];

    if (closes.length === 0) {
      logger.warn(`[Yahoo] No price data returned for ${ticker}`);
      return null;
    }

    // ─── Historical Prices ────────────────────────────────────────────────

    const historicalPrices = timestamps
      .map((ts, i) => {
        const close = closes[i];
        if (close == null || isNaN(close)) return null;
        const date = new Date(ts * 1000).toISOString().split("T")[0];
        const prev = closes[i - 1] ?? close;
        const change = close - prev;
        return {
          symbol: ticker,
          date,
          open: opens[i] ?? close,
          high: highs[i] ?? close,
          low: lows[i] ?? close,
          close,
          volume: volumes[i] ?? 0,
          change,
          changePercent: prev > 0 ? (change / prev) * 100 : 0,
          vwap: close,
          price: close, // backward compat alias
        };
      })
      .filter(Boolean) as FmpRawData["historicalPrices"];

    const latestClose = closes.filter(Boolean).slice(-1)[0] ?? meta.regularMarketPrice ?? 0;
    const closePrices = historicalPrices.map((p) => p.price);
    const rsiValue = calculateRSI(closePrices);
    
    // Reverse to match FMP's descending order expected by the app (index 0 is latest)
    historicalPrices.reverse();

    // ─── Profile (from chart meta) ────────────────────────────────────────

    const companyName: string = meta.longName ?? meta.shortName ?? ticker;
    const currency: string = meta.currency ?? "USD";
    const exchange: string = meta.fullExchangeName ?? meta.exchangeName ?? "";
    const fiftyTwoWeekHigh: number = meta.fiftyTwoWeekHigh ?? 0;
    const fiftyTwoWeekLow: number = meta.fiftyTwoWeekLow ?? 0;
    const currentPrice: number = meta.regularMarketPrice ?? latestClose;
    const volume: number = meta.regularMarketVolume ?? 0;

    const profile: FmpRawData["profile"] = {
      symbol: ticker,
      price: currentPrice,
      marketCap: 0,           // not in chart endpoint
      beta: 0,
      lastDividend: 0,
      range: `${fiftyTwoWeekLow}-${fiftyTwoWeekHigh}`,
      change: meta.regularMarketPrice != null && meta.chartPreviousClose != null
        ? meta.regularMarketPrice - meta.chartPreviousClose
        : 0,
      changePercentage: meta.regularMarketPrice != null && meta.chartPreviousClose != null && meta.chartPreviousClose > 0
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        : 0,
      volume,
      averageVolume: volume,
      companyName,
      currency,
      cik: "",
      isin: "",
      cusip: "",
      exchangeFullName: exchange,
      exchange,
      industry: "",
      website: "",
      description: "",
      ceo: "",
      sector: "",
      country: "",
      fullTimeEmployees: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      image: "",
      ipoDate: "",
      defaultImage: false,
      isEtf: false,
      isActivelyTrading: true,
      isAdr: false,
      isFund: false,
      pe: null,    // not available from chart endpoint
    };

    // ─── Minimal income/balance (zeros — LLM will handle narrative) ────────

    const incomeStatement: FmpRawData["incomeStatement"] = {
      date: new Date().toISOString().split("T")[0],
      symbol: ticker,
      reportedCurrency: currency,
      cik: "", filingDate: "", acceptedDate: "", fiscalYear: "", period: "FY",
      revenue: 0, costOfRevenue: 0, grossProfit: 0,
      researchAndDevelopmentExpenses: 0, generalAndAdministrativeExpenses: 0,
      sellingAndMarketingExpenses: 0, sellingGeneralAndAdministrativeExpenses: 0,
      otherExpenses: 0, operatingExpenses: 0, costAndExpenses: 0,
      netInterestIncome: 0, interestIncome: 0, interestExpense: 0,
      depreciationAndAmortization: 0, ebitda: 0, ebit: 0,
      nonOperatingIncomeExcludingInterest: 0, operatingIncome: 0,
      totalOtherIncomeExpensesNet: 0, incomeBeforeTax: 0, incomeTaxExpense: 0,
      netIncomeFromContinuingOperations: 0, netIncomeFromDiscontinuedOperations: 0,
      otherAdjustmentsToNetIncome: 0, netIncome: 0, netIncomeDeductions: 0,
      bottomLineNetIncome: 0, eps: 0, epsDiluted: 0,
      weightedAverageShsOut: 0, weightedAverageShsOutDil: 0,
      netIncomeRatio: null,
    };

    const balanceSheet: FmpRawData["balanceSheet"] = {
      date: new Date().toISOString().split("T")[0],
      symbol: ticker,
      reportedCurrency: currency,
      cik: "", filingDate: "", acceptedDate: "", fiscalYear: "", period: "FY",
      cashAndCashEquivalents: 0, shortTermInvestments: 0, cashAndShortTermInvestments: 0,
      netReceivables: 0, accountsReceivables: 0, otherReceivables: 0, inventory: 0,
      prepaids: 0, otherCurrentAssets: 0, totalCurrentAssets: 0,
      propertyPlantEquipmentNet: 0, goodwill: 0, intangibleAssets: 0,
      goodwillAndIntangibleAssets: 0, longTermInvestments: 0, taxAssets: 0,
      otherNonCurrentAssets: 0, totalNonCurrentAssets: 0, otherAssets: 0, totalAssets: 0,
      totalPayables: 0, accountPayables: 0, otherPayables: 0, accruedExpenses: 0,
      shortTermDebt: 0, capitalLeaseObligationsCurrent: 0, taxPayables: 0,
      deferredRevenue: 0, otherCurrentLiabilities: 0, totalCurrentLiabilities: 0,
      longTermDebt: 0, capitalLeaseObligationsNonCurrent: 0, deferredRevenueNonCurrent: 0,
      deferredTaxLiabilitiesNonCurrent: 0, otherNonCurrentLiabilities: 0,
      totalNonCurrentLiabilities: 0, otherLiabilities: 0, capitalLeaseObligations: 0,
      totalLiabilities: 0, treasuryStock: 0, preferredStock: 0, commonStock: 0,
      retainedEarnings: 0, additionalPaidInCapital: 0, accumulatedOtherComprehensiveIncomeLoss: 0,
      otherTotalStockholdersEquity: 0, totalStockholdersEquity: 0, totalEquity: 1,
      minorityInterest: 0, totalLiabilitiesAndTotalEquity: 0, totalInvestments: 0,
      totalDebt: 0, netDebt: 0,
    };

    logger.info(`[Yahoo] ✅ Successfully fetched data for ${ticker}`, {
      companyName,
      price: currentPrice,
      currency,
      exchange,
      historicalBars: historicalPrices.length,
      rsi: rsiValue,
    });

    return {
      profile,
      incomeStatement,
      balanceSheet,
      historicalPrices,
      technicals: {
        date: historicalPrices[historicalPrices.length - 1]?.date ?? "",
        open: historicalPrices[historicalPrices.length - 1]?.open ?? 0,
        high: historicalPrices[historicalPrices.length - 1]?.high ?? 0,
        low: historicalPrices[historicalPrices.length - 1]?.low ?? 0,
        close: latestClose,
        volume,
        rsi: rsiValue,
      },
    };
  } catch (error) {
    logger.error(`[Yahoo] fetchYahooData failed for ${ticker}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
