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

export interface CategoryDetail {
  score: number;
  reasoning: string[];
  evidence: EvidenceItem[];
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
}

export type Intent = "SINGLE" | "MULTI" | "FOLLOW_UP" | "KNOWLEDGE" | "OUT_OF_DOMAIN";

export interface DashboardData {
  type: "SINGLE" | "MULTI";
  companies: CompanyReport[];
  winner?: string;
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
  };
  reports: Record<string, ActiveResearchContextReport>;
}
