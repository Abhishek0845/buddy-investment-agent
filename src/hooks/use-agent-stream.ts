import { useRef, useCallback } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { useTabStore } from "@/store/use-tab-store";
import { ActiveResearchContext } from "@/types";

function extractDeterministicTickers(input: string): string[] {
  const stopWords = new Set([
    "I", "A", "AND", "OR", "BUT", "FOR", "TO", "IN", "ON", "AT", "BY", "WITH", "US"
  ]);
  const resolved = new Set<string>();
  const uppercaseWords = input.match(/\b[A-Z]{1,5}\b/g) || [];
  for (const item of uppercaseWords) {
    if (!stopWords.has(item)) {
      resolved.add(item);
    }
  }
  return Array.from(resolved);
}

const isNewResearchQuery = (resolved: string[], activeTabTickers: string[], message: string): boolean => {
  if (resolved.length === 0) return false;

  const hasQuestionKeywords = /\b(why|how|what|explain|describe|question|which|who|where|when|compare|difference|score|thesis|strength|weakness|risk)\b/i.test(message);
  if (hasQuestionKeywords) return false;

  if (activeTabTickers.length > 0) {
    const mentionsActive = activeTabTickers.some(t => resolved.includes(t.toUpperCase()));
    const mentionsOthers = resolved.some(t => !activeTabTickers.includes(t.toUpperCase()));
    if (mentionsActive && !mentionsOthers) {
      return false; // Follow up on active tab
    }
  }
  return true;
};

