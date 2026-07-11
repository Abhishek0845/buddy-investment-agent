import { z } from "zod";

// Stock Symbol Validator (1 to 5 alphabetical characters, uppercase)
export const tickerSchema = z
  .string()
  .min(1, "Ticker symbol cannot be empty")
  .max(5, "Ticker symbol too long")
  .regex(/^[A-Za-z0-9.-]+$/, "Invalid symbol characters")
  .transform((val) => val.toUpperCase().trim());

// Stock Search Query
export const searchQuerySchema = z
  .string()
  .min(1, "Search query cannot be empty")
  .max(100, "Search query too long")
  .trim();

// Date Range Validator for historical charts
export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
}).refine((data) => new Date(data.from) <= new Date(data.to), {
  message: "Start date must be before or equal to end date",
  path: ["from"],
});

// Chat message request validator
export const chatRequestSchema = z.object({
  message: z.string().min(1, "Message content cannot be empty").max(4000, "Message content exceeds limit"),
  sessionId: z.string().optional(),
  tickerContext: tickerSchema.optional(),
});

// Custom AI Scoring config weights
export const scoringWeightsSchema = z.object({
  valuation: z.number().min(0).max(1).default(0.2),
  profitability: z.number().min(0).max(1).default(0.2),
  growth: z.number().min(0).max(1).default(0.2),
  solvency: z.number().min(0).max(1).default(0.2),
  momentum: z.number().min(0).max(1).default(0.2),
}).refine(
  (data) => {
    const sum = data.valuation + data.profitability + data.growth + data.solvency + data.momentum;
    // Allow minor floating point inaccuracies
    return Math.abs(sum - 1.0) < 0.001;
  },
  {
    message: "Weights must sum to exactly 1.0",
    path: ["valuation"],
  }
);
