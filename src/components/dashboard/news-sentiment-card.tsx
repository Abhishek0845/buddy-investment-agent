import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CategoryDetail, NewsIntelligenceItem } from "@/types";
import { MessageSquare, Globe, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getScoreTheme, normalizeScore } from "@/lib/utils/score-theme";
import { ExplanationText } from "./explanation-renderer";
import { WhyScoreDialog } from "./why-score-dialog";
import { Badge } from "@/components/ui/badge";

interface NewsSentimentCardProps {
  category: CategoryDetail;
  newsIntelligence?: NewsIntelligenceItem[];
  ticker?: string;
  onAskBuddy?: (text: string) => void;
}

export function NewsSentimentCard({
  category,
  newsIntelligence = [],
  ticker = "",
  onAskBuddy,
}: NewsSentimentCardProps) {
  const [whyDialogOpen, setWhyDialogOpen] = useState(false);
  const { score, reasoning = [], evidence = [] } = category || {};
  const scoreOutOfTen = normalizeScore(score);
  const formattedScore = scoreOutOfTen.toFixed(1);
  const theme = getScoreTheme(scoreOutOfTen);

  const handleAsk = (prompt: string) => {
    if (onAskBuddy) {
      onAskBuddy(`${prompt} for ${ticker || "this company"}`);
    }
  };

  const getSentimentColors = (sent: string) => {
    if (sent === "Positive") {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (sent === "Negative") {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  };

  const getSentimentIcon = (sent: string) => {
    if (sent === "Positive") return <TrendingUp className="h-3 w-3" />;
    if (sent === "Negative") return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <>
      <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between">
        <div>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-border bg-card/40">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
              <CardTitle className="text-foreground text-xs font-bold uppercase tracking-wider">
                Recent News Intelligence
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWhyDialogOpen(true)}
                className="text-[9px] font-bold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors px-1.5 py-0.5 rounded cursor-pointer"
              >
                Why score?
              </button>
              <span className={`text-sm font-extrabold ${theme.text} bg-card border ${theme.border} px-2 py-0.5 rounded-lg`}>
                {formattedScore}/10.0
              </span>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-6">
            {/* Sentiment Summary reasoning comments */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Sentiment Summary
              </h4>
              <ul className="space-y-3" role="list">
                {reasoning.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <ExplanationText text={item} />
                    </div>
                  </li>
                ))}
                {reasoning.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">No sentiment analysis explanation available.</li>
                )}
              </ul>
            </div>

            {/* Summarized News intelligence cards */}
            <div className="space-y-3 pt-4 border-t border-border/40">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Summarized News Catalysts
              </h4>
              {newsIntelligence.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {newsIntelligence.slice(0, 4).map((item, idx) => {
                    return (
                      <div
                        key={idx}
                        onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                        className="bg-card border border-border p-4.5 rounded-xl flex flex-col justify-between hover:shadow-md hover:border-primary/30 transition-all duration-200 group cursor-pointer space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                          <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Globe className="h-2.5 w-2.5" /> {item.source} • {item.relativeTime}
                          </span>
                          <Badge variant="outline" className={`px-2 py-0.5 rounded-md border text-[9px] font-bold inline-flex items-center gap-1 select-none ${getSentimentColors(item.sentiment)}`}>
                            {getSentimentIcon(item.sentiment)} Impact: {item.sentiment}
                          </Badge>
                        </div>

                        <div className="space-y-2 select-text">
                          <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-relaxed">
                            {item.headline}
                          </h5>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <strong className="text-foreground">What happened:</strong> {item.summary}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <strong className="text-foreground">Why it matters:</strong> {item.reason}
                          </p>
                          <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 p-2.5 rounded-lg flex items-start gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                            <span><strong className="text-foreground">Thesis Impact:</strong> {item.investmentImpact}</span>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                          <span className="text-primary group-hover:underline">
                            Read full article &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : evidence.length > 0 ? (
                // Fallback rendering standard evidence cards
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evidence.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => window.open(item.source, "_blank", "noopener,noreferrer")}
                      className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between hover:shadow-sm hover:border-primary/30 transition-all duration-200 group cursor-pointer"
                    >
                      <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-relaxed line-clamp-2">
                        {item.value}
                      </h5>
                      <span className="text-[10px] text-primary mt-2">Open Article &rarr;</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-xl p-4 text-center">
                  No recent news sentiment catalog records found.
                </div>
              )}
            </div>
          </CardContent>
        </div>

        {/* Action Triggers */}
        {onAskBuddy && (
          <div className="border-t border-border p-3 flex flex-wrap gap-2 items-center bg-card/40 mt-4">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Contextual Actions:
            </span>
            <button
              onClick={() => handleAsk("Explain news sentiment impact")}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              Explain Sentiment
            </button>
            <button
              onClick={() => handleAsk("Simplify news details")}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              Simplify
            </button>
            <button
              onClick={() => handleAsk("Are recent news signals positive or concern areas")}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              Positive or Concern?
            </button>
          </div>
        )}
      </Card>

      {/* Score Transparency Popup */}
      <WhyScoreDialog
        isOpen={whyDialogOpen}
        onClose={() => setWhyDialogOpen(false)}
        title="News & Sentiment"
        score={formattedScore}
        whyScore={category.whyScore}
      />
    </>
  );
}
export default NewsSentimentCard;
