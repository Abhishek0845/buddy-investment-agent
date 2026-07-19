import { ChatOpenAI } from "@langchain/openai";
import { RunnableLambda } from "@langchain/core/runnables";
import { withRetry } from "./retry";
import { ProviderUnavailableError } from "@/lib/errors";
import { logger } from "./logger";

interface LlmError {
  status?: number;
  message?: string;
}

const modelName = process.env.OPENROUTER_MODEL || "DUMMY_MODEL";
const apiKey = process.env.OPENROUTER_API_KEY || "DUMMY_KEY";

// Fail fast if the model is not a free OpenRouter model — this project must remain free.
if (typeof window === "undefined" && modelName !== "DUMMY_MODEL") {
  if (modelName !== "openrouter/free") {
    throw new Error(
      `OPENROUTER_MODEL is set to "${modelName}" which is not the free model. ` +
      `This project must use only free OpenRouter models. Set OPENROUTER_MODEL=openrouter/free`
    );
  }
}

const globalForLlm = globalThis as unknown as {
  llm?: ChatOpenAI;
  llmForResolution?: ChatOpenAI;
};

const openRouterConfig = {
  apiKey,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  maxRetries: 0,
} as const;

// ---------------------------------------------------------------------------
// Markdown-fence stripping for structured output
// ---------------------------------------------------------------------------
// OpenRouter models occasionally wrap their JSON (in tool-call arguments OR
// content) inside ```json ... ``` fences.  LangChain's JsonOutputKeyToolsParser
// calls JSON.parse() directly on those strings, causing:
//   SyntaxError: Unexpected token '`'
//
// Fix: intercept withStructuredOutput on each instance and pipe the raw
// AIMessage through a RunnableLambda that strips fences before the parser runs.
// No prompt, schema, or retry logic is changed.
// ---------------------------------------------------------------------------

/** Strip leading/trailing Markdown code fences from a JSON string. */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/**
 * Monkey-patch withStructuredOutput on a ChatOpenAI instance so that every
 * resulting Runnable preprocesses the raw AIMessage to remove markdown fences
 * from tool-call arguments (tool-calling mode) and from content (json mode)
 * before the output parser attempts JSON.parse().
 */
function patchWithStructuredOutput(instance: ChatOpenAI): ChatOpenAI {
  const original = instance.withStructuredOutput.bind(instance);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (instance as any).withStructuredOutput = function (schema: any, options?: any) {
    const base = original(schema, options);

    // Preprocessor: strip markdown fences from the raw AIMessage before
    // the JsonOutputKeyToolsParser (or any other parser) calls JSON.parse().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preprocessor = RunnableLambda.from((msg: any) => {
      // ── Diagnostic: log the raw AIMessage BEFORE fence-stripping ──────────
      logger.info("[StructuredOutput] Raw AIMessage received (pre-fence-strip)", {
        tool_calls_count: msg?.additional_kwargs?.tool_calls?.length ?? 0,
        first_tool_call_args_preview: msg?.additional_kwargs?.tool_calls?.[0]?.function?.arguments?.slice(0, 300) ?? null,
        content_type: typeof msg?.content,
        content_preview: typeof msg?.content === "string" ? msg.content.slice(0, 300) : null,
        has_fence_in_args: typeof msg?.additional_kwargs?.tool_calls?.[0]?.function?.arguments === "string"
          ? msg.additional_kwargs.tool_calls[0].function.arguments.includes("```")
          : false,
        has_fence_in_content: typeof msg?.content === "string" ? msg.content.includes("```") : false,
      });

      // Tool-calling mode: fences may appear inside function.arguments
      const toolCalls = msg?.additional_kwargs?.tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          if (typeof tc?.function?.arguments === "string") {
            tc.function.arguments = stripMarkdownFences(tc.function.arguments);
          }
        }
      }
      // JSON-mode / content-only responses: fences may appear in content
      if (typeof msg?.content === "string" && msg.content.includes("```")) {
        msg.content = stripMarkdownFences(msg.content);
      }

      // ── Diagnostic: log the AIMessage AFTER fence-stripping ───────────────
      logger.info("[StructuredOutput] AIMessage after fence-strip (pre-parser)", {
        first_tool_call_args_preview: msg?.additional_kwargs?.tool_calls?.[0]?.function?.arguments?.slice(0, 300) ?? null,
        content_preview: typeof msg?.content === "string" ? msg.content.slice(0, 300) : null,
      });

      return msg;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return preprocessor.pipe(base as any);
  };
  return instance;
}

if (!globalForLlm.llm) {
  globalForLlm.llm = patchWithStructuredOutput(
    new ChatOpenAI({
      ...openRouterConfig,
      model: modelName,
      temperature: 0.2,
    })
  );
}

if (!globalForLlm.llmForResolution) {
  globalForLlm.llmForResolution = patchWithStructuredOutput(
    new ChatOpenAI({
      ...openRouterConfig,
      model: modelName,
      temperature: 0.1,
    })
  );
}

export const llm = globalForLlm.llm;
export const llmForResolution = globalForLlm.llmForResolution;

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

      // If the LLM provider returns a 429 quota error, immediately throw a non-retryable error to fail-fast
      if (
        errorDetails.status === 429 ||
        (errorDetails.message && errorDetails.message.includes("429")) ||
        (errorDetails.message && errorDetails.message.toLowerCase().includes("quota"))
      ) {
        const quotaErr = new Error(errorDetails.message || "LLM provider quota exceeded") as Error & {
          status?: number;
          isQuotaError?: boolean;
        };
        quotaErr.status = 429;
        quotaErr.isQuotaError = true;
        throw quotaErr;
      }

      // Map other issues (timeouts, structured output parsing failures)
      // to a retryable ProviderUnavailableError so the retry utility attempts 1 retry.
      // ── Diagnostic: log the ORIGINAL unwrapped error before it is replaced ──
      // This is the only place the real stack trace (including whether the
      // exception came from JsonOutputKeyToolsParser, ZodError, or SyntaxError)
      // is still accessible. After this point it becomes a ProviderUnavailableError.
      logger.error("[LLM Retry] Original error BEFORE wrapping in ProviderUnavailableError", {
        errorClass: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: errorDetails.message,
        isSyntaxError: err instanceof SyntaxError,
        isZodError: (err as Record<string, unknown>)?.constructor?.name === "ZodError" || !!(err as Record<string, unknown>)?._errors,
        looksLikeFenceError: typeof errorDetails.message === "string" && errorDetails.message.includes("`"),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw new ProviderUnavailableError(errorDetails.message || "Generative AI invocation failed");
    }
  }, 1, 1000);
}
