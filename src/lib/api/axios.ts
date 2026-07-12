import axios from "axios";
import {
  TimeoutError,
  ApiRateLimitError,
  ProviderUnavailableError,
  InvalidTickerError,
} from "@/lib/errors";

export function handleAxiosError(error: unknown, url: string): never {
  if (axios.isAxiosError(error)) {
    if (
      axios.isCancel(error) ||
      error.name === "AbortError" ||
      error.code === "ECONNABORTED"
    ) {
      throw new TimeoutError(`Request to ${url} timed out`);
    }

    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        throw new ApiRateLimitError(`API Rate limit exceeded at ${url}`);
      }
      if (status === 404) {
        throw new InvalidTickerError(`Resource not found at ${url}`);
      }
      if (status >= 500) {
        throw new ProviderUnavailableError(`Provider service error ${status} at ${url}`);
      }
    }

    if (error.request && !error.response) {
      throw new ProviderUnavailableError(`Network connection failure to ${url}`);
    }
  }

  if (error instanceof Error && (error.name === "AbortError" || error.message.includes("timeout"))) {
    throw new TimeoutError(`Request to ${url} timed out`);
  }

  throw error;
}
