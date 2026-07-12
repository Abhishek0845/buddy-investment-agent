import { create } from "zustand";
import { DashboardData, ActiveResearchContext } from "@/types";
import { useChatStore } from "@/store/use-chat-store";

export interface WorkspaceTab {
  id: string; // Ticker (e.g. "AAPL") or comparison ID, or "new-research"
  title: string;
  tickers: string[];
  dashboardData: DashboardData | null;
  activeResearchContext: ActiveResearchContext | null;
  chatSessionId: string;
  isAnalyzed: boolean;
}

interface TabState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  setActiveTabId: (id: string) => void;
  addTab: (id: string, title: string, chatSessionId: string, tickers: string[]) => void;
  closeTab: (id: string) => void;
  updateTabReport: (id: string, data: DashboardData, context: ActiveResearchContext) => void;
  initTabs: (defaultSessionId: string) => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  initTabs: (defaultSessionId) => {
    if (get().tabs.length > 0) return;
    const defaultTab: WorkspaceTab = {
      id: "new-research",
      title: "+ New Research",
      tickers: [],
      dashboardData: null,
      activeResearchContext: null,
      chatSessionId: defaultSessionId,
      isAnalyzed: false,
    };
    set({
      tabs: [defaultTab],
      activeTabId: "new-research",
    });
  },

  setActiveTabId: (id) => set({ activeTabId: id }),

  addTab: (id, title, chatSessionId, tickers) => {
    const existing = get().tabs.find((t) => t.id === id);
    if (existing) {
      set({ activeTabId: id });
      return;
    }

    const newTab: WorkspaceTab = {
      id,
      title,
      tickers,
      dashboardData: null,
      activeResearchContext: null,
      chatSessionId,
      isAnalyzed: false,
    };

    // Keep "+ New Research" tab at the end
    const tabs = [...get().tabs];
    const newResearchIndex = tabs.findIndex((t) => t.id === "new-research");
    if (newResearchIndex !== -1) {
      tabs.splice(newResearchIndex, 0, newTab);
    } else {
      tabs.push(newTab);
    }

    set({ tabs, activeTabId: id });
  },

  closeTab: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (tab && tab.chatSessionId) {
      useChatStore.getState().deleteSession(tab.chatSessionId);
    }
    const tabs = get().tabs.filter((t) => t.id !== id);
    let activeTabId = get().activeTabId;

    if (activeTabId === id) {
      activeTabId = tabs.length > 0 ? tabs[0].id : null;
    }

    set({ tabs, activeTabId });
  },

  updateTabReport: (id, data, context) => {
    const title = data.companies.length === 1 ? data.companies[0].ticker : data.companies.map((c) => c.ticker).join(" vs ");
    const tickers = data.companies.map((c) => c.ticker);
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id === id) {
          return {
            ...tab,
            title,
            tickers,
            dashboardData: data,
            activeResearchContext: context,
            isAnalyzed: true,
          };
        }
        return tab;
      }),
    }));
  },
}));
