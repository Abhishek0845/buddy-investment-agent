import { create } from "zustand";
import { DashboardData, ActiveResearchContext } from "@/types";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y" | "ALL";

interface DashboardState {
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  watchlist: string[];
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  isFetchingData: boolean;
  setIsFetchingData: (isFetchingData: boolean) => void;

  // Extended fields
  intent: "SINGLE" | "MULTI" | null;
  setIntent: (intent: "SINGLE" | "MULTI" | null) => void;
  tickers: string[];
  setTickers: (tickers: string[]) => void;
  dashboardData: DashboardData | null;
  setDashboardData: (data: DashboardData | null) => void;
  activeResearchContext: ActiveResearchContext | null;
  progressMessage: string;
  setProgressMessage: (message: string) => void;
  progressSteps: string[];
  setProgressSteps: (steps: string[] | ((prev: string[]) => string[])) => void;
  error: string | null;
  setError: (error: string | null) => void;
  resetProgress: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedTicker: "AAPL",
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker.toUpperCase() }),
  timeframe: "1M",
  setTimeframe: (timeframe) => set({ timeframe }),
  watchlist: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
  addToWatchlist: (ticker) =>
    set((state) => {
      const formatted = ticker.toUpperCase().trim();
      if (!formatted || state.watchlist.includes(formatted)) return {};
      return { watchlist: [...state.watchlist, formatted] };
    }),
  removeFromWatchlist: (ticker) =>
    set((state) => ({
      watchlist: state.watchlist.filter((t) => t !== ticker.toUpperCase().trim()),
    })),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading, isFetchingData: isLoading }),
  isFetchingData: false,
  setIsFetchingData: (isFetchingData) => set({ isFetchingData, isLoading: isFetchingData }),

  // Extended implementation
  intent: null,
  setIntent: (intent) => set({ intent }),
  tickers: [],
  setTickers: (tickers) => set({ tickers }),
  dashboardData: null,
  setDashboardData: (dashboardData) => set({ dashboardData }),
  activeResearchContext: null,
  progressMessage: "",
  setProgressMessage: (progressMessage) => set({ progressMessage }),
  progressSteps: [],
  setProgressSteps: (steps) =>
    set((state) => ({
      progressSteps: typeof steps === "function" ? (steps as (prev: string[]) => string[])(state.progressSteps) : steps,
    })),
  error: null,
  setError: (error) => set({ error }),
  resetProgress: () => set({ progressMessage: "", progressSteps: [], error: null }),
}));
