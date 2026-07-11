export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
    ticker?: string;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface MetricScore {
  name: string;
  score: number;       // 0 to 100
  weight: number;      // 0 to 1
  commentary: string;  // Analysis notes
}

export interface ResearchReport {
  id: string;
  ticker: string;
  companyName: string;
  overallScore: number; // Weighted average
  metrics: MetricScore[];
  summary: string;
  recommendation: "BUY" | "STRONG_BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  createdAt: number;
}
