# API Contracts

This document defines the REST API endpoints and data payloads exchanged between the frontend client and the Next.js backend server.

---

## 1. Stock Lookup & Data Endpoints

### `GET /api/stocks/search?q={query}`
Finds equities matching a search query.
- **Request Parameters**:
  - `q` (string, required): Ticker symbol or name. Minimum 1 character.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "currency": "USD",
      "stockExchange": "Nasdaq Global Select",
      "exchangeShortName": "NASDAQ"
    }
  ]
  ```

### `GET /api/stocks/profile?symbol={symbol}`
Retrieves company profile summary info.
- **Request Parameters**:
  - `symbol` (string, required): 1-5 character ticker.
- **Success Response (200 OK)**:
  ```json
  {
    "symbol": "AAPL",
    "companyName": "Apple Inc.",
    "price": 178.50,
    "marketCap": 2800000000000,
    "industry": "Consumer Electronics",
    "sector": "Technology",
    "website": "https://www.apple.com",
    "description": "Designs, manufactures and markets smartphones, personal computers, tablets...",
    "ceo": "Tim Cook",
    "image": "https://financialmodelingprep.com/image-placeholder/AAPL.png"
  }
  ```

### `GET /api/stocks/quote?symbol={symbol}`
Retrieves real-time market trading numbers.
- **Request Parameters**:
  - `symbol` (string, required): Ticker symbol.
- **Success Response (200 OK)**:
  ```json
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "price": 178.50,
    "changesPercentage": 1.25,
    "change": 2.20,
    "dayLow": 176.10,
    "dayHigh": 179.30,
    "open": 176.50,
    "previousClose": 176.30,
    "volume": 52000000,
    "avgVolume": 65000000,
    "pe": 28.5,
    "eps": 6.26,
    "timestamp": 1718000000
  }
  ```

### `GET /api/stocks/financials?symbol={symbol}&timeframe={timeframe}`
Retrieves historical core statements.
- **Request Parameters**:
  - `symbol` (string, required): Stock ticker.
  - `timeframe` (string, optional): `"1M" | "3M" | "1Y" | "5Y"`. Default is `"1Y"`.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "date": "2025-12-31",
      "revenue": 385000000000,
      "netIncome": 97000000000,
      "operatingIncome": 114000000000,
      "eps": 6.26,
      "ebitda": 125000000000,
      "freeCashFlow": 105000000000
    }
  ]
  ```

---

## 2. Quantitative Scoring Endpoint

### `POST /api/stocks/score`
Calculates stock health scores using customized weights.
- **Request Body**:
  ```json
  {
    "symbol": "AAPL",
    "weights": {
      "valuation": 0.2,
      "profitability": 0.3,
      "growth": 0.2,
      "solvency": 0.1,
      "momentum": 0.2
    }
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ticker": "AAPL",
    "overallScore": 82.5,
    "metrics": [
      {
        "name": "Valuation",
        "score": 65,
        "weight": 0.2,
        "commentary": "P/E ratio is elevated relative to historical averages."
      },
      {
        "name": "Profitability",
        "score": 95,
        "weight": 0.3,
        "commentary": "Outstanding Return on Equity (ROE) and operating margins."
      }
    ],
    "recommendation": "BUY",
    "updatedAt": 1718000000
  }
  ```

---

## 3. Conversational AI Endpoint

### `POST /api/chat`
Submits a query to the AI Research Agent.
- **Request Body**:
  ```json
  {
    "message": "Should I purchase Apple or Microsoft stock right now?",
    "sessionId": "abc123xyz",
    "tickerContext": "AAPL"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "sessionId": "abc123xyz",
    "message": {
      "id": "msg98765",
      "role": "assistant",
      "content": "Based on quantitative health calculations and current valuations...",
      "timestamp": 1718000100,
      "sources": [
        {
          "title": "Apple Q4 Income Statement",
          "ticker": "AAPL"
        }
      ]
    }
  }
  ```
