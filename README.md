# 📈 Buddy: AI Investment Copilot

An intelligent, conversational AI investment research dashboard built to synthesize stock market data, analyze trends, and deliver actionable insights in seconds.

Built with **Next.js**, **LangGraph**, and **Google Gemini**, the application autonomously fetches real-time market data, generates investment theses, and renders dynamic interactive dashboards to help you make informed financial decisions.

## ✨ Features

- **AI-Powered Conversational UI**: Ask natural language questions about public companies, compare stocks, or get advice on existing portfolio positions.
- **Universal Market Support**: Automatically fetches real-time data from **Financial Modeling Prep (FMP)** for US stocks, with a robust native fallback to **Yahoo Finance** for international markets (including Indian NSE/BSE stocks like `TCS.NS`).
- **Interactive Financial Dashboards**: Visualizes historical price trends with `recharts`, including 50-day and 200-day moving averages.
- **Deep Deterministic Analysis**:
  - **Fundamentals**: Evaluates P/E ratios, Net Margins, and Revenue.
  - **Technicals**: Analyzes RSI and Moving Average trends.
  - **Risk Profile**: Calculates Beta, Debt/Equity ratios, and macro volatility.
  - **Sentiment**: Monitors recent news sentiment and market catalysts.
- **Smart Formatting**: Dynamically formats currencies (e.g., `$` for US, `₹` for India) based on the asset's listed exchange.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Tailwind CSS & [shadcn/ui](https://ui.shadcn.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **AI Orchestration**: [LangGraph JS](https://langchain-ai.github.io/langgraphjs/)
- **LLM**: Google Gemini (via `@google/genai`)
- **Data Providers**: Financial Modeling Prep (FMP) & Yahoo Finance

## 🚀 Getting Started

### Prerequisites

Ensure you have Node.js 18+ installed on your machine. You will also need API keys for the services powering the platform.

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/investment-research-agent.git
cd investment-research-agent
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory and add your API keys:

```env
# Required: Get your key from Google AI Studio
GEMINI_API_KEY="your_gemini_api_key_here"

# Required: Get your key from Financial Modeling Prep
FMP_API_KEY="your_fmp_api_key_here"
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start your first analysis!

## 🌍 Deployment

The easiest way to deploy this application is using the [Vercel Platform](https://vercel.com/):

1. Push your code to a GitHub repository.
2. Log into Vercel and import your repository.
3. Add the `GEMINI_API_KEY` and `FMP_API_KEY` to the **Environment Variables** section in the Vercel deployment settings.
4. Click **Deploy**.

## 📝 License

This project is licensed under the MIT License.