export function useAgentStream() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const isGenerating = useChatStore((s) => s.isGenerating);
  const setIsGenerating = useChatStore((s) => s.setIsGenerating);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendLastMessageContent = useChatStore((s) => s.appendLastMessageContent);
  const cleanEmptyMessages = useChatStore((s) => s.cleanEmptyMessages);

  const setIsLoading = useDashboardStore((s) => s.setIsLoading);
  const setDashboardData = useDashboardStore((s) => s.setDashboardData);
  const setProgressMessage = useDashboardStore((s) => s.setProgressMessage);
  const setProgressSteps = useDashboardStore((s) => s.setProgressSteps);
  const setError = useDashboardStore((s) => s.setError);
  const resetProgress = useDashboardStore((s) => s.resetProgress);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsLoading(false);
    cleanEmptyMessages();
  }, [setIsGenerating, setIsLoading, cleanEmptyMessages]);

  const submitPrompt = useCallback(
    async (message: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 1. Immediately update UI state and append user message
      setIsGenerating(true);
      setIsLoading(true); // Default to showing loading state immediately
      setError(null);
      resetProgress();

      let initialSessionId = useChatStore.getState().activeSessionId;
      if (!initialSessionId) {
        initialSessionId = useChatStore.getState().createSession("AI Research Session");
      }

      // Add user prompt to chat immediately in the active session
      // Remove empty assistant message so chat-panel shows the dynamic loading bubble!
      addMessage({ role: "user", content: message });

      let tokenBuffer = "";
      let lastFlushTime = 0;
      let flushTimeoutId: NodeJS.Timeout | null = null;

      const flushTokens = () => {
        if (tokenBuffer) {
          appendLastMessageContent(tokenBuffer);
          tokenBuffer = "";
          lastFlushTime = Date.now();
        }
        if (flushTimeoutId) {
          clearTimeout(flushTimeoutId);
          flushTimeoutId = null;
        }
      };

      const bufferToken = (token: string) => {
        tokenBuffer += token;
        const now = Date.now();
        const timeSinceLastFlush = now - lastFlushTime;

        if (timeSinceLastFlush >= 50) {
          flushTokens();
        } else if (!flushTimeoutId) {
          flushTimeoutId = setTimeout(flushTokens, 50 - timeSinceLastFlush);
        }
      };

      // Kick off network request pipeline asynchronously
      (async () => {
        try {
          // Asynchronously resolve tickers from query
          let resolved: string[] = [];
          try {
            const resolveRes = await fetch("/api/resolve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message }),
              signal: controller.signal,
            });
            if (resolveRes.ok) {
              const resolveData = await resolveRes.json();
              resolved = resolveData.tickers || [];
            } else {
              resolved = extractDeterministicTickers(message);
            }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              console.log("Resolution call aborted.");
              return;
            }
            console.error("Failed to resolve tickers, using fallback", err);
            resolved = extractDeterministicTickers(message);
          }

          // Determine active tab state
          const tabStore = useTabStore.getState();
          const activeTab = tabStore.tabs.find((t) => t.id === tabStore.activeTabId);
          const activeTabTickers = activeTab?.tickers || [];

          // Determine query intent
          let isNewResearch = isNewResearchQuery(resolved, activeTabTickers, message);

          let targetTabId = tabStore.activeTabId || "new-research";
          let targetSessionId = useChatStore.getState().activeSessionId || "";

          // Tab switching / loading logic
          if (resolved.length > 0) {
            const resolvedTicker = resolved.length === 1 ? resolved[0] : resolved.sort().join("_");
            const displayTitle = resolved.length === 1 ? resolved[0] : resolved.join(" vs ");
            const hasRefresh = /\b(refresh|reload|re-run)\b/i.test(message);

            // Check if an analyzed tab already exists for this symbol / comparison
            const existingTab = tabStore.tabs.find(
              (t) => t.id.toUpperCase() === resolvedTicker.toUpperCase()
            );

            if (existingTab && existingTab.isAnalyzed && !hasRefresh) {
              tabStore.setActiveTabId(existingTab.id);
              targetTabId = existingTab.id;
              targetSessionId = existingTab.chatSessionId; // Update session target
              
              // Load context and dashboard data from existing tab
              setDashboardData(existingTab.dashboardData);
              useDashboardStore.setState({ 
                activeResearchContext: existingTab.activeResearchContext,
                tickers: existingTab.tickers
              });
              
              isNewResearch = false; // Turn off new research since we have it already
            } else if (isNewResearch) {
              // If this is a comparison query, also ensure individual tabs are created in the background!
              if (resolved.length > 1) {
                for (const ticker of resolved) {
                  const companyTabId = ticker.toUpperCase();
                  const companyExisting = tabStore.tabs.find(t => t.id.toUpperCase() === companyTabId);
                  if (!companyExisting) {
                    const companySessionId = useChatStore.getState().createSession(`Research ${ticker}`);
                    tabStore.addTab(companyTabId, ticker, companySessionId, [ticker]);
                  }
                }
              }

              let tabSessionId = targetSessionId;
              if (tabStore.activeTabId === "new-research") {
                // Allocate a new session for "+ New Research" so it stays clean
                const newSessionForNewResearch = useChatStore.getState().createSession("New Research Session");
                useTabStore.setState({
                  tabs: tabStore.tabs.map((t) =>
                    t.id === "new-research"
                      ? { ...t, chatSessionId: newSessionForNewResearch }
                      : t
                  ),
                });
              } else {
                // We started from an existing tab, create a new separate session for the new tab
                tabSessionId = useChatStore.getState().createSession(`Research ${displayTitle}`);
              }

              tabStore.addTab(resolvedTicker, displayTitle, tabSessionId, resolved);
              targetTabId = resolvedTicker;
              targetSessionId = tabSessionId;

              // Reset dashboard for the new analysis tab
              setDashboardData(null);
              useDashboardStore.setState({ 
                activeResearchContext: null,
                tickers: resolved
              });
            }
          } else if (isNewResearch) {
            setDashboardData(null);
            useDashboardStore.setState({ 
              activeResearchContext: null,
              tickers: []
            });
          }

          // Update loading state based on actual research intent
          setIsLoading(isNewResearch);

          // Migrate/move user message to the new session if targetSessionId changed
          if (targetSessionId && targetSessionId !== initialSessionId) {
            useChatStore.setState((state) => {
              const sourceSession = state.sessions.find(s => s.id === initialSessionId);
              if (!sourceSession) return {};

              const userMsgIndex = sourceSession.messages.findLastIndex(m => m.role === "user");
              if (userMsgIndex === -1) return {};

              const messagesToMove = sourceSession.messages.slice(userMsgIndex);
              const remainingMessages = sourceSession.messages.slice(0, userMsgIndex);

              return {
                sessions: state.sessions.map((s) => {
                  if (s.id === initialSessionId) {
                    return { ...s, messages: remainingMessages, updatedAt: Date.now() };
                  }
                  if (s.id === targetSessionId) {
                    return { ...s, messages: [...s.messages, ...messagesToMove], updatedAt: Date.now() };
                  }
                  return s;
                }),
                activeSessionId: targetSessionId,
              };
            });
          } else if (targetSessionId) {
            useChatStore.getState().setActiveSessionId(targetSessionId);
          }

          // Read active contexts
          const activeResearchContext = useDashboardStore.getState().activeResearchContext;
          const dashboardData = useDashboardStore.getState().dashboardData;

          // Build chat history context payload (excluding empty helper assistants)
          let contextWithHistory = activeResearchContext;
          if (activeResearchContext) {
            const messages = useChatStore.getState().sessions.find(s => s.id === targetSessionId)?.messages || [];
            const chatHistory = messages
              .filter(m => m.content.trim())
              .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
            
            contextWithHistory = {
              ...activeResearchContext,
              conversationMetadata: {
                ...activeResearchContext.conversationMetadata,
                chatHistory,
              }
            };
          }

          const response = await fetch("/api/agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              message,
              activeResearchContext: contextWithHistory,
              dashboardData
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Server returned status code ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("Unable to read streaming response body.");
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split(/\n\n/);
            buffer = messages.pop() || "";

            for (const msg of messages) {
              if (!msg.trim()) continue;

              let eventType = "message";
              let dataStr = "";

              const lines = msg.split(/\n/);
              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventType = line.replace("event:", "").trim();
                } else if (line.startsWith("data:")) {
                  dataStr = line.replace("data:", "").trim();
                }
              }

              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);

                  switch (eventType) {
                    case "intent":
                      if (data.intent) {
                        useDashboardStore.setState({
                          intent: data.intent,
                          tickers: data.tickers || [],
                        });
                      }
                      break;
                    case "progress":
                      setProgressMessage(data.message);
                      setProgressSteps((prev) => [...prev, data.message]);
                      break;
                    case "dashboard":
                      setDashboardData(data);
                      // Save to tab workspace
                      useTabStore.getState().updateTabReport(
                        targetTabId, 
                        data, 
                        useDashboardStore.getState().activeResearchContext || ({} as ActiveResearchContext)
                      );
                      break;
                    case "context":
                      if (!data) {
                        break;
                      }
                      useDashboardStore.setState({ activeResearchContext: data });
                      // Save context to tab workspace
                      const currentD = useDashboardStore.getState().dashboardData;
                      if (currentD) {
                        useTabStore.getState().updateTabReport(targetTabId, currentD, data);
                      }
                      // Also propagate the reports to all other tabs in the store if data is not null!
                      useTabStore.setState({
                        tabs: useTabStore.getState().tabs.map(tab => {
                          if (tab.id !== targetTabId) {
                            const tabCtx = tab.activeResearchContext || {
                              activeTickers: tab.tickers,
                              reportType: tab.dashboardData?.type === "MULTI" ? "MULTI" : "SINGLE",
                              conversationMetadata: { lastInteraction: "", chatHistory: [] },
                              reports: {},
                              portfolioPositions: {}
                            };
                            return {
                              ...tab,
                              activeResearchContext: {
                                 ...tabCtx,
                                 reports: {
                                   ...tabCtx.reports,
                                   ...(data.reports || {})
                                 },
                                 portfolioPositions: {
                                   ...tabCtx.portfolioPositions,
                                   ...(data.portfolioPositions || {})
                                 }
                              }
                            };
                          }
                          return tab;
                        })
                      });
                      break;
                    case "chat":
                      bufferToken(data.token);
                      break;
                    case "error":
                      flushTokens();
                      setError(data.message);
                      setIsGenerating(false);
                      setIsLoading(false);
                      appendLastMessageContent(`⚠️ Error: ${data.message}`);
                      break;
                    case "done":
                      flushTokens();
                      setIsGenerating(false);
                      setIsLoading(false);
                      cleanEmptyMessages();
                      break;
                  }
                } catch (err) {
                  console.error("Error decoding SSE payload event:", err, dataStr);
                }
              }
            }
          }
        } catch (err: unknown) {
          flushTokens();
          if (err instanceof Error && err.name === "AbortError") {
            console.log("Stream aborted by user.");
            return;
          }
          console.error("Agent communication stream error:", err);
          setError(err instanceof Error ? err.message : "An unexpected stream error occurred.");
          setIsGenerating(false);
          setIsLoading(false);
          cleanEmptyMessages();
        } finally {
          flushTokens();
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      })();
    },
    [
      addMessage,
      appendLastMessageContent,
      cleanEmptyMessages,
      setIsGenerating,
      setIsLoading,
      setError,
      resetProgress,
      setDashboardData,
      setProgressMessage,
      setProgressSteps,
    ]
  );

  return {
    submitPrompt,
    abort,
    isGenerating,
  };
}
