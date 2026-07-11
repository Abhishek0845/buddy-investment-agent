# Future Scope & Product Roadmap

This document outlines features, architectural scaling, and research capabilities slated for future versions.

---

## 1. Data Source Integrations
- **Alternative Data**: Pulling sentiment analysis from Reddit (r/wallstreetbets), Twitter/X financial hashtags, and Google Trends.
- **SEC Filings Parse**: Integrating RAG (Retrieval-Augmented Generation) over parsed PDF 10-K and 10-Q forms via vector databases.
- **Technical Signals**: Gathering SMA/EMA, MACD, and RSI data points using technical indicator libraries.

---

## 2. Advanced Multi-Agent Design
- **Portfolio Analyst Node**: A LangGraph node dedicated to Modern Portfolio Theory (MPT) asset frontier optimization.
- **Audit Node**: An independent LLM node reviewing the core analysis for factual errors, hallucinated figures, or biased commentary before rendering reports.

---

## 3. Scale & Persistence Layer
- **User Authentication**: Securing accounts using NextAuth.js or Clerk.
- **Database Backup**: Saving chat history, custom weighting configurations, and portfolios in PostgreSQL via Supabase or Prisma ORM.
- **Distributed Cache**: Storing financial API responses in Redis to decrease external rate-limit usage and boost response speeds.

---

## 4. Visual Dashboard Extensions
- **Interactive Candlestick Charts**: Switching between simple line charts and advanced charting tools.
- **PDF Report Downloads**: Generating download links for compiled research reports.
