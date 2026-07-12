import { z } from "zod";

export const intentSchema = z.object({
  intent: z.enum(["SINGLE", "MULTI", "FOLLOW_UP", "KNOWLEDGE", "OUT_OF_DOMAIN"]),
  tickers: z.array(z.string().min(1)).max(5).optional().default([]),
  error: z.string().optional().describe("Explanations for private companies or general out-of-domain queries"),
});
export type IntentResponse = z.infer<typeof intentSchema>;

export const whyScoreSchema = z.object({
  positiveFactors: z.array(z.string().min(1)).min(1),
  negativeFactors: z.array(z.string().min(1)).min(1),
  improvementFactors: z.array(z.string().min(1)).min(1),
});

export const newsIntelligenceItemSchema = z.object({
  headline: z.string().min(1),
  url: z.string().min(1),
  source: z.string().min(1),
  summary: z.string().min(1),
  sentiment: z.enum(["Positive", "Negative", "Neutral"]),
  reason: z.string().min(1),
  investmentImpact: z.string().min(1),
  relativeTime: z.string().min(1),
});

export const positionAdviceSchema = z.object({
  recommendation: z.enum(["Buy More", "Hold", "Wait", "Reduce Position", "Exit"]),
  reason: z.string().min(5),
  risk: z.enum(["Low", "Medium", "High"]),
  suggestedAction: z.string().min(5),
}).nullable().optional();

export const thesisSchema = z.object({
  confidenceRationale: z.string().min(5, "Confidence rationale must have details"),
  investmentThesis: z.object({
    keyStrengths: z.array(z.string().min(3)).min(1, "Must list at least 1 key strength"),
    keyWeaknesses: z.array(z.string().min(3)).min(1, "Must list at least 1 key weakness"),
    growthDrivers: z.array(z.string().min(3)).min(1, "Must list at least 1 growth driver"),
    majorRisks: z.array(z.string().min(3)).min(1, "Must list at least 1 major risk"),
    keyWatchlist: z.array(z.string().min(3)).min(1, "Must list at least 1 watchlist item"),
  }),
  categories: z.object({
    fundamentals: z.object({
      reasoning: z.array(z.string().min(3)).min(1, "Must list at least 1 fundamentals reasoning statement"),
      whyScore: whyScoreSchema,
    }),
    technicals: z.object({
      reasoning: z.array(z.string().min(3)).min(1, "Must list at least 1 technicals reasoning statement"),
      whyScore: whyScoreSchema,
    }),
    sentiment: z.object({
      reasoning: z.array(z.string().min(3)).min(1, "Must list at least 1 sentiment reasoning statement"),
      whyScore: whyScoreSchema,
    }),
    risk: z.object({
      reasoning: z.array(z.string().min(3)).min(1, "Must list at least 1 risk reasoning statement"),
      whyScore: whyScoreSchema,
    }),
  }),
  whyScore: whyScoreSchema,
  recommendationDecision: z.enum(["Invest", "Hold / Wait", "Pass"]),
  decisionExplanation: z.object({
    why: z.string().min(1),
    riskLevel: z.enum(["Low", "Medium", "High"]),
    suits: z.string().min(1),
    timeHorizon: z.string().min(1),
    confidence: z.enum(["Low", "Medium", "High"]),
  }),
  valuationStatus: z.enum(["Undervalued", "Fair Value", "Overvalued"]),
  investmentHorizon: z.string().min(1),
  suitableFor: z.array(z.string().min(1)).min(1),
  expectedVolatility: z.enum(["Low", "Medium", "High"]),
  portfolioSuitability: z.object({
    longTerm: z.boolean(),
    sip: z.boolean(),
    dividend: z.boolean(),
    growth: z.boolean(),
  }),
  buddyConclusion: z.object({
    financialHighlights: z.array(z.string().min(1)).min(1),
    positiveSignals: z.array(z.string().min(1)).min(1),
    riskFactors: z.array(z.string().min(1)).min(1),
    keyMetricsUsed: z.array(z.string().min(1)).min(1),
  }),
  newsIntelligence: z.array(newsIntelligenceItemSchema),
  investmentMemo: z.object({
    bullCase: z.array(z.string().min(1)).min(1),
    bearCase: z.array(z.string().min(1)).min(1),
    biggestRisk: z.string().min(1),
    bottomLine: z.string().min(1),
  }),
  positionAdvice: positionAdviceSchema,
});
export type ThesisResponse = z.infer<typeof thesisSchema>;

export const agentRequestSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(500, "Message is too long"),
  activeResearchContext: z.any().nullable().optional(),
  dashboardData: z.any().nullable().optional(),
});
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export const portfolioPositionSchema = z.object({
  ticker: z.string().optional().nullable(),
  averagePrice: z.number().optional().nullable(),
  shares: z.number().optional().nullable(),
  isPositionQuery: z.boolean(),
});
export type PortfolioPositionResponse = z.infer<typeof portfolioPositionSchema>;
