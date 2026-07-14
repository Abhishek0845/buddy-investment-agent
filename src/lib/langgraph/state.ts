import { Annotation } from "@langchain/langgraph";
import { Intent, DashboardData, ActiveResearchContext } from "@/types";

export const AgentState = Annotation.Root({
  userInput: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  intent: Annotation<Intent | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  tickers: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  dashboardData: Annotation<DashboardData | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  activeResearchContext: Annotation<ActiveResearchContext | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  /**
   * Set by the API route from the frontend payload.
   * True when the current tab already has a completed dashboard loaded.
   * Used by the deterministic pre-router to route to FOLLOW_UP without LLM.
   */
  hasDashboard: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
});
