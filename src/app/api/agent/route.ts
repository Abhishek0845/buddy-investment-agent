import { NextRequest, NextResponse } from "next/server";
import { app } from "@/lib/langgraph/graph";
import { getEnv } from "@/lib/validation/env";
import { agentRequestSchema } from "@/lib/schemas/zod";
import { isRateLimited } from "@/lib/security/rateLimiter";
import { logger } from "@/lib/utils/logger";
import crypto from "crypto";

// Ensure environment variables are validated at server startup/module load
getEnv();

const getClientIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const ip = getClientIp(req);

  // 1. Sliding Window Rate Limiting (10 req/min/IP)
  if (isRateLimited(ip)) {
    logger.warn("Rate limit exceeded", { requestId, ip });
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  // 2. Request payload validation using Zod
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logger.warn("Invalid JSON body payload received", { requestId, ip });
    return NextResponse.json(
      { error: "Invalid JSON request payload." },
      { status: 400 }
    );
  }

  const parseResult = agentRequestSchema.safeParse(body);
  if (!parseResult.success) {
    logger.warn("Request parsing validation failed", {
      requestId,
      ip,
      errors: parseResult.error.format(),
    });
    return NextResponse.json(
      { error: "Invalid request payload. Please verify that your search parameters are valid." },
      { status: 400 }
    );
  }

  const { message, activeResearchContext, dashboardData } = parseResult.data;
  logger.info("API request received", {
    requestId,
    ip,
    messageLength: message.length,
  });

  let detectedIntent = "UNKNOWN";
  let companyCount = 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (event === "intent") {
          const intentData = data as { intent?: string; tickers?: string[] };
          detectedIntent = intentData.intent || "UNKNOWN";
          companyCount = intentData.tickers?.length || 0;
        }

        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const initialState = {
          userInput: message,
          intent: null,
          tickers: [],
          dashboardData: dashboardData || null,
          activeResearchContext: activeResearchContext || null,
          error: null,
        };

        logger.info("Starting LangGraph execution", { requestId, ip });
        await app.invoke(initialState, {
          configurable: {
            sendEvent,
            requestId, // pass requestId down to execution configuration
          },
        });

        logger.info("[PIPELINE] Step 7: LangGraph execution complete — sending done event", {
          requestId,
          detectedIntent,
          companyCount,
        });
        sendEvent("done", {});

        const duration = Date.now() - startTime;
        logger.info("[PIPELINE] Step 8: API response complete", {
          requestId,
          ip,
          detectedIntent,
          companyCount,
          durationMs: duration,
          status: 200,
        });

      } catch (err: unknown) {
        const duration = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        
        logger.error("API Agent Stream Execution Error", {
          requestId,
          ip,
          detectedIntent,
          companyCount,
          durationMs: duration,
          error: errMsg,
          status: 500,
        });

        const isQuota = errMsg.includes("QUOTA_LIMIT") || errMsg.includes("quota") || errMsg.includes("Limit Reach");
        const clientMsg = isQuota
          ? "Market data provider quota limit reached. Please upgrade your subscription plan or try again later."
          : "An unexpected internal error occurred during the analysis.";

        sendEvent("error", {
          message: clientMsg,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
