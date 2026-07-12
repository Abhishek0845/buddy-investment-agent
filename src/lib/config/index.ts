export const API_TIMEOUT_MS = 8000;
export const MAX_RETRIES = 1;
export const BACKOFF_DELAY_MS = 1000;
export const CONCURRENCY_LIMIT = 3;
export const MAX_COMPANIES = 5;
export const FMP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "INFO" : "DEBUG");
export const APP_VERSION = "1.0.0";
