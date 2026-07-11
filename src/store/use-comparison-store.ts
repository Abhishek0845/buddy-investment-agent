import { create } from "zustand";

interface ComparisonState {
  comparedTickers: string[];
  selectedMetrics: string[];
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  clearComparison: () => void;
  toggleMetric: (metric: string) => void;
}

export const useComparisonStore = create<ComparisonState>((set) => ({
  comparedTickers: [],
  selectedMetrics: ["revenue", "netIncome", "operatingIncome", "eps", "pe", "marketCap"],
  
  addTicker: (ticker) =>
    set((state) => {
      const clean = ticker.toUpperCase().trim();
      if (!clean || state.comparedTickers.includes(clean)) return {};
      if (state.comparedTickers.length >= 4) return {}; // Cap at 4 tickers
      return { comparedTickers: [...state.comparedTickers, clean] };
    }),

  removeTicker: (ticker) =>
    set((state) => ({
      comparedTickers: state.comparedTickers.filter((t) => t !== ticker.toUpperCase().trim()),
    })),

  clearComparison: () => set({ comparedTickers: [] }),

  toggleMetric: (metric) =>
    set((state) => {
      const isSelected = state.selectedMetrics.includes(metric);
      if (isSelected) {
        if (state.selectedMetrics.length <= 1) return {};
        return { selectedMetrics: state.selectedMetrics.filter((m) => m !== metric) };
      }
      return { selectedMetrics: [...state.selectedMetrics, metric] };
    }),
}));
