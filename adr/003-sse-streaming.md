ADR 003: SSE Streaming over HTTP Polling
Decision

Use Server-Sent Events (SSE) for the /api/agent endpoint.
Alternatives Considered

HTTP Polling or WebSockets.
Pros

    Real-time progress updates for the user during long-running operations.
    Unidirectional communication is simpler and more secure than WebSockets.
    Better developer experience for streaming tokens in Next.js App Router.

Cons

    Does not bypass serverless execution time limits (e.g., Vercel 10s/60s timeout).

Final Choice

SSE Streaming.
Reasoning

The agent workflow takes 15-30 seconds. A loading spinner provides poor UX. SSE allows us to stream intent detection, API fetching progress, and final dashboard data directly to the client. If we hit Vercel timeouts, we will mitigate by deploying to Render/Railway or upgrading to Vercel Pro.