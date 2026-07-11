import { create } from "zustand";

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
  setIsLoading: (isLoading) => set({ isLoading }),
}));
