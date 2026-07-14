"use client";

import React, { useState, useEffect } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardContainer } from "@/components/dashboard/dashboard-container";
import { MessageSquare, LayoutDashboard, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTabStore } from "@/store/use-tab-store";
import { useChatStore } from "@/store/use-chat-store";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { ActiveResearchContext } from "@/types";

type MobileTab = "chat" | "dashboard";

export default function Home() {
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("chat");

  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const closeTab = useTabStore((s) => s.closeTab);
  const addTab = useTabStore((s) => s.addTab);
  const initTabs = useTabStore((s) => s.initTabs);

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const sessions = useChatStore((s) => s.sessions);
  const createSession = useChatStore((s) => s.createSession);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);

  // Initialize default session and tabs
  useEffect(() => {
    let sId = activeSessionId;
    if (!sId) {
      if (sessions.length > 0) {
        sId = sessions[0].id;
        setActiveSessionId(sId);
      } else {
        sId = createSession("AI Research Session");
      }
    }
    if (sId) {
      initTabs(sId);
    }
  }, [activeSessionId, sessions, initTabs, createSession, setActiveSessionId]);

  // Sync tab data when activeTabId changes
  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab) {
      const currentDashboardData = tab.dashboardData;

      // Restore dashboard data from the tab's own stored data
      useDashboardStore.getState().setDashboardData(currentDashboardData);

      // Stage 7: Tab-isolated context restoration.
      // Use ONLY this tab's own context \u2014 no global context merge.
      // The global merge was the root cause of cross-company QA contamination.
      const tabContext = tab.activeResearchContext;
      const isolatedContext: ActiveResearchContext | null = tabContext
        ? {
            activeTickers: tab.tickers,
            reportType: currentDashboardData?.type === "MULTI" ? "MULTI" : "SINGLE",
            conversationMetadata: tabContext.conversationMetadata || { lastInteraction: "", chatHistory: [] },
            portfolioPositions: tabContext.portfolioPositions || {},
            reports: tabContext.reports || {},
          }
        : null;

      useDashboardStore.setState({ activeResearchContext: isolatedContext });

      if (tab.chatSessionId) {
        useChatStore.getState().setActiveSessionId(tab.chatSessionId);
      }
    }
  }, [activeTabId, tabs]);

  const { submitPrompt } = useAgentStream();

  // Listen for prompt submissions from other components (like chart compare clicks)
  useEffect(() => {
    const handlePrompt = (e: Event) => {
      const ev = e as CustomEvent<{ prompt: string }>;
      if (ev.detail?.prompt) {
        submitPrompt(ev.detail.prompt);
      }
    };
    window.addEventListener("submit-prompt", handlePrompt);
    return () => window.removeEventListener("submit-prompt", handlePrompt);
  }, [submitPrompt]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans antialiased">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-card/60 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
              <span className="text-base font-extrabold text-primary leading-none select-none">∞</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground leading-none flex items-center gap-1.5">
                Buddy
              </h1>
              <p className="text-[9px] text-muted-foreground font-medium tracking-wider uppercase leading-none mt-0.5">
                AI Investment Copilot
              </p>
            </div>
          </div>

          {/* Action Items */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-muted text-secondary-foreground transition-colors border border-transparent"
              aria-label="Settings"
            >
              <Settings className="h-4.5 w-4.5 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* Workspace Tabs Bar */}
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border border-border bg-card/20 p-2 rounded-2xl backdrop-blur-xs select-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isNew = tab.id === "new-research";
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all duration-200 whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                    : "bg-card border-border hover:bg-muted hover:text-foreground text-muted-foreground"
                )}
              >
                <span>{tab.title}</span>
                {!isNew && tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={cn(
                      "rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-sm font-bold leading-none",
                      isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}
          
          {/* Button to add a new tab explicitly */}
          {!tabs.some((t) => t.id === "new-research") && (
            <button
              onClick={() => {
                const newSessionId = useChatStore.getState().createSession("New Session");
                addTab("new-research", "+ New Research", newSessionId, []);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-muted hover:bg-elevated border border-border text-foreground hover:text-primary transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              + Add Tab
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Switcher (Visible only below lg screens) */}
      <div className="lg:hidden px-4 sm:px-6 mt-2">
        <div className="grid grid-cols-2 p-1 bg-muted/60 border border-border rounded-xl animate-fadeIn" role="tablist">
          <button
            role="tab"
            aria-selected={activeMobileTab === "chat"}
            aria-controls="mobile-copilot-tab"
            onClick={() => setActiveMobileTab("chat")}
            className={cn(
              "py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none",
              activeMobileTab === "chat"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Research Copilot
          </button>
          <button
            role="tab"
            aria-selected={activeMobileTab === "dashboard"}
            aria-controls="mobile-dashboard-tab"
            onClick={() => setActiveMobileTab("dashboard")}
            className={cn(
              "py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none",
              activeMobileTab === "dashboard"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Investment Dashboard
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row gap-6">
        {/* Left Side: Copilot (ChatPanel) */}
        <section
          id="mobile-copilot-tab"
          role="tabpanel"
          aria-label="Research Copilot View"
          className={cn(
            "w-full flex flex-col gap-4 h-[calc(100vh-10.5rem)] min-h-[500px] animate-fadeIn",
            activeMobileTab === "chat" ? "flex" : "hidden",
            "lg:flex lg:w-[38%] lg:flex-shrink-0"
          )}
        >
          <div className="flex-1 h-full min-h-[300px]">
            <ChatPanel />
          </div>
        </section>

        {/* Right Side: Core Investment Dashboard */}
        <section
          id="mobile-dashboard-tab"
          role="tabpanel"
          aria-label="Investment Analysis Dashboard View"
          className={cn(
            "flex-1 flex flex-col h-[calc(100vh-10.5rem)] overflow-y-auto pr-1 animate-fadeIn",
            activeMobileTab === "dashboard" ? "flex" : "hidden",
            "lg:flex lg:w-[62%]"
          )}
        >
          <DashboardContainer />
        </section>
      </main>
    </div>
  );
}
