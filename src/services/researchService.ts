import { fetchFmpData, FmpHistoricalPrice, searchStocks, FmpQuotaError } from "@/lib/api/fmp";
import { fetchFinnhubNews } from "@/lib/api/finnhub";
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

export async function generateCompanyReportData(
  ticker: string
): Promise<Partial<CompanyReport>> {
  const companyNameToTickerMap: Record<string, string> = {
    paytm: "PAYTM.NS",
    reliance: "RELIANCE.NS",
    hdfc: "HDFCBANK.NS",
    infosys: "INFY.NS",
    tcs: "TCS.NS",
    wipro: "WIPRO.NS",
    tatamotors: "TATAMOTORS.NS",
    icici: "ICICIBANK.NS",
  };

  let targetTicker = ticker;
  const clean = ticker.trim().toLowerCase();
  if (companyNameToTickerMap[clean]) {
    targetTicker = companyNameToTickerMap[clean];
  }

  // 1. Fetch Data in parallel
  let fmpData: Awaited<ReturnType<typeof fetchFmpData>> = null;
  let newsData: Awaited<ReturnType<typeof fetchFinnhubNews>> = [];
  try {
    const [fmp, news] = await Promise.all([
      fetchFmpData(targetTicker),
      fetchFinnhubNews(targetTicker).catch(() => []),
    ]);
    fmpData = fmp;
    newsData = news;
  } catch (error) {
    if (error instanceof FmpQuotaError) {
      throw error;
    }
    fmpData = null;
    newsData = [];
  }

  // Fallback search retry if first profile lookup failed
  if (!fmpData) {
    logger.info(`Profile fetch failed for ${targetTicker}, retrying with search fallback...`);
    try {
      const searchResults = await searchStocks(ticker);
      if (searchResults && searchResults.length > 0) {
        // Prefer NSE stock first
        const nseCompany = searchResults.find(
          (r) =>
            r.symbol.endsWith(".NS") ||
            r.exchangeShortName?.toUpperCase() === "NSE" ||
            r.stockExchange?.toLowerCase().includes("national stock exchange")
        );
        const resolvedTicker = nseCompany ? nseCompany.symbol : searchResults[0].symbol;
        if (resolvedTicker && resolvedTicker.toUpperCase() !== targetTicker.toUpperCase()) {
          logger.info(`Fallback resolved ticker to ${resolvedTicker}`);
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
        throw e;
      }
      logger.warn("Search retry fallback failed", { ticker, error: String(e) });
    }
  }

  if (!fmpData) {
    throw new ProviderUnavailableError(`Failed to fetch financial data for ${targetTicker}`);
  }

  // 2. Calculate Math & Scores using strongly-typed fields
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

  // 3. Construct Evidence Arrays
  const fundamentalsEvidence = [
    {
      metric: "P/E Ratio",
      value: fmpData.profile.pe?.toFixed(2) || "N/A",
      source: "FMP",
    },
    {
      metric: "Net Margin",
      value: fmpData.incomeStatement.netIncomeRatio?.toFixed(2) || "N/A",
      source: "FMP",
    },
    {
      metric: "Revenue",
      value: fmpData.incomeStatement.revenue?.toLocaleString() || "N/A",
      source: "FMP",
    },
  ];

  const technicalEvidence = [
    {
      metric: "RSI (14)",
      value: fmpData.technicals.rsi?.toFixed(2) || "N/A",
      source: "FMP",
    },
    { metric: "50-Day MA", value: ma50.toFixed(2), source: "Calculated" },
    { metric: "200-Day MA", value: ma200.toFixed(2), source: "Calculated" },
  ];

  // 4. Construct Partial Report (Missing LLM thesis/reasoning)
  const report: Partial<CompanyReport> = {
    ticker: ticker,
    companyName: fmpData.profile.companyName,
    currentPrice: fmpData.profile.price,
    overallScore: overallScore,
    tier: tier,
    confidence: confidence,
    confidenceRationale: "", // To be filled by LLM
    investmentThesis: {
      keyStrengths: [], // To be filled by LLM
      keyWeaknesses: [], // To be filled by LLM
      growthDrivers: [], // To be filled by LLM
      majorRisks: [], // To be filled by LLM
      keyWatchlist: [], // To be filled by LLM
    },
    categories: {
      fundamentals: {
        score: fundScore,
        reasoning: [], // To be filled by LLM
        evidence: fundamentalsEvidence,
      },
      technicals: {
        score: techScore,
        reasoning: [], // To be filled by LLM
        evidence: technicalEvidence,
      },
      sentiment: {
        score: sentScore,
        reasoning: [], // To be filled by LLM
        evidence: newsData.map((n) => ({
          metric: "News",
          value: `${n.headline} | Summary: ${n.summary}`,
          source: n.url,
        })),
      },
      risk: {
        score: riskScore,
        reasoning: [], // To be filled by LLM
        evidence: [
          {
            metric: "Beta",
            value: fmpData.profile.beta?.toFixed(2) || "N/A",
            source: "FMP",
          },
          {
            metric: "Debt/Equity",
            value: (
              (fmpData.balanceSheet.totalDebt || 0) /
              (fmpData.balanceSheet.totalEquity || 1)
            ).toFixed(2),
            source: "FMP",
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
