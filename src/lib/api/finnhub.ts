import axios from "axios";
import { getEnv } from "@/lib/validation/env";

const BASE_URL = "https://finnhub.io/api/v1";

export const finnhubClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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
    console.error("❌ Finnhub API Error:", errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
);

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
    const response = await finnhubClient.get<FinnhubNewsItem[]>("/company-news", {
      params: {
        symbol: ticker,
        from,
        to,
      },
    });
    return response.data.slice(0, 10); // Limit to 10 to preserve context window
  } catch (error) {
    console.error(`[Finnhub] Error fetching news for ${ticker}:`, error);
    return [];
  }
}
