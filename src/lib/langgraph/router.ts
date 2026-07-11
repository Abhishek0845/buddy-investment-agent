import { AgentState } from "./state";

export function routeNextNode(state: typeof AgentState.State): string {
  switch (state.intent as string | null) {
    case "SINGLE":
      return "SINGLE";

    case "MULTI":
      return "MULTI";

    case "FOLLOW_UP":
      return "FOLLOW_UP";

    case "KNOWLEDGE":
      return "KNOWLEDGE";

    case "OUT_OF_DOMAIN":
      return "OUT_OF_DOMAIN";

    case "ERROR":
    default:
      return "ERROR";
  }
}