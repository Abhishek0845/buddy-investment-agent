import { NextRequest } from "next/server";
import { app } from "@/lib/langgraph/graph";
import { DashboardData } from "@/types";

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  console.log("1. Request received");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Initialize state
        const initialState = {
          userInput: message,
          intent: null,
          tickers: [],
          dashboardData: null,
          activeResearchContext: null,
          error: null,
        };

        console.log("2. Starting graph");
        // Run graph with stream mode 'updates'
        const graphStream = await app.stream(initialState, {
          streamMode: "updates",
        });

        for await (const chunk of graphStream) {
          console.log("3. Graph chunk:", chunk);
          // Chunk structure: { nodeName: stateUpdate }
          const nodeName = Object.keys(chunk)[0];
          const stateUpdate = (chunk as Record<string, {
            intent?: string;
            tickers?: string[];
            dashboardData?: DashboardData;
            error?: string | null;
          }>)[nodeName];

          if (nodeName === "intent_router") {
            sendEvent("intent", {
              intent: stateUpdate.intent,
              tickers: stateUpdate.tickers,
            });
            // Simulate progress event for UI
            if (
              stateUpdate.intent === "SINGLE" ||
              stateUpdate.intent === "MULTI"
            ) {
              sendEvent("progress", {
                message: `Resolving and fetching data for ${(stateUpdate.tickers || []).join(
                  ", "
                )}...`,
              });
            }
          }

          if (nodeName === "fetch") {
            sendEvent("progress", {
              message:
                "Calculating deterministic scores and generating thesis...",
            });
            if (stateUpdate.dashboardData) {
              sendEvent("dashboard", stateUpdate.dashboardData as DashboardData);
            }
            if (stateUpdate.error) {
              sendEvent("error", { message: stateUpdate.error });
            }
          }

          if (nodeName === "qa") {
            // Using the temporary CHAT_RESPONSE convention from nodes.ts
            if (
              stateUpdate.error &&
              stateUpdate.error.startsWith("CHAT_RESPONSE::")
            ) {
              const chatText = stateUpdate.error.replace("CHAT_RESPONSE::", "");
              sendEvent("chat", { token: chatText });
            }
          }

          if (nodeName === "reject") {
            if (stateUpdate.error) {
              sendEvent("error", { message: stateUpdate.error });
            }
          }
        }

        sendEvent("done", {});
      } catch (err: unknown) {
        console.error("API Agent Error:", err);
        const errorDetails = err as { code?: string; message?: string } | null;
        if (errorDetails?.code === "insufficient_quota") {
          sendEvent("error", {
            message: "OpenAI API quota exceeded. Please check billing or use another API key.",
          });
        } else {
          sendEvent("error", {
            message: "An unexpected internal error occurred.",
          });
        }
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
