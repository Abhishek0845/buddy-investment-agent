"use client";

import React from "react";
import { Compass, Trophy, Loader2 } from "lucide-react";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyHeader } from "./company-header";
import { RecommendationCard } from "./recommendation-card";
import { ExecutiveSummaryCard } from "./executive-summary-card";
import { StockChart } from "./stock-chart";
import { FinancialAnalysisCard } from "./financial-analysis-card";
import { RiskAnalysisCard } from "./risk-analysis-card";
import { TechnicalAnalysisCard } from "./technical-analysis-card";
import { NewsSentimentCard } from "./news-sentiment-card";
import { EvidenceViewer } from "./evidence-viewer";
import { PositionHealthCard } from "./position-health-card";
import { InvestmentMemoCard } from "./investment-memo-card";
import { useAgentStream } from "@/hooks/use-agent-stream";

export function DashboardContainer() {
  const dashboardData = useDashboardStore((s) => s.dashboardData);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const progressMessage = useDashboardStore((s) => s.progressMessage);
  const { submitPrompt, isGenerating } = useAgentStream();

  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-sm min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl animate-pulse">
        <CardContent className="flex flex-col items-center justify-center space-y-6 max-w-sm text-center">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-foreground">Analyzing Markets...</h3>
            <p className="text-xs text-muted-foreground leading-normal italic">
              &ldquo;{progressMessage || "Gathering filings and news catalysts..."}&rdquo;
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData || !dashboardData.companies || dashboardData.companies.length === 0) {
    const samplePrompts = [
      "Should I invest in Apple?",
      "Compare Tesla and Nvidia",
      "I own 50 shares of Google at $145",
    ];

    return (
      <Card className="border-border bg-card shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-2xl animate-fadeIn">
        <CardContent className="space-y-6 max-w-md">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-primary shadow-sm">
            <Compass className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Start your first analysis
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ask Buddy about any public company, perform comparisons, or get position advisory recommendations for your stock holdings.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground text-left px-1">
              Try asking Buddy
            </p>
            <div className="flex flex-col gap-2">
              {samplePrompts.map((promptText) => (
                <button
                  key={promptText}
                  disabled={isGenerating}
                  onClick={() => submitPrompt(promptText)}
                  className="w-full text-left text-xs font-semibold px-4 py-3 rounded-xl bg-muted hover:bg-elevated border border-border text-foreground hover:text-primary transition-all duration-150 flex items-center justify-between group cursor-pointer disabled:opacity-50"
                >
                  <span>{promptText}</span>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors text-base">&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { companies, winner, type } = dashboardData;

  const renderDashboard = (report: typeof companies[0]) => {
    return (
      <div className="space-y-6 animate-fadeIn select-text">
        {/* 1. Company Header */}
        <CompanyHeader report={report} />

        {/* Winner Highlight for Multi comparison */}
        {type === "MULTI" && winner === report.ticker && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl text-emerald-600 dark:text-emerald-450 text-xs font-semibold">
            <Trophy className="h-4.5 w-4.5 fill-current" />
            <span>This company has the highest quantitative score among the compared group.</span>
          </div>
        )}

        {/* Dynamic Position Advice Advisor Card */}
        {report.positionAdvice && (
          <PositionHealthCard advice={report.positionAdvice} ticker={report.ticker} />
        )}

        {/* 2. Recommendation card */}
        <RecommendationCard
          tier={report.tier}
          overallScore={report.overallScore}
          confidence={report.confidence}
          confidenceRationale={report.confidenceRationale}
          ticker={report.ticker}
          onAskBuddy={submitPrompt}
          valuationStatus={report.valuationStatus}
          investmentHorizon={report.investmentHorizon}
          expectedVolatility={report.expectedVolatility}
          portfolioSuitability={report.portfolioSuitability}
          whyScore={report.whyScore}
          categoryScores={{
            fundamentals: report.categories.fundamentals.score,
            technicals: report.categories.technicals.score,
            sentiment: report.categories.sentiment.score,
            risk: report.categories.risk.score,
          }}
        />

        {/* 3. Executive Summary */}
        <ExecutiveSummaryCard
          thesis={report.investmentThesis}
          ticker={report.ticker}
          onAskBuddy={submitPrompt}
        />

        {/* 4. Stock Chart Visualization */}
        {report.chartData?.historicalPrices && (
          <StockChart prices={report.chartData.historicalPrices} ticker={report.ticker} currency={report.currency} />
        )}

        {/* 5. 3-Column Core Analysis Grid: Fundamentals, Risk, Technicals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FinancialAnalysisCard
            category={report.categories.fundamentals}
            ticker={report.ticker}
            onAskBuddy={submitPrompt}
          />
          <RiskAnalysisCard
            category={report.categories.risk}
            majorRisks={report.investmentThesis.majorRisks}
            ticker={report.ticker}
            onAskBuddy={submitPrompt}
          />
          <TechnicalAnalysisCard
            category={report.categories.technicals}
            ticker={report.ticker}
            onAskBuddy={submitPrompt}
          />
        </div>

        {/* 6. Sentiment Analysis */}
        <NewsSentimentCard
          category={report.categories.sentiment}
          newsIntelligence={report.newsIntelligence}
          ticker={report.ticker}
          onAskBuddy={submitPrompt}
        />

        {/* 7. Investment Memo Summary Sheet */}
        {report.investmentMemo && (
          <InvestmentMemoCard
            memo={report.investmentMemo}
            companyName={report.companyName}
            ticker={report.ticker}
            decision={report.recommendationDecision || "Hold"}
            confidence={report.decisionExplanation?.confidence || "High"}
            targetInvestor={report.decisionExplanation?.suits}
          />
        )}

        {/* 8. Buddy Conclusion & Metrics */}
        <EvidenceViewer
          buddyConclusion={report.buddyConclusion}
        />
      </div>
    );
  };

  // If MULTI-company report, render tabs to easily switch
  if (type === "MULTI" && companies.length > 1) {
    return (
      <div className="space-y-6 select-text">
        <Tabs defaultValue="comparison-report" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted border border-border p-3 rounded-xl">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Comparison Dashboard
              </h3>
              <p className="text-[10px] text-muted-foreground/80">
                Switch between comparative summary and individual company reports
              </p>
            </div>
            <TabsList className="bg-card border border-border p-1 h-auto grid grid-cols-3 sm:flex sm:flex-row gap-1">
              <TabsTrigger
                value="comparison-report"
                className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground flex items-center gap-1.5 justify-center border border-transparent"
              >
                🏆 Comparison
              </TabsTrigger>
              {companies.map((company) => {
                const isWinner = winner === company.ticker;
                return (
                  <TabsTrigger
                    key={company.ticker}
                    value={company.ticker}
                    className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground flex items-center gap-1.5 justify-center border border-transparent"
                  >
                    {company.ticker}
                    {isWinner && <Trophy className="h-3 w-3 text-emerald-500 fill-current" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="comparison-report">
              <Card className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-6 animate-fadeIn">
                <CardContent className="prose dark:prose-invert max-w-none text-sm leading-relaxed space-y-4 select-text">
                  <div className="whitespace-pre-wrap select-text markdown-content">
                    {dashboardData.comparisonSummary ? (
                      dashboardData.comparisonSummary.split("\n").map((line, i) => {
                        if (line.startsWith("###")) {
                          return <h3 key={i} className="text-base font-extrabold text-foreground border-b border-border/60 pb-1 mt-6 first:mt-0">{line.replace("###", "").trim()}</h3>;
                        }
                        if (line.startsWith("* **") || line.startsWith("- **")) {
                          const parts = line.replace(/^[\*\-]\s+/, "").split(/(\*\*.*?\*\*)/g);
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs text-foreground my-2 select-text">
                              <span className="text-primary font-bold mt-0.5">•</span>
                              <span>
                                {parts.map((p, idx) => p.startsWith("**") ? <strong key={idx} className="font-extrabold text-foreground">{p.replace(/\*\*/g, "")}</strong> : p)}
                              </span>
                            </div>
                          );
                        }
                        if (line.startsWith("**") && line.endsWith("**")) {
                          return <p key={i} className="text-xs font-extrabold text-primary my-3">{line.replace(/\*\*/g, "").trim()}</p>;
                        }
                        if (line.trim() === "") return <div key={i} className="h-2" />;
                        return <p key={i} className="text-xs text-foreground my-1 leading-relaxed select-text">{line}</p>;
                      })
                    ) : (
                      <p className="italic text-muted-foreground text-xs">Generating comparison summary report...</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            {companies.map((company) => (
              <TabsContent key={company.ticker} value={company.ticker}>
                {renderDashboard(company)}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    );
  }

  // Otherwise, render the single company dashboard directly
  return renderDashboard(companies[0]);
}
export default DashboardContainer;
