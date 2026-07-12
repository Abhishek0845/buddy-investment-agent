import { CompanyReport, WhyScore, NewsIntelligenceItem } from "@/types";

export function generateDeterministicSummary(report: Partial<CompanyReport>): {
  confidenceRationale: string;
  investmentThesis: {
    keyStrengths: string[];
    keyWeaknesses: string[];
    growthDrivers: string[];
    majorRisks: string[];
    keyWatchlist: string[];
  };
  categories: {
    fundamentals: { reasoning: string[]; whyScore: WhyScore };
    technicals: { reasoning: string[]; whyScore: WhyScore };
    sentiment: { reasoning: string[]; whyScore: WhyScore };
    risk: { reasoning: string[]; whyScore: WhyScore };
  };
  whyScore: WhyScore;
  recommendationDecision: "Invest" | "Hold / Wait" | "Pass";
  decisionExplanation: {
    why: string;
    riskLevel: "Low" | "Medium" | "High";
    suits: string;
    timeHorizon: string;
    confidence: "Low" | "Medium" | "High";
  };
  valuationStatus: "Undervalued" | "Fair Value" | "Overvalued";
  investmentHorizon: string;
  suitableFor: string[];
  expectedVolatility: "Low" | "Medium" | "High";
  portfolioSuitability: {
    longTerm: boolean;
    sip: boolean;
    dividend: boolean;
    growth: boolean;
  };
  buddyConclusion: {
    financialHighlights: string[];
    positiveSignals: string[];
    riskFactors: string[];
    keyMetricsUsed: string[];
  };
  newsIntelligence: NewsIntelligenceItem[];
  investmentMemo: {
    bullCase: string[];
    bearCase: string[];
    biggestRisk: string;
    bottomLine: string;
  };
} {
  const ticker = report.ticker || "The company";
  const name = report.companyName || ticker;
  const scoreVal = report.overallScore || 7.0;

  // Extract metrics from evidence
  const findMetricVal = (categoryName: "fundamentals" | "technicals" | "sentiment" | "risk", metricName: string): string => {
    const evidence = report.categories?.[categoryName]?.evidence || [];
    const found = evidence.find(e => e.metric.toLowerCase().includes(metricName.toLowerCase()));
    return found ? found.value : "N/A";
  };

  const peValStr = findMetricVal("fundamentals", "P/E Ratio");
  const marginValStr = findMetricVal("fundamentals", "Net Margin");
  const pe = peValStr !== "N/A" ? parseFloat(peValStr) : NaN;

  const rsiValStr = findMetricVal("technicals", "RSI");
  const rsi = rsiValStr !== "N/A" ? parseFloat(rsiValStr) : NaN;

  const betaValStr = findMetricVal("risk", "Beta");
  const beta = betaValStr !== "N/A" ? parseFloat(betaValStr) : NaN;

  const deValStr = findMetricVal("risk", "Debt/Equity");

  // 1. Fundamentals Assessment in 4-line format
  let fundamentalsReasoning = `**Observation:** ${name} demonstrates trailing net margin of ${marginValStr}.\n**What it means:** Margins show how much of each dollar of sales is kept as profits.\n**Why it matters:** Higher margins suggest a highly profitable business with a strong competitive advantage.\n**What to watch next:** Check if upcoming earnings confirm stable or rising margins.`;
  if (!isNaN(pe)) {
    if (pe > 35) {
      fundamentalsReasoning = `**Observation:** ${name} has a premium P/E ratio of ${pe.toFixed(1)}x.\n**What it means:** A higher price-to-earnings multiple suggests investors expect fast earnings growth.\n**Why it matters:** Premium valuations increase risk if growth slows down or interest rates rise.\n**What to watch next:** Watch upcoming quarterly revenues to see if earnings justify this premium price.`;
    } else if (pe < 15) {
      fundamentalsReasoning = `**Observation:** ${name} has a low P/E ratio of ${pe.toFixed(1)}x.\n**What it means:** A low multiple indicates the stock is selling cheaply relative to its earnings.\n**Why it matters:** Cheap valuation may present a bargain buy, although it can also signal structural issues.\n**What to watch next:** Verify if the discount is temporary or driven by declining market demand.`;
    }
  }

  // 2. Technicals Assessment in 4-line format
  let technicalsReasoning = `**Observation:** Technical moving averages remain in a supportive, stable long-term trend.\n**What it means:** Moving averages track price trends over time to smooth out daily volatility.\n**Why it matters:** Trading above key averages confirms investor confidence remains strong.\n**What to watch next:** Monitor if the price remains supported by the 200-day moving average.`;
  if (!isNaN(rsi)) {
    if (rsi > 70) {
      technicalsReasoning = `**Observation:** The RSI indicator is currently at ${rsi.toFixed(1)} (overbought).\n**What it means:** RSI measures price speed and change, where values over 70 signal excessive buying.\n**Why it matters:** Overbought levels indicate the stock may be due for a temporary pullback or consolidation.\n**What to watch next:** Watch for a return of the RSI to neutral bands between 30 and 70.`;
    } else if (rsi < 30) {
      technicalsReasoning = `**Observation:** The RSI indicator is currently at ${rsi.toFixed(1)} (oversold).\n**What it means:** RSI values under 30 show excessive selling, indicating the stock is potentially cheap.\n**Why it matters:** Oversold levels suggest near-term selling pressure is exhausted, presenting a buying opportunity.\n**What to watch next:** Watch if price action bounces upward from this accumulation zone.`;
    }
  }

  // 3. Risk Assessment in 4-line format
  let riskReasoning = `**Observation:** Leverage and volatility levels appear within standard conservative boundaries.\n**What it means:** These indicators track structural debt ratios and relative price swings vs the market.\n**Why it matters:** Low risk metrics prevent solvency issues and lower overall portfolio volatility.\n**What to watch next:** Watch if capital restructuring or dividend changes impact debt coverage ratios.`;
  if (!isNaN(beta) && beta > 1.5) {
    riskReasoning = `**Observation:** The stock has a high volatility beta coefficient of ${beta.toFixed(2)}.\n**What it means:** Beta measures volatility vs the market. A beta of ${beta.toFixed(2)} means it moves ${((beta - 1) * 100).toFixed(0)}% more than the market.\n**Why it matters:** Higher volatility can boost returns in bull markets but drives steeper drawdowns in market downturns.\n**What to watch next:** Monitor general market sentiments as this stock is highly correlated with major indices.`;
  }

  // 4. Sentiment Assessment in 4-line format
  const headlinesCount = report.categories?.sentiment?.evidence?.length || 0;
  const sentimentReasoning = `**Observation:** Buddy analyzed ${headlinesCount} news articles published over the last 30 days.\n**What it means:** News volume and sentiment show how positive or negative the press is on this asset.\n**Why it matters:** News catalysts drive short-term price momentum and reveal structural challenges.\n**What to watch next:** Monitor press releases and earnings calls for fresh product or regulatory announcements.`;

  // Decision Logic
  let decision: "Invest" | "Hold / Wait" | "Pass" = "Hold / Wait";
  let valStatus: "Undervalued" | "Fair Value" | "Overvalued" = "Fair Value";
  let suitability = { longTerm: true, sip: true, dividend: false, growth: true };
  let decWhy = `${name} is a stable business with solid fundamentals, but wait for a better entry point.`;

  if (scoreVal >= 8.0) {
    decision = "Invest";
    valStatus = "Undervalued";
    suitability = { longTerm: true, sip: true, dividend: true, growth: true };
    decWhy = `${name} exhibits excellent fundamentals, high growth potential, and defensive risk metrics.`;
  } else if (scoreVal < 5.0) {
    decision = "Pass";
    valStatus = "Overvalued";
    suitability = { longTerm: false, sip: false, dividend: false, growth: false };
    decWhy = `${name} shows elevated leverage, volatile momentum, or expensive multiples that increase risk.`;
  }

  const positiveFactors = [
    `Strong earnings history and operating scale for ${name}.`,
    `Favorable price position relative to long-term support bands.`,
  ];
  const negativeFactors = [
    `Susceptibility to macro trends and sector competitors.`,
    `Multiple expansion near historically elevated ranges.`,
  ];
  const improvementFactors = [
    `Margin expansion from operational efficiencies.`,
    `Lowering long-term debt-to-equity leverage.`,
  ];

  const whyScore = {
    positiveFactors,
    negativeFactors,
    improvementFactors,
  };

  const keyStrengths = [
    `Strong business profile and cash flow generation.`,
    `Attractive industry leadership status for ${name}.`,
  ];
  const keyWeaknesses = [
    `Premium multiples increase entry valuation risk.`,
    `Higher capital expenditure requirements.`,
  ];
  const growthDrivers = [
    `Incremental scaling in cloud/AI infrastructure and products.`,
    `Stable long-term market demand dynamics.`,
  ];
  const majorRisks = [
    `Broad macroeconomic pressures and interest rate volatility.`,
    `Aggressive competitors in core business divisions.`,
  ];
  const keyWatchlist = [
    `Monitor next quarterly revenue and margins statement.`,
    `Track moving averages support ranges.`,
  ];

  // News intelligence fallbacks
  const newsIntelligence = (report.categories?.sentiment?.evidence || []).map(n => ({
    headline: n.value || "Company Announcement",
    url: n.source || "https://google.com",
    source: "News Publisher",
    summary: `Announced earnings, product features, or collaborative industry events for ${name}.`,
    sentiment: "Neutral" as const,
    reason: `Represents ongoing corporate milestones and public communications for ${ticker}.`,
    investmentImpact: "Supports overall long-term investment confidence.",
    relativeTime: "Yesterday",
  }));

  return {
    confidenceRationale: `Compiled analysis based on deterministic mathematical models. Overall quantitative score is ${(scoreVal).toFixed(1)}/10.`,
    investmentThesis: {
      keyStrengths,
      keyWeaknesses,
      growthDrivers,
      majorRisks,
      keyWatchlist,
    },
    categories: {
      fundamentals: { reasoning: [fundamentalsReasoning], whyScore },
      technicals: { reasoning: [technicalsReasoning], whyScore },
      sentiment: { reasoning: [sentimentReasoning], whyScore },
      risk: { reasoning: [riskReasoning], whyScore },
    },
    whyScore,
    recommendationDecision: decision,
    decisionExplanation: {
      why: decWhy,
      riskLevel: scoreVal >= 8.0 ? "Low" : scoreVal < 5.0 ? "High" : "Medium",
      suits: scoreVal >= 8.0 ? "Growth and long-term investors" : "Cautious investors seeking entry points",
      timeHorizon: "3-5 Years",
      confidence: "High",
    },
    valuationStatus: valStatus,
    investmentHorizon: "1-3 Years",
    suitableFor: scoreVal >= 8.0 ? ["Growth", "Long-term"] : ["Hold", "Wait"],
    expectedVolatility: scoreVal >= 8.0 ? "Low" : scoreVal < 5.0 ? "High" : "Medium",
    portfolioSuitability: suitability,
    buddyConclusion: {
      financialHighlights: [
        `Net Margins: ${marginValStr}`,
        `P/E Ratio: ${peValStr !== "N/A" ? peValStr + "x" : "N/A"}`,
        `Debt/Equity: ${deValStr}`,
      ],
      positiveSignals: [
        `Stable revenue stream from core operations.`,
        `Market leadership status and cash holdings.`,
      ],
      riskFactors: [
        `Multiple sensitivity to inflation/macro shifts.`,
        `Fierce competitor landscape in technology sector.`,
      ],
      keyMetricsUsed: [
        `P/E Valuation Ratio`,
        `RSI Momentum Indicators`,
        `Beta Market Volatility Coefficient`,
      ],
    },
    newsIntelligence,
    investmentMemo: {
      bullCase: keyStrengths.concat(growthDrivers).slice(0, 3),
      bearCase: keyWeaknesses.concat(majorRisks).slice(0, 3),
      biggestRisk: majorRisks[0] || "Macro correction and valuation multiple compression.",
      bottomLine: `${name} represents a high-quality global standard. However, current prices require patience and phased entries.`,
    },
  };
}

export default generateDeterministicSummary;
