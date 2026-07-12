import React from "react";
import { CompanyReport } from "@/types";

interface CompanyHeaderProps {
  report: CompanyReport;
}

export function CompanyHeader({ report }: CompanyHeaderProps) {
  const { companyName, ticker, chartData } = report;
  const latestBar = chartData?.historicalPrices?.[chartData?.historicalPrices?.length - 1];
  const currentPrice = latestBar?.price;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{companyName}</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-lg">
            {ticker}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Equity Research & Valuation Profile</p>
      </div>
      {currentPrice !== undefined && (
        <div className="text-left sm:text-right">
          <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">Latest Price</span>
          <span className="text-2xl font-extrabold tracking-tight text-emerald-555 dark:text-emerald-450 mt-0.5 block">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}
