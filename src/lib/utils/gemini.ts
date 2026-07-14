import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { withRetry } from "./retry";
import { ProviderUnavailableError } from "@/lib/errors";

interface LlmError {
  status?: number;
  message?: string;
}

const modelName = process.env.GOOGLE_MODEL || "DUMMY_MODEL";
const apiKey = process.env.GOOGLE_API_KEY || "DUMMY_KEY";

const globalForGemini = globalThis as unknown as {
  llm?: ChatGoogleGenerativeAI;
  llmForResolution?: ChatGoogleGenerativeAI;
};

if (!globalForGemini.llm) {
  globalForGemini.llm = new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey: apiKey,
    temperature: 0.2,
    maxRetries: 0,
  });
}

if (!globalForGemini.llmForResolution) {
  globalForGemini.llmForResolution = new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey: apiKey,
    temperature: 0.1,
    maxRetries: 0,
  });
}

export const llm = globalForGemini.llm;
export const llmForResolution = globalForGemini.llmForResolution;

export async function invokeLlmWithRetry<T>(
  invokeFn: () => Promise<T>
): Promise<T> {
  return withRetry(async () => {
    try {
      return await invokeFn();
    } catch (err: unknown) {
      const errorDetails = err as LlmError;
      
      // Prompt validation (HTTP 400, 401, 403) must fail immediately without retry
      if (errorDetails.status === 400 || errorDetails.status === 401 || errorDetails.status === 403) {
        throw err;
      }

      // If Gemini returns a 429 quota error, immediately throw a non-retryable error to fail-fast
      if (
        errorDetails.status === 429 ||
        (errorDetails.message && errorDetails.message.includes("429")) ||
        (errorDetails.message && errorDetails.message.toLowerCase().includes("quota"))
      ) {
        const quotaErr = new Error(errorDetails.message || "Gemini 429 Quota Exceeded") as Error & {
          status?: number;
          isGeminiQuota?: boolean;
        };
        quotaErr.status = 429;
        quotaErr.isGeminiQuota = true;
        throw quotaErr;
      }

      // Map other issues (timeouts, structured output parsing failures)
      // to a retryable ProviderUnavailableError so the retry utility attempts 1 retry.
      throw new ProviderUnavailableError(errorDetails.message || "Generative AI invocation failed");
    }
  }, 1, 1000);
}

