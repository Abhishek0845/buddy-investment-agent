import React from "react";
import { X, TrendingUp, TrendingDown, RefreshCw, Calculator, HelpCircle } from "lucide-react";
import { WhyScore } from "@/types";

interface WhyScoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  score: string;
  whyScore?: WhyScore;
  categoryScores?: {
    fundamentals: number;
    technicals: number;
    sentiment: number;
    risk: number;
  };
}

export function WhyScoreDialog({
  isOpen,
  onClose,
  title,
  score,
  whyScore,
  categoryScores,
}: WhyScoreDialogProps) {
  if (!isOpen) return null;

  // Read or fall back category scores
  const fundScore = categoryScores?.fundamentals ?? 7.5;
  const techScore = categoryScores?.technicals ?? 7.5;
  const sentScore = categoryScores?.sentiment ?? 7.5;
  const riskScore = categoryScores?.risk ?? 7.5;

  // Calculate weighted contributions
  const fundContr = fundScore * 0.40;
  const riskContr = riskScore * 0.25;
  const techContr = techScore * 0.20;
  const sentContr = sentScore * 0.15;
  
  const sumContr = fundContr + riskContr + techContr + sentContr;

  const positiveFactors = whyScore?.positiveFactors || [
    "Steady revenues and operating scales.",
    "Favorable price momentum relative to long-term averages.",
  ];
  const negativeFactors = whyScore?.negativeFactors || [
    "Macroeconomic adjustments and sector multiple pressures.",
    "Capital reallocation overhead pressure.",
  ];
  const improvementFactors = whyScore?.improvementFactors || [
    "Expanding net operating margins.",
    "Reducing net debt leverage indicators.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      {/* Backdrop close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] relative z-10">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Calculator className="h-4.5 w-4.5 text-primary animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Score Calculator: {title}</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">
                Weighted sum: <span className="text-primary">{score} / 10.0</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Viewport */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* 1. Arithmetic Weights Table */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              ⚖️ Category Weights & Arithmetic
            </h4>
            <div className="border border-border rounded-xl overflow-hidden bg-muted/20 p-4 space-y-3 select-none">
              <div className="grid grid-cols-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
                <span>Category</span>
                <span className="text-center">Score</span>
                <span className="text-center">Weight</span>
                <span className="text-right">Contribution</span>
              </div>
              
              <div className="space-y-2">
                {/* Fundamentals */}
                <div className="grid grid-cols-4 text-xs font-semibold text-foreground items-center">
                  <span>Fundamentals</span>
                  <span className="text-center font-bold">{fundScore.toFixed(1)}</span>
                  <span className="text-center text-muted-foreground">40%</span>
                  <span className="text-right font-bold text-primary">+{fundContr.toFixed(2)}</span>
                </div>
                
                {/* Risk */}
                <div className="grid grid-cols-4 text-xs font-semibold text-foreground items-center">
                  <span>Risk Profile</span>
                  <span className="text-center font-bold">{riskScore.toFixed(1)}</span>
                  <span className="text-center text-muted-foreground">25%</span>
                  <span className="text-right font-bold text-primary">+{riskContr.toFixed(2)}</span>
                </div>
                
                {/* Technicals */}
                <div className="grid grid-cols-4 text-xs font-semibold text-foreground items-center">
                  <span>Technicals</span>
                  <span className="text-center font-bold">{techScore.toFixed(1)}</span>
                  <span className="text-center text-muted-foreground">20%</span>
                  <span className="text-right font-bold text-primary">+{techContr.toFixed(2)}</span>
                </div>
                
                {/* Sentiment */}
                <div className="grid grid-cols-4 text-xs font-semibold text-foreground items-center">
                  <span>News & Sentiment</span>
                  <span className="text-center font-bold">{sentScore.toFixed(1)}</span>
                  <span className="text-center text-muted-foreground">15%</span>
                  <span className="text-right font-bold text-primary">+{sentContr.toFixed(2)}</span>
                </div>
              </div>

              {/* Formula & Total */}
              <div className="border-t border-border pt-2.5 flex items-center justify-between text-xs font-bold text-foreground">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold"><HelpCircle className="h-3 w-3" /> Sum Formula</span>
                <span>{fundContr.toFixed(2)} + {riskContr.toFixed(2)} + {techContr.toFixed(2)} + {sentContr.toFixed(2)} = <span className="text-primary text-sm font-black">{sumContr.toFixed(1)}</span></span>
              </div>
            </div>
          </div>

          {/* 2. Positive Factors */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Largest Positive Drivers
            </h4>
            <ul className="space-y-1.5">
              {positiveFactors.map((f, i) => (
                <li key={i} className="text-xs text-foreground bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 px-3 py-2 rounded-xl flex items-start gap-2">
                  <span className="text-emerald-500 font-bold select-none">✓</span>
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Negative Factors */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-rose-600 dark:text-rose-450 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> Largest Negative Drags
            </h4>
            <ul className="space-y-1.5">
              {negativeFactors.map((f, i) => (
                <li key={i} className="text-xs text-foreground bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 dark:border-rose-500/20 px-3 py-2 rounded-xl flex items-start gap-2">
                  <span className="text-rose-500 font-bold select-none">✗</span>
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Improvement Factors */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin-slow" /> Catalysts for Score Upgrade
            </h4>
            <ul className="space-y-1.5">
              {improvementFactors.map((f, i) => (
                <li key={i} className="text-xs text-foreground bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl flex items-start gap-2">
                  <span className="text-primary font-bold select-none">✦</span>
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-muted hover:bg-elevated border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
export default WhyScoreDialog;
