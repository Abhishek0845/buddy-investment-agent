export const API_CONFIG = {
  fmpBaseUrl: "https://financialmodelingprep.com/api/v3",
  finnhubBaseUrl: "https://finnhub.io/api/v1",
  timeoutMs: 15000,
  cacheDurationMs: 1000 * 60 * 10, // 10 minutes for stock profile/financial data cache
  rateLimitLimit: 100, // max requests per window
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes window
};
