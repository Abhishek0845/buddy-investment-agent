import React from "react";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { Check, Loader2 } from "lucide-react";

export function ProgressTracker() {
  const progressSteps = useDashboardStore((s) => s.progressSteps);
  const isFetchingData = useDashboardStore((s) => s.isFetchingData);

  // If fetching has started but no steps have been recorded yet, show initialization state
  if (isFetchingData && progressSteps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-3 bg-muted border border-border rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">Initializing copilot...</span>
      </div>
    );
  }

  // If not currently fetching and there are no recorded steps, don't show anything (or a placeholder)
  if (progressSteps.length === 0) {
    return null;
  }

  return (
    <div className="p-5 bg-card border border-border rounded-2xl space-y-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
          Agent Execution Logs
        </h3>
        {isFetchingData && (
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing
          </div>
        )}
      </div>

      <ol className="space-y-3" role="list">
        {progressSteps.map((step, idx) => {
          const isLast = idx === progressSteps.length - 1;
          const showSpinner = isLast && isFetchingData;

          return (
            <li
              key={idx}
              className="flex items-start gap-3 text-sm text-foreground animate-fadeIn"
            >
              <span className="flex-shrink-0 mt-0.5">
                {showSpinner ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                )}
              </span>
              <span className="break-words leading-relaxed flex-1 text-xs">{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
