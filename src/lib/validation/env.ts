import { z } from "zod";

const envSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
  GOOGLE_MODEL: z.string().min(1, "GOOGLE_MODEL is required"),
  FMP_API_KEY: z.string().min(1, "FMP_API_KEY is required"),
  FINNHUB_API_KEY: z.string().min(1, "FINNHUB_API_KEY is required"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (parsedEnv) {
    return parsedEnv;
  }

  const isServer = typeof window === "undefined";

  const rawEnv = {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_MODEL: process.env.GOOGLE_MODEL,
    FMP_API_KEY: process.env.FMP_API_KEY,
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  if (!isServer) {
    // Client-side environment - secrets are empty
    return {
      GOOGLE_API_KEY: "",
      GOOGLE_MODEL: "",
      FMP_API_KEY: "",
      FINNHUB_API_KEY: "",
      NODE_ENV:
        (process.env.NODE_ENV as "development" | "production" | "test") ||
        "development",
    };
  }

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = JSON.stringify(result.error.format(), null, 2);
    console.error(
      "❌ CRITICAL ERROR: Environment configuration validation failed:\n",
      errorDetails
    );
    throw new Error(
      `Critical environment variables missing:\n${errorDetails}`
    );
  }

  parsedEnv = result.data;
  return parsedEnv;
}

// Auto-run validation during server initialization
if (typeof window === "undefined") {
  getEnv();
}
