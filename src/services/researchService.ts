import { fetchFmpData, FmpHistoricalPrice } from "@/lib/api/fmp";
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

export async function generateCompanyReportData(
  ticker: string
): Promise<Partial<CompanyReport>> {
  // 1. Fetch Data in parallel where independent
  const [fmpData, newsData] = await Promise.all([
    fetchFmpData(ticker),
    fetchFinnhubNews(ticker),
  ]);

  if (!fmpData) {
    throw new Error(`Failed to fetch financial data for ${ticker}`);
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
          value: n.headline,
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
        .slice(0, 180)
        .reverse()
        .map((p: FmpHistoricalPrice) => ({
          date: p.date,
          price: p.price,
          ma50: ma50, // Static line for MVP chart simplicity
          ma200: ma200, // Static line for MVP chart simplicity
        })),
      rsi: [{ date: "Current", value: fmpData.technicals.rsi || 0 }],
    },
  };

  return report;
}
