import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, MessageSquare } from "lucide-react";

interface ExecutiveSummaryCardProps {
  thesis: {
    keyStrengths: string[];
    keyWeaknesses: string[];
    growthDrivers: string[];
    majorRisks: string[];
    keyWatchlist: string[];
  };
  ticker?: string;
  onAskBuddy?: (text: string) => void;
}

export function ExecutiveSummaryCard({
  thesis,
  ticker = "",
  onAskBuddy,
}: ExecutiveSummaryCardProps) {
  const {
    keyStrengths = [],
    keyWeaknesses = [],
    growthDrivers = [],
    keyWatchlist = [],
  } = thesis || {};

  const handleAsk = (prompt: string) => {
    if (onAskBuddy) {
      onAskBuddy(`${prompt} for ${ticker || "this company"}`);
    }
  };

  return (
    <Card className="bg-card border border-border shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-2 pb-3 border-b border-border">
        <Sparkles className="h-4.5 w-4.5 text-primary" />
        <CardTitle className="text-foreground text-xs font-bold uppercase tracking-wider">
          Executive Research Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Strengths & Weaknesses */}
          <div className="space-y-5">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Core Strengths
              </h4>
              <ul className="space-y-1.5" role="list">
                {keyStrengths.map((str, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span className="break-words leading-relaxed">{str}</span>
                  </li>
                ))}
                {keyStrengths.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">No strengths listed.</li>
                )}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Key Weaknesses
              </h4>
              <ul className="space-y-1.5" role="list">
                {keyWeaknesses.map((weak, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                    <span className="break-words leading-relaxed">{weak}</span>
                  </li>
                ))}
                {keyWeaknesses.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">No weaknesses listed.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Right Column: Drivers, Risks & Watchlist */}
          <div className="space-y-5">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                Catalysts & Growth Drivers
              </h4>
              <ul className="space-y-1.5" role="list">
                {growthDrivers.map((driver, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span className="break-words leading-relaxed">{driver}</span>
                  </li>
                ))}
                {growthDrivers.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">No growth drivers listed.</li>
                )}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-yellow-600 dark:text-yellow-450 uppercase tracking-wider">
                Strategic Watchlist Targets
              </h4>
              <ul className="space-y-1.5" role="list">
                {keyWatchlist.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                    <span className="break-words leading-relaxed">{item}</span>
                  </li>
                ))}
                {keyWatchlist.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">No watchlist items listed.</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Action Triggers */}
        {onAskBuddy && (
          <div className="border-t border-border pt-4 mt-2 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Contextual Actions:
            </span>
            <button
              onClick={() => handleAsk("Explain Recommendation")}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              Explain Recommendation
            </button>
            <button
              onClick={() => handleAsk("Simplify executive summary")}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              Simplify
            </button>
            <button
              onClick={() => handleAsk("Challenge this executive summary")}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              Challenge Conclusion
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export default ExecutiveSummaryCard;
