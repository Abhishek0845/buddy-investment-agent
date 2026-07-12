# Project Stage Summary - Handoff Guide

This document summarizes the current stage, architecture, request pipeline flow, and API state of the AI Investment Agent for the incoming Antigravity agent.

---

## 1. Environment & API Credentials
All API keys are verified and configured in the local workspace environment:
- **Location**: `.env.local`
- **Keys**:
  - `GOOGLE_API_KEY`: Gemini API credential.
  - `FMP_API_KEY`: Financial Modeling Prep API credential.
  - `FINNHUB_API_KEY`: Finnhub API credential.

---

## 2. Shared Core Architecture
The backend is structured around a **LangGraph State Graph** orchestration pipeline, while the frontend handles a persistent, multi-tab workspace environment.

```mermaid
graph TD
    UI[use-agent-stream.ts submitPrompt] -->|Sync UI Update| Msg[Append Msg & Show Loader]
    UI -->|Async Resolve| API_Resolve[/api/resolve]
    API_Resolve -->|Parallel resolveCompany| FMP_Search[FMP Search API]
    API_Resolve -->|Tab Setup| Tab[Switch Tab & Migrate Messages]
    Tab -->|Async POST SSE| API_Agent[/api/agent]
    API_Agent -->|LangGraph app.invoke| Intent[intentRouterNode]
    Intent -->|Deterministic Tickers| Fetch[mapReduceFetchNode]
    Intent -->|No Tickers / Follow-up| QA[qaNode]
    Fetch -->|Parallel FMP Fetches| Report[generateCompanyReportData]
    Report -->|FmpQuotaError Fail Fast| API_Agent
    Fetch -->|Gemini Thesis Synthesis| QA
    QA -->|Llm Response / Fallback| Done[Send done event]
    Fetch -->|FmpQuotaError| Reject[rejectNode]
```

---

## 3. High-Performance Request Pipeline
The message ingestion and execution pipeline has been optimized to eliminate UI sluggishness and blockages:

1. **Immediate UI Update**: When a query is submitted, the prompt is cleared, the user message is appended, and loading states are set **synchronously** inside `src/hooks/use-agent-stream.ts`.
2. **Asynchronous Resolution**: `/api/resolve` is fetched asynchronously in a background promise.
3. **Session Migration**: If the resolved tickers dictate tab creation/switching, the user's message is migrated to the new chat session.
4. **Dynamic Loading Bubble**: The initial assistant message is omitted, allowing `chat-panel.tsx` to automatically render the user-friendly loading bubble when `isGenerating` is true.
5. **Shared Singletons**: Both `nodes.ts` and `companyResolver.ts` import shared Gemini `llm` and `llmForResolution` singletons instantiated on `globalThis` in `src/lib/utils/gemini.ts` to prevent re-initialization.

---

## 4. Rate-Limit & Quota Error Handling (Fail-Fast)
We have implemented robust fail-fast logic for API limit exhaustion to save token budget and prevent delays:

- **Gemini 429**: In `invokeLlmWithRetry`, HTTP 429 or quota limit errors are intercepted and thrown as non-retryable errors. The calling graph node immediately catches them and falls back to deterministic calculations without waiting for retries.
- **FMP Quota Limit**: Intercepted in `src/lib/api/fmp.ts` inside `executeFmpRequest` and `fetchFmpData` to throw a custom `FmpQuotaError` without retry.
- **Immediate Abort**: In `mapReduceFetchNode`, catching an `FmpQuotaError` aborts the graph immediately by throwing a `QUOTA_LIMIT::` error.
- **Friendly Client Message**: Intercepted in `/api/agent` POST stream handler to send a clear `error` event: `"Market data provider quota limit reached. Please upgrade your subscription plan or try again later."`

---

## 5. Verification Status
- **Linter**: `npm run lint` passes cleanly with **0 warnings or errors**.
- **Production Build**: `npm run build` completes successfully. All TypeScript type declarations are correct.
