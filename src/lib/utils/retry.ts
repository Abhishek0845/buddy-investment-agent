import { TimeoutError, ApiRateLimitError, ProviderUnavailableError } from "@/lib/errors";
import { logger } from "@/lib/utils/logger";
import { MAX_RETRIES, BACKOFF_DELAY_MS } from "@/lib/config";

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delayMs: number = BACKOFF_DELAY_MS
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const isRetryable =
      error instanceof TimeoutError ||
      error instanceof ApiRateLimitError ||
      error instanceof ProviderUnavailableError;

    if (isRetryable && retries > 0) {
      logger.warn("Operation failed, triggering transient retry boundary", {
        delayMs,
        remainingRetries: retries,
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }

    throw error;
  }
}
