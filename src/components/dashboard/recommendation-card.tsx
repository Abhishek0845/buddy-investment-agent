import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MessageSquare, HelpCircle, Eye, Check, X } from "lucide-react";
import { getScoreTheme, normalizeScore } from "@/lib/utils/score-theme";
import { WhyScoreDialog } from "./why-score-dialog";
import { WhyScore, PortfolioSuitability } from "@/types";

interface RecommendationCardProps {
  tier: string;
  overallScore: number;
  confidence: string | number;
  confidenceRationale: string;
  ticker?: string;
  onAskBuddy?: (text: string) => void;
  valuationStatus?: "Undervalued" | "Fair Value" | "Overvalued";
  investmentHorizon?: string;
  expectedVolatility?: "Low" | "Medium" | "High";
  portfolioSuitability?: PortfolioSuitability;
  whyScore?: WhyScore;
  categoryScores?: {
    fundamentals: number;
    technicals: number;
    sentiment: number;
    risk: number;
  };
}

export function RecommendationCard({
  tier,
  overallScore,
  confidence,
  confidenceRationale,
  ticker = "",
  onAskBuddy,
  valuationStatus = "Fair Value",
  investmentHorizon = "1–3 years",
  expectedVolatility = "Medium",
  portfolioSuitability = { longTerm: true, sip: true, dividend: false, growth: true },
  whyScore,
  categoryScores,
}: RecommendationCardProps) {
  const [whyDialogOpen, setWhyDialogOpen] = useState(false);

  const scoreOutOfTen = normalizeScore(overallScore);
  const formattedScore = scoreOutOfTen.toFixed(1);
  const theme = getScoreTheme(scoreOutOfTen);

  // Generate stars (1-5 stars scale)
  const starsCount = Math.min(5, Math.max(1, Math.round(scoreOutOfTen / 2)));
  const stars = "★".repeat(starsCount) + "☆".repeat(5 - starsCount);

  // Stamp-style decision calculation
  let decisionStamp: "INVEST" | "HOLD / WAIT" | "PASS" = "HOLD / WAIT";
  let stampColor = "text-yellow-600 dark:text-yellow-450 border-yellow-500/30 bg-yellow-500/5";
  
  if (scoreOutOfTen >= 8.0) {
    decisionStamp = "INVEST";
    stampColor = "text-emerald-500 border-emerald-500/30 bg-emerald-500/5";
  } else if (scoreOutOfTen < 5.5) {
    decisionStamp = "PASS";
    stampColor = "text-rose-500 border-rose-500/30 bg-rose-500/5";
  }

  const confVal = typeof confidence === "number" ? confidence : parseInt(String(confidence)) || 85;
  const confidenceText = confVal >= 80 ? "High Confidence" : confVal >= 55 ? "Medium Confidence" : "Low Confidence";
  const confidenceBadgeColor = confVal >= 80 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

  const handleAsk = (prompt: string) => {
    if (onAskBuddy) {
      onAskBuddy(`${prompt} for ${ticker || "this company"}`);
    }
  };

  const handleOpenChart = () => {
    const el = document.getElementById("stock-chart-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Dispatch custom event to highlight the chart
      window.dispatchEvent(new CustomEvent("highlight-chart", { detail: { ticker } }));
    }
  };

  return (
    <>
      <Card className={`border-2 ${theme.border} ${theme.bg} rounded-2xl shadow-sm overflow-hidden transition-all duration-200`}>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-border bg-card/40">
          <div className="flex items-center gap-2">
            <Trophy className={`h-4.5 w-4.5 ${theme.text}`} />
            <CardTitle className="text-foreground text-xs font-bold uppercase tracking-wider">
              Executive Recommendation
            </CardTitle>
          </div>
          <Badge variant="outline" className={`px-3 py-1 font-semibold text-xs rounded-lg ${theme.bg} ${theme.border} ${theme.text}`}>
            {tier}
          </Badge>
        </CardHeader>

        <CardContent className="pt-6 space-y-6 select-text">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Stamp & Rating Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Premium Stamp Badge */}
              <div className={`flex flex-col items-center justify-center p-3 border-3 border-dashed rounded-2xl w-28 h-24 select-none transform -rotate-2 ${stampColor}`}>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Buddy Says</span>
                <span className="text-lg font-black tracking-tighter mt-1 select-none">{decisionStamp}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  {/* Star rating block */}
                  <span className={`text-lg font-black tracking-tight ${theme.text}`}>{stars}</span>
                  {/* Confidence Badge */}
                  <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded border ${confidenceBadgeColor}`}>
                    {confidenceText}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">{confidenceRationale}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setWhyDialogOpen(true)}
                    className="text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="h-3.5 w-3.5" /> How was this calculated?
                  </button>
                </div>
              </div>
            </div>

            {/* Suitability metrics details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-4 w-full lg:w-auto p-4 bg-card/60 border border-border rounded-2xl">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Valuation</span>
                <p className={`text-xs font-bold ${
                  valuationStatus === "Undervalued" ? "text-emerald-500" : valuationStatus === "Overvalued" ? "text-rose-500" : "text-blue-500"
                }`}>{valuationStatus}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Horizon</span>
                <p className="text-xs font-bold text-foreground">{investmentHorizon}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Volatility</span>
                <p className="text-xs font-bold text-foreground">{expectedVolatility}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Overall Score</span>
                <p className={`text-xs font-black ${theme.text}`}>{formattedScore} / 10</p>
              </div>
            </div>
          </div>

          {/* Portfolio Suitability Checklist */}
          <div className="border-t border-border pt-4 mt-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2.5">
              Investor Suitability
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Long-term investors", active: portfolioSuitability.longTerm },
                { label: "SIP investors", active: portfolioSuitability.sip },
                { label: "Dividend investors", active: portfolioSuitability.dividend },
                { label: "Growth investors", active: portfolioSuitability.growth },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border ${
                    item.active 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-rose-500/10 border-rose-500 text-rose-500"
                  }`}>
                    {item.active ? <Check className="h-3 w-3" /> : <X className="h-2.5 w-2.5" />}
                  </div>
                  <span className="text-xs text-foreground font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contextual Action triggers */}
          {onAskBuddy && (
            <div className="border-t border-border pt-4 mt-2 flex flex-wrap gap-2 items-center select-none justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Contextual Actions:
                </span>
                <button
                  onClick={() => handleAsk("Explain Recommendation")}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
                >
                  Explain recommendation
                </button>
                <button
                  onClick={() => handleAsk("Simplify recommendation thesis")}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
                >
                  Simplify
                </button>
              </div>

              {/* Open Interactive Chart Button */}
              <button
                onClick={handleOpenChart}
                className="text-[10px] font-bold px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/30 transition-all flex items-center gap-1 cursor-pointer animate-pulse"
              >
                <Eye className="h-3 w-3" /> Open Interactive Chart
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weighted Calculation Score Transparency Popup */}
      <WhyScoreDialog
        isOpen={whyDialogOpen}
        onClose={() => setWhyDialogOpen(false)}
        title={ticker || "Overview"}
        score={formattedScore}
        whyScore={whyScore}
        categoryScores={categoryScores}
      />
    </>
  );
}
export default RecommendationCard;
