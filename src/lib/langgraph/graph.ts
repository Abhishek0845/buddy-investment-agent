import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import {
  intentRouterNode,
  mapReduceFetchNode,
  qaNode,
  rejectNode,
} from "./nodes";

function routeIntent(state: typeof AgentState.State) {
  if (state.error) return "reject";
  if (state.intent === "OUT_OF_DOMAIN") return "reject";
  if (state.intent === "FOLLOW_UP" || state.intent === "KNOWLEDGE") return "qa";
  if (state.intent === "SINGLE" || state.intent === "MULTI") {
    if (state.tickers.length > 5) return "reject";
    return "fetch";
  }
  return "reject";
}

const workflow = new StateGraph(AgentState)
  .addNode("intent_router", intentRouterNode)
  .addNode("fetch", mapReduceFetchNode)
  .addNode("qa", qaNode)
  .addNode("reject", rejectNode)
  .addEdge("__start__", "intent_router")
  .addConditionalEdges("intent_router", routeIntent)
  .addEdge("fetch", END)
  .addEdge("qa", END)
  .addEdge("reject", END);

export const app = workflow.compile();
