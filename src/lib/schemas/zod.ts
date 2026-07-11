import { z } from "zod";

export const intentSchema = z.object({
  intent: z.enum(["SINGLE", "MULTI", "FOLLOW_UP", "KNOWLEDGE", "OUT_OF_DOMAIN"]),
  tickers: z.array(z.string()).max(5).optional().default([]),
});
export type IntentResponse = z.infer<typeof intentSchema>;

export const thesisSchema = z.object({
  confidenceRationale: z.string(),
  investmentThesis: z.object({
    keyStrengths: z.array(z.string()),
    keyWeaknesses: z.array(z.string()),
    growthDrivers: z.array(z.string()),
    majorRisks: z.array(z.string()),
    keyWatchlist: z.array(z.string()),
  }),
  categories: z.object({
    fundamentals: z.object({ reasoning: z.array(z.string()) }),
    technicals: z.object({ reasoning: z.array(z.string()) }),
    sentiment: z.object({ reasoning: z.array(z.string()) }),
    risk: z.object({ reasoning: z.array(z.string()) }),
  }),
});
export type ThesisResponse = z.infer<typeof thesisSchema>;
