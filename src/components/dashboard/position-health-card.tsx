import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Briefcase, TrendingUp, TrendingDown, Info } from "lucide-react";
import { PositionAdvice } from "@/types";
import { Badge } from "@/components/ui/badge";

interface PositionHealthCardProps {
  advice?: PositionAdvice;
  ticker: string;
}

export function PositionHealthCard({ advice, ticker }: PositionHealthCardProps) {
  if (!advice) return null;

  const {
    recommendation,
    reason,
    averageCost,
    currentPrice,
    gainPercent = 0,
    risk,
    suggestedAction,
    shares,
  } = advice;

  const isProfit = gainPercent >= 0;

  // Visual highlights for recommendation tags
  const getBadgeColors = (rec: string) => {
    switch (rec) {
      case "Buy More":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "Hold":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "Wait":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-450 border-yellow-500/20";
      case "Reduce Position":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "Exit":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Card className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-fadeIn">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-border bg-card/40">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4.5 w-4.5 text-primary" />
          <CardTitle className="text-foreground text-xs font-bold uppercase tracking-wider">
            {ticker} Position Advisor
          </CardTitle>
        </div>
        <Badge variant="outline" className={`px-2.5 py-0.5 rounded-lg border font-semibold text-xs ${getBadgeColors(recommendation)}`}>
          {recommendation}
        </Badge>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Core Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Average Cost</span>
            <p className="text-xs font-extrabold text-foreground">
              {averageCost ? `$${averageCost.toFixed(2)}` : "N/A"}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Current Price</span>
            <p className="text-xs font-extrabold text-foreground">${currentPrice.toFixed(2)}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Gain / Loss</span>
            <p className={`text-xs font-extrabold flex items-center gap-0.5 ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
              {isProfit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{isProfit ? "+" : ""}{gainPercent.toFixed(2)}%</span>
            </p>
          </div>
          {shares && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Shares Owned</span>
              <p className="text-xs font-extrabold text-foreground">{shares}</p>
            </div>
          )}
        </div>

        {/* Advisor Details */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-start gap-2.5 bg-muted/30 border border-border p-3.5 rounded-xl">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground">Buddy Advice Reasoning</span>
              <p className="text-xs text-foreground leading-relaxed">{reason}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Suggested Action</span>
              <p className="text-xs font-bold text-foreground">{suggestedAction}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Position Risk</span>
              <p className="text-xs font-bold text-foreground">{risk}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default PositionHealthCard;
