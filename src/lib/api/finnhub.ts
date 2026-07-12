import axios from "axios";
import { getEnv } from "@/lib/validation/env";
import { withRetry } from "@/lib/utils/retry";
import { handleAxiosError } from "./axios";
import { logger } from "@/lib/utils/logger";
import { API_TIMEOUT_MS } from "@/lib/config";

const BASE_URL = "https://finnhub.io/api/v1";

export const finnhubClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT_MS * 2,
});

finnhubClient.interceptors.request.use((config) => {
  const env = getEnv();
  config.headers["X-Finnhub-Token"] = env.FINNHUB_API_KEY;
  return config;
});

finnhubClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMsg =
      error.response?.data?.error ||
      error.message ||
      "Finnhub API request failed";
    logger.error("Finnhub API Error", { error: errorMsg });
    return Promise.reject(new Error(errorMsg));
  }
);

async function executeFinnhubRequest<T>(
  url: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await finnhubClient.get<T>(url, {
        params,
        signal: controller.signal,
      });
      return response.data;
    } catch (error) {
      return handleAxiosError(error, url);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

export interface FinnhubNewsItem {
  headline: string;
  summary: string;
  url: string;
  source: string;
  datetime: number;
}

/**
 * Fetches recent news articles for a given company ticker from Finnhub (last 30 days),
 * capped at 10 items to stay within LLM context window limits.
 */
export async function fetchFinnhubNews(ticker: string): Promise<FinnhubNewsItem[]> {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - 30);

  const to = toDate.toISOString().split("T")[0];
  const from = fromDate.toISOString().split("T")[0];

  try {
    const data = await executeFinnhubRequest<FinnhubNewsItem[]>("/company-news", {
      symbol: ticker,
      from,
      to,
    });
    return data.slice(0, 10); // Limit to 10 to preserve context window
  } catch (error) {
    logger.warn("Finnhub news fetching failed gracefully", {
      ticker,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
