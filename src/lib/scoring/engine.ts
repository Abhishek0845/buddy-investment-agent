import { FmpRawData } from "@/lib/api/fmp";
import { CategoryScores } from "@/types";
import { SCORING_THRESHOLDS } from "@/lib/config/scoring";

export function calculateOverallScore(scores: CategoryScores): number {
  const { weights } = SCORING_THRESHOLDS;
  return parseFloat(
    (
      scores.fund * weights.fundamentals +
      scores.risk * weights.risk +
      scores.sent * weights.sentiment +
      scores.tech * weights.technicals
    ).toFixed(2)
  );
}

export function getTier(score: number): string {
  const { tiers, defaultRating } = SCORING_THRESHOLDS;
  for (const tier of tiers) {
    if (score >= tier.threshold) {
      return tier.rating;
    }
  }
  return defaultRating;
}

export function scoreFundamentals(data: FmpRawData): number {
  const { fundamentals, baseScores } = SCORING_THRESHOLDS;
  let score = baseScores.fundamentals;
  const income = data.incomeStatement;
  const profile = data.profile;

  const peRatio = profile.pe;
  if (peRatio !== null && peRatio !== undefined && peRatio > 0) {
    if (peRatio < fundamentals.peLow) score += fundamentals.peLowBonus;
    else if (peRatio > fundamentals.peHigh) score += fundamentals.peHighPenalty;
  }

  const netMargin = income.netIncomeRatio;
  if (netMargin !== null && netMargin !== undefined) {
    if (netMargin > fundamentals.marginHigh) score += fundamentals.marginHighBonus;
    else if (netMargin < fundamentals.marginLow) score += fundamentals.marginLowPenalty;
  }

  if (income.revenue > fundamentals.revenueMin) score += fundamentals.revenueBonus;
  return Math.max(1, Math.min(10, parseFloat(score.toFixed(2))));
}

export function scoreRisk(data: FmpRawData): number {
  const { risk, baseScores } = SCORING_THRESHOLDS;
  let score = baseScores.risk;
  const profile = data.profile;
  const balance = data.balanceSheet;

  const beta = profile.beta;
  if (beta !== null && beta !== undefined) {
    if (beta < risk.betaLow) score += risk.betaLowBonus;
    else if (beta > risk.betaHigh) score += risk.betaHighPenalty;
  }

  const totalDebt = balance.totalDebt || 0;
  const totalEquity = balance.totalEquity || 0;
  if (totalEquity > 0) {
    const deRatio = totalDebt / totalEquity;
    if (deRatio < risk.deLow) score += risk.deLowBonus;
    else if (deRatio > risk.deHigh) score += risk.deHighPenalty;
  }

  return Math.max(1, Math.min(10, parseFloat(score.toFixed(2))));
}

export function scoreTechnicals(
  data: FmpRawData,
  ma50: number,
  ma200: number
): number {
  const { technicals, baseScores } = SCORING_THRESHOLDS;
  let score = baseScores.technicals;
  const tech = data.technicals;
  const prices = data.historicalPrices;

  if (tech.rsi !== undefined) {
    const rsi = tech.rsi;
    if (rsi < technicals.rsiLow) score += technicals.rsiLowBonus;
    else if (rsi > technicals.rsiHigh) score += technicals.rsiHighPenalty;
  }

  if (prices.length > 0 && ma200 > 0) {
    const currentPrice = prices[0].price;
    if (currentPrice > ma200) score += technicals.ma200Bonus;
    else score += technicals.ma200Penalty;
  }

  return Math.max(1, Math.min(10, parseFloat(score.toFixed(2))));
}

export function scoreSentimentBaseline(newsCount: number): number {
  const { sentiment, baseScores } = SCORING_THRESHOLDS;
  let score = baseScores.sentiment;
  if (newsCount > sentiment.newsHighCount) score += sentiment.newsHighBonus;
  if (newsCount === sentiment.newsZeroCount) score += sentiment.newsZeroPenalty;
  return Math.max(1, Math.min(10, parseFloat(score.toFixed(2))));
}

// Helper for MA calculation
export function calculateMovingAverage(
  prices: number[],
  period: number
): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(0, period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * Calculates a deterministic confidence score for the analysis.
 * Returns "High", "Medium", or "Low" depending on the completeness of
 * FMP data fields and Finnhub news coverage.
 */
export function calculateConfidence(
  data: FmpRawData,
  newsCount: number
): "High" | "Medium" | "Low" {
  let score = 100;

  // 1. Check data availability
  if (data.technicals.rsi === undefined || data.technicals.rsi === null) {
    score -= 20;
  }

  if (data.profile.pe === undefined || data.profile.pe === null) {
    score -= 15;
  }

  const totalEquity = data.balanceSheet.totalEquity || 0;
  if (totalEquity <= 0) {
    score -= 15;
  }

  // 2. Check news density
  if (newsCount === 0) {
    score -= 25;
  } else if (newsCount < 3) {
    score -= 10;
  }

  // 3. Risk boundary checks
  const beta = data.profile.beta || 1.0;
  if (beta > 2.0) {
    score -= 10;
  }

  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}
