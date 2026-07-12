import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, ChevronRight } from "lucide-react";
import { InvestmentMemo } from "@/types";

interface InvestmentMemoCardProps {
  memo?: InvestmentMemo;
  companyName: string;
  ticker: string;
  decision: string;
  confidence: string;
  targetInvestor?: string;
}

export function InvestmentMemoCard({
  memo,
  companyName,
  ticker,
  decision,
  confidence,
  targetInvestor = "Long-term growth investors",
}: InvestmentMemoCardProps) {
  if (!memo) return null;

  const { bullCase = [], bearCase = [], biggestRisk, bottomLine } = memo;

  return (
    <Card className="bg-card border-2 border-primary/20 rounded-2xl shadow-sm overflow-hidden mt-6">
      <CardHeader className="flex flex-row items-center gap-2 pb-3 border-b border-border bg-primary/5">
        <FileText className="h-4.5 w-4.5 text-primary" />
        <CardTitle className="text-foreground text-xs font-extrabold uppercase tracking-wider">
          📄 Investment Memo
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-6 select-text">
        {/* Memo Header Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/40 border border-border rounded-xl">
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Company</span>
            <p className="text-xs font-extrabold text-foreground">{companyName} ({ticker})</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Recommendation</span>
            <p className="text-xs font-extrabold text-primary">{decision}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Confidence</span>
            <p className="text-xs font-bold text-foreground">{confidence}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Target Investor</span>
            <p className="text-xs font-bold text-foreground">{targetInvestor}</p>
          </div>
        </div>

        {/* Bull vs Bear Cases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bull Case */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-extrabold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider flex items-center gap-1">
              Bull Case
            </h4>
            <ul className="space-y-2" role="list">
              {bullCase.map((bullet, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-start gap-1.5 leading-relaxed">
                  <ChevronRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bear Case */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              Bear Case
            </h4>
            <ul className="space-y-2" role="list">
              {bearCase.map((bullet, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-start gap-1.5 leading-relaxed">
                  <ChevronRight className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Biggest Risk */}
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            ⚠️ Biggest Risk Factor
          </h4>
          <p className="text-xs text-foreground leading-relaxed font-semibold">
            {biggestRisk}
          </p>
        </div>

        {/* Bottom Line */}
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">
            💡 Bottom Line Summary
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/20 border border-border p-3.5 rounded-xl">
            &ldquo;{bottomLine}&rdquo;
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
export default InvestmentMemoCard;
