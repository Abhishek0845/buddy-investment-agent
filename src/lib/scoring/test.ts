import {
  calculateOverallScore,
  getTier,
  scoreSentimentBaseline,
  calculateMovingAverage,
  calculateConfidence,
} from "./engine";
import { FmpRawData } from "../api/fmp";
import { CategoryScores } from "@/types";

function runTests() {
  console.log("=== Running Scoring Engine Unit Tests ===");

  // 1. Test calculateMovingAverage
  console.log("Testing calculateMovingAverage...");
  const prices = [10, 20, 30, 40, 50];
  const ma = calculateMovingAverage(prices, 3);
  if (ma === 20) {
    console.log("✅ calculateMovingAverage passed");
  } else {
    console.error(`❌ calculateMovingAverage failed: expected 20, got ${ma}`);
  }

  // 2. Test calculateOverallScore
  console.log("Testing calculateOverallScore...");
  const scores: CategoryScores = {
    fund: 8,
    risk: 6,
    sent: 7,
    tech: 9,
  };
  // 8 * 0.4 + 6 * 0.25 + 7 * 0.2 + 9 * 0.15 = 3.2 + 1.5 + 1.4 + 1.35 = 7.45
  const overall = calculateOverallScore(scores);
  if (overall === 7.45) {
    console.log("✅ calculateOverallScore passed");
  } else {
    console.error(
      `❌ calculateOverallScore failed: expected 7.45, got ${overall}`
    );
  }

  // 3. Test getTier
  console.log("Testing getTier...");
  if (
    getTier(9.2) === "Strong Buy" &&
    getTier(7.5) === "Good Potential" &&
    getTier(3.0) === "Pass"
  ) {
    console.log("✅ getTier passed");
  } else {
    console.error(
      `❌ getTier failed: 9.2->${getTier(9.2)} / 7.5->${getTier(7.5)} / 3.0->${getTier(3.0)}`
    );
  }

  // 4. Test scoreSentimentBaseline
  console.log("Testing scoreSentimentBaseline...");
  if (
    scoreSentimentBaseline(6) === 6 &&
    scoreSentimentBaseline(0) === 4 &&
    scoreSentimentBaseline(3) === 5
  ) {
    console.log("✅ scoreSentimentBaseline passed");
  } else {
    console.error(
      `❌ scoreSentimentBaseline failed: 6->${scoreSentimentBaseline(6)}, 0->${scoreSentimentBaseline(0)}, 3->${scoreSentimentBaseline(3)}`
    );
  }

  // 5. Test calculateConfidence
  console.log("Testing calculateConfidence...");
  const mockFmpData: FmpRawData = {
    profile: {
      symbol: "AAPL",
      price: 150,
      marketCap: 2000000000000,
      beta: 1.2,
      lastDividend: 0.88,
      range: "130-180",
      change: 1.5,
      changePercentage: 1.0,
      volume: 50000000,
      averageVolume: 50000000,
      companyName: "Apple Inc.",
      currency: "USD",
      cik: "0000320193",
      isin: "US0378331005",
      cusip: "037833100",
      exchangeFullName: "NASDAQ",
      exchange: "NASDAQ",
      industry: "Consumer Electronics",
      website: "https://apple.com",
      description: "Apple",
      ceo: "Tim Cook",
      sector: "Technology",
      country: "US",
      fullTimeEmployees: "150000",
      phone: "123",
      address: "One Apple Park Way",
      city: "Cupertino",
      state: "CA",
      zip: "95014",
      image: "img",
      ipoDate: "1980",
      defaultImage: false,
      isEtf: false,
      isActivelyTrading: true,
      isAdr: false,
      isFund: false,
      pe: 25,
    },
    incomeStatement: {
      date: "2025-12-31",
      symbol: "AAPL",
      reportedCurrency: "USD",
      cik: "0000320193",
      filingDate: "2026-01-01",
      acceptedDate: "2026-01-01",
      fiscalYear: "2025",
      period: "FY",
      revenue: 300000000000,
      costOfRevenue: 150000000000,
      grossProfit: 150000000000,
      researchAndDevelopmentExpenses: 25000000000,
      generalAndAdministrativeExpenses: 15000000000,
      sellingAndMarketingExpenses: 10000000000,
      sellingGeneralAndAdministrativeExpenses: 25000000000,
      otherExpenses: 0,
      operatingExpenses: 50000000000,
      costAndExpenses: 200000000000,
      netInterestIncome: 0,
      interestIncome: 0,
      interestExpense: 0,
      depreciationAndAmortization: 10000000000,
      ebitda: 110000000000,
      ebit: 100000000000,
      nonOperatingIncomeExcludingInterest: 0,
      operatingIncome: 100000000000,
      totalOtherIncomeExpensesNet: 0,
      incomeBeforeTax: 100000000000,
      incomeTaxExpense: 20000000000,
      netIncomeFromContinuingOperations: 80000000000,
      netIncomeFromDiscontinuedOperations: 0,
      otherAdjustmentsToNetIncome: 0,
      netIncome: 80000000000,
      netIncomeDeductions: 0,
      bottomLineNetIncome: 80000000000,
      eps: 5.0,
      epsDiluted: 5.0,
      weightedAverageShsOut: 16000000000,
      weightedAverageShsOutDil: 16000000000,
      netIncomeRatio: 0.26,
    },
    balanceSheet: {
      date: "2025-12-31",
      symbol: "AAPL",
      reportedCurrency: "USD",
      cik: "0000320193",
      filingDate: "2026-01-01",
      acceptedDate: "2026-01-01",
      fiscalYear: "2025",
      period: "FY",
      cashAndCashEquivalents: 50000000000,
      shortTermInvestments: 50000000000,
      cashAndShortTermInvestments: 100000000000,
      netReceivables: 20000000000,
      accountsReceivables: 20000000000,
      otherReceivables: 0,
      inventory: 5000000000,
      prepaids: 0,
      otherCurrentAssets: 0,
      totalCurrentAssets: 125000000000,
      propertyPlantEquipmentNet: 40000000000,
      goodwill: 0,
      intangibleAssets: 0,
      goodwillAndIntangibleAssets: 0,
      longTermInvestments: 100000000000,
      taxAssets: 0,
      otherNonCurrentAssets: 0,
      totalNonCurrentAssets: 140000000000,
      otherAssets: 0,
      totalAssets: 265000000000,
      totalPayables: 50000000000,
      accountPayables: 50000000000,
      otherPayables: 0,
      accruedExpenses: 0,
      shortTermDebt: 10000000000,
      capitalLeaseObligationsCurrent: 0,
      taxPayables: 0,
      deferredRevenue: 0,
      otherCurrentLiabilities: 0,
      totalCurrentLiabilities: 60000000000,
      longTermDebt: 90000000000,
      capitalLeaseObligationsNonCurrent: 0,
      deferredRevenueNonCurrent: 0,
      deferredTaxLiabilitiesNonCurrent: 0,
      otherNonCurrentLiabilities: 0,
      totalNonCurrentLiabilities: 90000000000,
      otherLiabilities: 0,
      capitalLeaseObligations: 0,
      totalLiabilities: 150000000000,
      treasuryStock: 0,
      preferredStock: 0,
      commonStock: 50000000000,
      retainedEarnings: 65000000000,
      additionalPaidInCapital: 0,
      accumulatedOtherComprehensiveIncomeLoss: 0,
      otherTotalStockholdersEquity: 0,
      totalStockholdersEquity: 115000000000,
      totalEquity: 115000000000,
      minorityInterest: 0,
      totalLiabilitiesAndTotalEquity: 265000000000,
      totalInvestments: 150000000000,
      totalDebt: 100000000000,
      netDebt: 50000000000,
    },
    historicalPrices: [
      {
        symbol: "AAPL",
        date: "2026-07-10",
        open: 150,
        high: 152,
        low: 149,
        close: 150,
        volume: 50000000,
        change: 1,
        changePercent: 0.6,
        vwap: 150.5,
        price: 150,
      },
    ],
    technicals: {
      date: "2026-07-10",
      open: 150,
      high: 152,
      low: 149,
      close: 150,
      volume: 50000000,
      rsi: 55,
    },
  };

  const confidence = calculateConfidence(mockFmpData, 5);
  if (confidence === "High") {
    console.log("✅ calculateConfidence passed");
  } else {
    console.error(
      `❌ calculateConfidence failed: expected High, got ${confidence}`
    );
  }

  console.log("=== Unit Tests Completed ===");
}

runTests();
