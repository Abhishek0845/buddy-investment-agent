import { fetchFmpData, FmpHistoricalPrice, searchStocks, FmpQuotaError } from "@/lib/api/fmp";
import { fetchFinnhubNews } from "@/lib/api/finnhub";
import { fetchYahooData } from "@/lib/api/yahoo";
import {
  calculateOverallScore,
  getTier,
  scoreFundamentals,
  scoreRisk,
  scoreTechnicals,
  scoreSentimentBaseline,
  calculateMovingAverage,
  calculateConfidence,
} from "@/lib/scoring/engine";
import { CompanyReport, CategoryScores } from "@/types";
import { ProviderUnavailableError } from "@/lib/errors";
import { logger } from "@/lib/utils/logger";

// Tickers that are known to only work on Yahoo Finance (not FMP free plan)
// These will skip FMP and go straight to Yahoo Finance
const YAHOO_ONLY_PATTERNS = [
  /\.NS$/i,   // Indian NSE
  /\.BO$/i,   // Indian BSE
  /\.L$/i,    // London Stock Exchange
  /\.PA$/i,   // Paris
  /\.DE$/i,   // Frankfurt
  /\.HK$/i,   // Hong Kong
  /\.T$/i,    // Tokyo
  /\.SS$/i,   // Shanghai
  /\.SZ$/i,   // Shenzhen
  /\.KS$/i,   // Korea
  /\.AX$/i,   // Australia
];

function isYahooOnlyTicker(ticker: string): boolean {
  return YAHOO_ONLY_PATTERNS.some((pattern) => pattern.test(ticker));
}

