"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
} from "recharts";
import { cn } from "@/lib/utils";
import { Calendar, ZoomIn, ZoomOut, Maximize2, Download, RefreshCw, X } from "lucide-react";

interface StockChartProps {
  prices: Array<{
    date: string;
    price: number;
    ma50?: number;
    ma200?: number;
  }>;
  ticker?: string;
}

type Timeframe = "1M" | "6M" | "1Y" | "5Y";

export function StockChart({ prices, ticker = "" }: StockChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("6M");
  const [highlight, setHighlight] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHighlight = () => {
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2000);
    };

    window.addEventListener("highlight-chart", handleHighlight as EventListener);
    return () => window.removeEventListener("highlight-chart", handleHighlight as EventListener);
  }, []);

  if (!prices || prices.length === 0) return null;

  const rawData = prices.map((p) => ({
    ...p,
    formattedDate: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: timeframe === "5Y" || timeframe === "1Y" ? "2-digit" : undefined,
    }),
  }));

  // Timeframe filters
  let filteredData = rawData;
  if (timeframe === "1M") {
    filteredData = rawData.slice(-21);
  } else if (timeframe === "6M") {
    filteredData = rawData.slice(-126);
  } else if (timeframe === "1Y") {
    filteredData = rawData.slice(-252);
  } else {
    filteredData = rawData;
  }

  // Zoom filter (slices to 15 days)
  if (isZoomed) {
    filteredData = filteredData.slice(-15);
  }

  // Export Data CSV Handler
  const handleDownload = () => {
    const csvHeaders = "Date,Price,50-Day Moving Average,200-Day Moving Average\n";
    const csvRows = filteredData
      .map((d) => `${d.date},${d.price},${d.ma50 ?? ""},${d.ma200 ?? ""}`)
      .join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvHeaders + csvRows);
    
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${ticker || "STOCK"}_price_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compare Trigger Handler
  const handleCompare = () => {
    const compareTicker = ticker === "MSFT" ? "AAPL" : "MSFT";
    window.dispatchEvent(
      new CustomEvent("submit-prompt", {
        detail: { prompt: `Compare ${ticker || "this stock"} with ${compareTicker}` },
      })
    );
  };

  const renderChartContent = (isModal = false) => {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={filteredData}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            stroke="var(--secondary)"
            fontSize={isModal ? 10 : 9}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="var(--secondary)"
            fontSize={isModal ? 10 : 9}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: "12px",
            }}
            labelStyle={{ color: "var(--muted-foreground)", fontSize: "10px" }}
            itemStyle={{ color: "var(--primary)", fontSize: "11px" }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--primary)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPrice)"
            name="Stock Price"
          />
          {filteredData[0]?.ma50 !== undefined && (
            <Line
              type="monotone"
              dataKey="ma50"
              stroke="#06b6d4"
              strokeWidth={1.5}
              dot={false}
              name="50-Day MA"
            />
          )}
          {filteredData[0]?.ma200 !== undefined && (
            <Line
              type="monotone"
              dataKey="ma200"
              stroke="#d946ef"
              strokeWidth={1.5}
              dot={false}
              name="200-Day MA"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <>
      <div
        ref={chartRef}
        id="stock-chart-section"
        className={cn(
          "w-full transition-all duration-500 rounded-2xl p-5 border flex flex-col gap-4",
          highlight
            ? "ring-2 ring-primary border-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] scale-[1.005]"
            : "border-border bg-muted/20 bg-card"
        )}
      >
        {/* Chart Header / Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3 select-none">
          <div className="flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-primary" />
            <h3 className="text-foreground text-xs font-bold uppercase tracking-wider">
              Interactive Chart {ticker && `(${ticker})`}
            </h3>
          </div>

          {/* Action Tools Header */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Option Controls */}
            <div className="flex items-center gap-1 bg-muted border border-border p-0.5 rounded-lg">
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                title={isZoomed ? "Zoom Out" : "Zoom In (15 Days)"}
                className={cn(
                  "p-1.5 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer",
                  isZoomed && "bg-card text-primary"
                )}
              >
                {isZoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                title="Fullscreen View"
                className="p-1.5 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDownload}
                title="Download CSV Data"
                className="p-1.5 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {ticker && (
                <button
                  onClick={handleCompare}
                  title="Compare Stock"
                  className="p-1.5 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Timeframe Chips */}
            <div className="flex items-center gap-1 bg-muted border border-border p-0.5 rounded-lg">
              {(["1M", "6M", "1Y", "5Y"] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    timeframe === tf
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="h-[240px] w-full">
          {renderChartContent()}
        </div>
      </div>

      {/* Fullscreen Modal Viewport */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs transition-opacity duration-200">
          <div className="absolute inset-0" onClick={() => setIsFullscreen(false)}></div>
          
          <div className="bg-card border border-border w-full max-w-5xl h-[80vh] rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col gap-4 relative z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 select-none">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-primary" />
                <h3 className="text-foreground text-sm font-bold uppercase tracking-wider">
                  Fullscreen Interactive Chart {ticker && `(${ticker})`}
                </h3>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 w-full pt-4">
              {renderChartContent(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default StockChart;
