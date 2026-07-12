import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
import { BuddyConclusion } from "@/types";

interface EvidenceViewerProps {
  buddyConclusion?: BuddyConclusion;
}

export function EvidenceViewer({ buddyConclusion }: EvidenceViewerProps) {
  if (!buddyConclusion) return null;

  const {
    financialHighlights = [],
    positiveSignals = [],
    riskFactors = [],
    keyMetricsUsed = [],
  } = buddyConclusion;

  return (
    <Card className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mt-6 animate-fadeIn">
      <CardHeader className="flex flex-row items-center gap-2 pb-3 border-b border-border bg-card/40">
        <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
        <CardTitle className="text-foreground text-xs font-bold uppercase tracking-wider">
          Why Buddy Reached This Conclusion
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Highlights */}
          <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-xl">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
              📊 Financial Highlights
            </h4>
            <ul className="space-y-2">
              {financialHighlights.map((item, idx) => (
                <li key={idx} className="text-xs text-secondary-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
              {financialHighlights.length === 0 && (
                <li className="text-xs text-muted-foreground italic">No highlights recorded.</li>
              )}
            </ul>
          </div>

          {/* Positive Signals */}
          <div className="space-y-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-500/10 pb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Positive Signals
            </h4>
            <ul className="space-y-2">
              {positiveSignals.map((item, idx) => (
                <li key={idx} className="text-xs text-secondary-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
              {positiveSignals.length === 0 && (
                <li className="text-xs text-muted-foreground italic">No positive signals recorded.</li>
              )}
            </ul>
          </div>

          {/* Risk Factors */}
          <div className="space-y-3 p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl">
            <h4 className="text-xs font-bold text-rose-600 dark:text-rose-450 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-500/10 pb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Watchlist Risks
            </h4>
            <ul className="space-y-2">
              {riskFactors.map((item, idx) => (
                <li key={idx} className="text-xs text-secondary-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-rose-500 font-bold mt-0.5">⚠️</span>
                  <span>{item}</span>
                </li>
              ))}
              {riskFactors.length === 0 && (
                <li className="text-xs text-muted-foreground italic">No watchlist risks recorded.</li>
              )}
            </ul>
          </div>

          {/* Key Metrics Used */}
          <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-xl">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" /> Key Metrics Used
            </h4>
            <ul className="space-y-2">
              {keyMetricsUsed.map((item, idx) => (
                <li key={idx} className="text-xs text-secondary-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">✦</span>
                  <span>{item}</span>
                </li>
              ))}
              {keyMetricsUsed.length === 0 && (
                <li className="text-xs text-muted-foreground italic">No metrics listed.</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default EvidenceViewer;
