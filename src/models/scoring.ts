import { MetricScore } from "@/types";

export class StockScorer {
  /**
   * Computes the weighted average of metric scores.
   */
  static calculateOverallScore(metrics: MetricScore[]): number {
    if (metrics.length === 0) return 0;
    
    const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
    if (totalWeight === 0) return 0;
    
    const weightedSum = metrics.reduce((sum, m) => sum + m.score * m.weight, 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  /**
   * Resolves overall rating recommendations based on computed score bounds.
   */
  static getRecommendation(score: number): "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" {
    if (score >= 85) return "STRONG_BUY";
    if (score >= 70) return "BUY";
    if (score >= 50) return "HOLD";
    if (score >= 30) return "SELL";
    return "STRONG_SELL";
  }
}
