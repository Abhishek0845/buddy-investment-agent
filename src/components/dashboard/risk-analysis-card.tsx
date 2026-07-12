import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CategoryDetail } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, MessageSquare } from "lucide-react";
import { getScoreTheme, normalizeScore } from "@/lib/utils/score-theme";
import { ExplanationText } from "./explanation-renderer";
import { WhyScoreDialog } from "./why-score-dialog";

interface RiskAnalysisCardProps {
  category: CategoryDetail;
  majorRisks?: string[];
  ticker?: string;
  onAskBuddy?: (text: string) => void;
}

export function RiskAnalysisCard({
  category,
  majorRisks = [],
  ticker = "",
  onAskBuddy,
}: RiskAnalysisCardProps) {
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

  return (
    <>
      <Card className="bg-card border border-border shadow-sm h-full flex flex-col justify-between rounded-2xl overflow-hidden">
        <div>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-primary" />
              <CardTitle className="text-foreground text-xs font-bold uppercase tracking-wider">
                Risk Profile
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
          <CardContent className="pt-4 space-y-4">
            {/* Reasoning */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Risk Assessment
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
                  <li className="text-xs text-muted-foreground italic">No risk reasoning summary available.</li>
                )}
              </ul>
            </div>

            {/* Major Risks if present */}
            {majorRisks.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-border/40 mt-2">
                <h4 className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Key Watchlist Threats
                </h4>
                <ul className="space-y-1" role="list">
                  {majorRisks.slice(0, 3).map((risk, idx) => (
                    <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                      <span className="break-words leading-relaxed">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </div>

        {/* Evidence Table & Actions */}
        <div className="mt-auto">
          <div className="px-4 pb-2">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Risk & Solvency Indicators
            </h4>
            {evidence.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden bg-muted/20">
                <Table>
                  <TableHeader className="bg-muted/40 border-border">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold text-muted-foreground py-1.5 h-auto">Indicator</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-muted-foreground py-1.5 h-auto">Value</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-muted-foreground py-1.5 h-auto text-right">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidence.map((item, idx) => (
                      <TableRow key={idx} className="border-border hover:bg-muted/10">
                        <TableCell className="text-xs font-medium text-foreground py-2 break-all">{item.metric}</TableCell>
                        <TableCell className="text-xs text-secondary-foreground py-2 break-all">{item.value}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground text-right py-2 break-all">{item.source}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-xl p-3 text-center">
                No risk signals found.
              </div>
            )}
          </div>

          {/* Action Triggers */}
          {onAskBuddy && (
            <div className="border-t border-border p-3 flex flex-wrap gap-1.5 items-center bg-card/30">
              <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" /> Ask:
              </span>
              <button
                onClick={() => handleAsk("Why is risk score high/low")}
                className="text-[9px] font-semibold px-2 py-0.5 rounded bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
              >
                Why high?
              </button>
              <button
                onClick={() => handleAsk("What is the biggest risk concern")}
                className="text-[9px] font-semibold px-2 py-0.5 rounded bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
              >
                Biggest Concern
              </button>
              <button
                onClick={() => handleAsk("What is the worst case scenario threat")}
                className="text-[9px] font-semibold px-2 py-0.5 rounded bg-card hover:bg-muted border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
              >
                Worst Case
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Score Transparency Popup */}
      <WhyScoreDialog
        isOpen={whyDialogOpen}
        onClose={() => setWhyDialogOpen(false)}
        title="Risk Analysis"
        score={formattedScore}
        whyScore={category.whyScore}
      />
    </>
  );
}
export default RiskAnalysisCard;
