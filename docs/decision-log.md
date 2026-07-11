# Decision Log

This log documents key architectural choices, compromises, and design patterns.

---

## 1. Frame Selection: Next.js 16 (App Router)
- **Status**: Approved.
- **Context**: Deciding on the primary React framework.
- **Decision**: Next.js 16 App Router was selected over standard Vite SPAs.
- **Rationale**:
  - Out-of-the-box support for API Routes (routes running on server side) allows us to proxy external financial APIs (Finnhub and FMP) securely without exposing secret API keys to browser devtools.
  - Turbopack compiler speeds up dev builds.
  - Built-in React Server Components (RSCs) allow us to prerender skeleton structures, improving visual performance.

---

## 2. State Library: Zustand
- **Status**: Approved.
- **Context**: Selecting state manager.
- **Decision**: Adopt Zustand instead of Redux Toolkit or React Context.
- **Rationale**:
  - Redux Toolkit is boilerplate-heavy, which is less ideal for rapid hackathon iteration.
  - React Context triggers global re-renders on context value changes unless carefully optimized.
  - Zustand provides lightweight, hook-based select subscription selectors.
  - Easy state slicing: separating chats, dashboards, and compared panels into separate stores prevents unrelated selector updates.

---

## 3. Runtime Verification: Zod Schemas
- **Status**: Approved.
- **Context**: Enforcing boundaries on user search forms and stock tickers.
- **Decision**: Validate all inputs via explicit Zod schemas at backend and store boundaries.
- **Rationale**:
  - Prevents bad/malicious parameters from triggering expensive LLM runs or wasting FMP/Finnhub rate-limits.
  - Validates environment files on server startup to catch configuration issues early.

---

## 4. UI Kit Styling: Tailwind CSS & shadcn/ui
- **Status**: Approved.
- **Context**: Rapid creation of a dashboard interface.
- **Decision**: Standardize on Tailwind CSS v4 and shadcn/ui.
- **Rationale**:
  - Tailwind v4 uses CSS-first imports instead of heavy JS configuration, reducing compilation times.
  - shadcn/ui outputs copy-paste raw components into our own repository, allowing complete style overrides to design dark-mode charts and glassmorphism.
