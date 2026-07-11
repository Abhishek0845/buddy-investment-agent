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
});
