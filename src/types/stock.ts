export interface StockProfile {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  lastDiv: number;
  range: string;
  changes: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dcfDiff: number;
  dcf: number;
  image: string;
  ipoDate: string;
  defaultImage: boolean;
  isEtf: boolean;
  isActivelyTrading: boolean;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  exchange: string;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
  unadjustedVolume?: number;
  change?: number;
  changePercent?: number;
  vwap?: number;
  label?: string;
  changeOverTime?: number;
}

export interface FinancialMetric {
  date: string;
  revenue: number;
  netIncome: number;
  operatingIncome: number;
  eps: number;
  ebitda: number;
  freeCashFlow: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  currency: string;
  stockExchange: string;
  exchangeShortName: string;
}

export interface CategoryScores {
  fund: number;
  risk: number;
  sent: number;
  tech: number;
}

export interface EvidenceItem {
  metric: string;
  value: string;
  source: string;
}

export interface WhyScore {
  positiveFactors: string[];
  negativeFactors: string[];
  improvementFactors: string[];
}

export interface NewsIntelligenceItem {
  headline: string;
  url: string;
  source: string;
  summary: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  reason: string;
  investmentImpact: string;
  relativeTime: string;
}

export interface DecisionExplanation {
  why: string;
  riskLevel: "Low" | "Medium" | "High";
  suits: string;
  timeHorizon: string;
  confidence: "Low" | "Medium" | "High";
}

export interface PortfolioSuitability {
  longTerm: boolean;
  sip: boolean;
  dividend: boolean;
  growth: boolean;
}

export interface BuddyConclusion {
  financialHighlights: string[];
  positiveSignals: string[];
  riskFactors: string[];
  keyMetricsUsed: string[];
}

export interface InvestmentMemo {
  bullCase: string[];
  bearCase: string[];
  biggestRisk: string;
  bottomLine: string;
}

export interface PositionAdvice {
  recommendation: "Buy More" | "Hold" | "Wait" | "Reduce Position" | "Exit";
  reason: string;
  averageCost?: number;
  currentPrice: number;
  gainPercent?: number;
  risk: "Low" | "Medium" | "High";
  suggestedAction: string;
  shares?: number;
}

export interface CategoryDetail {
  score: number;
  reasoning: string[];
  evidence: EvidenceItem[];
  whyScore?: WhyScore;
}

export interface InvestmentThesis {
  keyStrengths: string[];
  keyWeaknesses: string[];
  growthDrivers: string[];
  majorRisks: string[];
  keyWatchlist: string[];
}

export interface HistoricalPriceData {
  date: string;
  price: number;
  ma50: number;
  ma200: number;
}

export interface RsiData {
  date: string;
  value: number;
}

export interface ChartData {
  historicalPrices: HistoricalPriceData[];
  rsi: RsiData[];
}

export interface CompanyReport {
  ticker: string;
  companyName: string;
  currency?: string;
  currentPrice?: number;
  overallScore: number;
  tier: string;
  confidence: string;
  confidenceRationale: string;
  investmentThesis: InvestmentThesis;
  categories: {
    fundamentals: CategoryDetail;
    technicals: CategoryDetail;
    sentiment: CategoryDetail;
    risk: CategoryDetail;
  };
  chartData: ChartData;
  whyScore?: WhyScore;
  recommendationDecision?: "Invest" | "Hold / Wait" | "Pass";
  decisionExplanation?: DecisionExplanation;
  valuationStatus?: "Undervalued" | "Fair Value" | "Overvalued";
  investmentHorizon?: string;
  suitableFor?: string[];
  expectedVolatility?: "Low" | "Medium" | "High";
  portfolioSuitability?: PortfolioSuitability;
  buddyConclusion?: BuddyConclusion;
  newsIntelligence?: NewsIntelligenceItem[];
  investmentMemo?: InvestmentMemo;
  positionAdvice?: PositionAdvice;
}

export type Intent = "SINGLE" | "MULTI" | "FOLLOW_UP" | "KNOWLEDGE" | "OUT_OF_DOMAIN";

export interface DashboardData {
  type: "SINGLE" | "MULTI";
  companies: CompanyReport[];
  winner?: string;
  comparisonSummary?: string;
}

export interface ActiveResearchContextReport {
  overallScore: number;
  tier: string;
  categoryScores: {
    fund: number;
    tech: number;
    sent: number;
    risk: number;
  };
  thesis: string;
  keyRisks: string[];
}

export interface ActiveResearchContext {
  activeTickers: string[];
  reportType: "SINGLE" | "MULTI";
  conversationMetadata: {
    lastInteraction: string;
    chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  reports: Record<string, CompanyReport>;
  portfolioPositions?: Record<string, {
    ticker: string;
    averagePrice?: number;
    shares?: number;
  }>;
}