export async function generateCompanyReportData(
  ticker: string
): Promise<Partial<CompanyReport>> {
  let targetTicker = ticker;

  // For Indian stocks typed by name, always use NSE suffix for Yahoo Finance
  const nameToNseTicker: Record<string, string> = {
    hdfc: "HDFCBANK.NS",
    hdfcbank: "HDFCBANK.NS",
    icici: "ICICIBANK.NS",
    icicibank: "ICICIBANK.NS",
    reliance: "RELIANCE.NS",
    infosys: "INFY.NS",
    infy: "INFY",            // NYSE listed — FMP supports this
    wipro: "WIPRO.NS",
    tcs: "TCS.NS",
    tatamotors: "TATAMOTORS.NS",
    paytm: "PAYTM.NS",
    sbi: "SBIN.NS",
    axisbank: "AXISBANK.NS",
    kotak: "KOTAKBANK.NS",
    bajajfinance: "BAJFINANCE.NS",
    maruti: "MARUTI.NS",
    sunpharma: "SUNPHARMA.NS",
    drreddy: "DRREDDY.NS",
    hcltech: "HCLTECH.NS",
  };

  const cleanName = ticker.trim().toLowerCase().replace(/\s+/g, "");
  if (nameToNseTicker[cleanName]) {
    targetTicker = nameToNseTicker[cleanName];
  }

  let fmpData: Awaited<ReturnType<typeof fetchFmpData>> = null;
  let newsData: Awaited<ReturnType<typeof fetchFinnhubNews>> = [];

  // Skip FMP entirely for tickers known to need Yahoo Finance
  const skipFmp = isYahooOnlyTicker(targetTicker);

  if (!skipFmp) {
    // 1a. Try FMP first (faster, more structured data for US stocks)
    try {
      const [fmp, news] = await Promise.all([
        fetchFmpData(targetTicker),
        fetchFinnhubNews(targetTicker).catch(() => []),
      ]);
      fmpData = fmp;
      newsData = news;
    } catch (error) {
      if (error instanceof FmpQuotaError) {
        // FMP plan limitation — fall through to Yahoo Finance
        logger.info(`[FMP] Quota/plan error for ${targetTicker} — falling back to Yahoo Finance`);
      } else {
        fmpData = null;
        newsData = [];
      }
    }

    // 1b. FMP search fallback (try different ticker variant)
    if (!fmpData) {
      try {
        const searchResults = await searchStocks(ticker);
        if (searchResults && searchResults.length > 0) {
          const nseCompany = searchResults.find(
            (r) =>
              r.symbol.endsWith(".NS") ||
              r.exchangeShortName?.toUpperCase() === "NSE" ||
              r.stockExchange?.toLowerCase().includes("national stock exchange")
          );
          const resolvedTicker = nseCompany ? nseCompany.symbol : searchResults[0].symbol;
          if (resolvedTicker && resolvedTicker.toUpperCase() !== targetTicker.toUpperCase()) {
            logger.info(`[FMP] Search fallback resolved to ${resolvedTicker}`);
            targetTicker = resolvedTicker;
            const [fmpRetry, newsRetry] = await Promise.all([
              fetchFmpData(targetTicker),
              fetchFinnhubNews(targetTicker).catch(() => []),
            ]);
            fmpData = fmpRetry;
            newsData = newsRetry;
          }
        }
      } catch (e) {
        if (e instanceof FmpQuotaError) {
          logger.info(`[FMP] Quota error on search fallback — will use Yahoo Finance`);
        } else {
          logger.warn("FMP search retry fallback failed", { ticker, error: String(e) });
        }
      }
    }
  } else {
    logger.info(`[Yahoo] Skipping FMP for ${targetTicker} (exchange suffix detected), using Yahoo Finance directly`);
  }

  // 2. Yahoo Finance fallback — supports ALL global stocks
  if (!fmpData) {
    logger.info(`[Yahoo] Fetching ${targetTicker} via Yahoo Finance`);
    try {
      const yahooData = await fetchYahooData(targetTicker);
      if (yahooData) {
        logger.info(`[Yahoo] Successfully fetched data for ${targetTicker}`);
        fmpData = yahooData;
      }
    } catch (yahooError) {
      logger.warn(`[Yahoo] Failed for ${targetTicker}`, {
        error: yahooError instanceof Error ? yahooError.message : String(yahooError),
      });
    }
  }

  if (!fmpData) {
    throw new ProviderUnavailableError(`Failed to fetch financial data for ${targetTicker}`);
  }

  // 3. Calculate scores
  const prices = fmpData.historicalPrices.map((p: FmpHistoricalPrice) => p.price);
  const ma50 = calculateMovingAverage(prices, 50);
  const ma200 = calculateMovingAverage(prices, 200);

  const fundScore = scoreFundamentals(fmpData);
  const riskScore = scoreRisk(fmpData);
  const techScore = scoreTechnicals(fmpData, ma50, ma200);
  const sentScore = scoreSentimentBaseline(newsData.length);

  const categoryScores: CategoryScores = {
    fund: fundScore,
    risk: riskScore,
    tech: techScore,
    sent: sentScore,
  };

  const overallScore = calculateOverallScore(categoryScores);
  const tier = getTier(overallScore);
  const confidence = calculateConfidence(fmpData, newsData.length);

  // 4. Construct Evidence Arrays
  const fundamentalsEvidence = [
    { metric: "P/E Ratio", value: fmpData.profile.pe?.toFixed(2) || "N/A", source: "Market Data" },
    { metric: "Net Margin", value: fmpData.incomeStatement.netIncomeRatio?.toFixed(2) || "N/A", source: "Market Data" },
    { metric: "Revenue", value: fmpData.incomeStatement.revenue?.toLocaleString() || "N/A", source: "Market Data" },
  ];

  const technicalEvidence = [
    { metric: "RSI (14)", value: fmpData.technicals.rsi?.toFixed(2) || "N/A", source: "Calculated" },
    { metric: "50-Day MA", value: ma50.toFixed(2), source: "Calculated" },
    { metric: "200-Day MA", value: ma200.toFixed(2), source: "Calculated" },
  ];

  // 5. Construct Report
  const report: CompanyReport = {
    ticker: targetTicker,
    companyName: fmpData.profile.companyName || targetTicker,
    currency: fmpData.profile.currency || (targetTicker.endsWith(".NS") || targetTicker.endsWith(".BO") ? "INR" : "USD"),
    currentPrice: fmpData.profile.price,
    overallScore,
    tier,
    confidence,
    confidenceRationale: "",
    investmentThesis: {
      keyStrengths: [],
      keyWeaknesses: [],
      growthDrivers: [],
      majorRisks: [],
      keyWatchlist: [],
    },
    categories: {
      fundamentals: {
        score: fundScore,
        reasoning: [],
        evidence: fundamentalsEvidence,
      },
      technicals: {
        score: techScore,
        reasoning: [],
        evidence: technicalEvidence,
      },
      sentiment: {
        score: sentScore,
        reasoning: [],
        evidence: newsData.map((n) => ({
          metric: "News",
          value: `${n.headline} | Summary: ${n.summary}`,
          source: n.url,
        })),
      },
      risk: {
        score: riskScore,
        reasoning: [],
        evidence: [
          { metric: "Beta", value: fmpData.profile.beta?.toFixed(2) || "N/A", source: "Market Data" },
          {
            metric: "Debt/Equity",
            value: (
              (fmpData.balanceSheet.totalDebt || 0) /
              (fmpData.balanceSheet.totalEquity || 1)
            ).toFixed(2),
            source: "Calculated",
          },
        ],
      },
    },
    chartData: {
      historicalPrices: fmpData.historicalPrices
        .slice(0, 1250)
        .reverse()
        .map((p: FmpHistoricalPrice, idx: number, arr: FmpHistoricalPrice[]) => {
          const start50 = Math.max(0, idx - 49);
          const slice50 = arr.slice(start50, idx + 1);
          const ma50Val = slice50.reduce((sum, item) => sum + item.price, 0) / slice50.length;
          const start200 = Math.max(0, idx - 199);
          const slice200 = arr.slice(start200, idx + 1);
          const ma200Val = slice200.reduce((sum, item) => sum + item.price, 0) / slice200.length;
          return {
            date: p.date,
            price: p.price,
            ma50: parseFloat(ma50Val.toFixed(2)),
            ma200: parseFloat(ma200Val.toFixed(2)),
          };
        }),
      rsi: [{ date: "Current", value: fmpData.technicals.rsi || 0 }],
    },
  };

  return report;
}
