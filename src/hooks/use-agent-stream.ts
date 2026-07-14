import { useRef, useCallback } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { useTabStore } from "@/store/use-tab-store";
import { ActiveResearchContext } from "@/types";



export function useAgentStream() {
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Tracks the current request ID to filter stale SSE events. */
  const activeRequestIdRef = useRef<string | null>(null);

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

      // Generate a unique ID for this request.
      // SSE events stamped with a different requestId are stale (from a prior request)
      // and will be silently ignored.
      const currentRequestId = crypto.randomUUID();
      activeRequestIdRef.current = currentRequestId;

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
          let targetTabId = useTabStore.getState().activeTabId || "new-research";
          let targetSessionId = initialSessionId;
          let pendingTabCreation: { id: string; title: string; sessionId: string; tickers: string[]; } | null = null;

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

          // Determine if there is already an analyzed dashboard for the current tab
          const currentTab = useTabStore.getState().tabs.find(t => t.id === targetTabId);
          const hasDashboard = !!(currentTab?.isAnalyzed && currentTab?.dashboardData);

          const response = await fetch("/api/agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message,
              activeResearchContext: contextWithHistory,
              dashboardData,
              hasDashboard,
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

                  // Stage 3: Filter stale SSE events if the user started a new request
                  if (activeRequestIdRef.current !== currentRequestId) {
                    continue;
                  }

                  switch (eventType) {
                    case "intent":
                      if (data.intent) {
                        const isNewResearch = data.intent === "SINGLE" || data.intent === "MULTI";
                        setIsLoading(isNewResearch);

                        useDashboardStore.setState({
                          intent: data.intent,
                          tickers: data.tickers || [],
                        });

                        if (isNewResearch && data.tickers && data.tickers.length > 0) {
                          setDashboardData(null);
                          useDashboardStore.setState({ activeResearchContext: null });
                          
                          const resolved = data.tickers;
                          const resolvedTicker = resolved.length === 1 ? resolved[0] : resolved.sort().join("_");
                          const displayTitle = resolved.length === 1 ? resolved[0] : resolved.join(" vs ");
                          const hasRefresh = /\b(refresh|reload|re-run)\b/i.test(message);
                          
                          const tabStore = useTabStore.getState();
                          const existingTab = tabStore.tabs.find(t => t.id.toUpperCase() === resolvedTicker.toUpperCase());

                          if (existingTab && existingTab.isAnalyzed && !hasRefresh) {
                            tabStore.setActiveTabId(existingTab.id);
                            targetTabId = existingTab.id;
                            targetSessionId = existingTab.chatSessionId;
                            
                            setDashboardData(existingTab.dashboardData);
                            useDashboardStore.setState({ 
                              activeResearchContext: existingTab.activeResearchContext,
                            });
                            setIsLoading(false); // Instantly loaded from cache!
                          } else {
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
                              const newSessionForNewResearch = useChatStore.getState().createSession("New Research Session");
                              useTabStore.setState({
                                tabs: tabStore.tabs.map((t) =>
                                  t.id === "new-research" ? { ...t, chatSessionId: newSessionForNewResearch } : t
                                ),
                              });
                            } else {
                              tabSessionId = useChatStore.getState().createSession(`Research ${displayTitle}`);
                            }
                            
                            pendingTabCreation = {
                              id: resolvedTicker,
                              title: displayTitle,
                              sessionId: tabSessionId,
                              tickers: resolved,
                            };
                            targetTabId = resolvedTicker;
                            targetSessionId = tabSessionId;
                          }

                          // Move messages if targetSessionId changed
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
                                  if (s.id === initialSessionId) return { ...s, messages: remainingMessages, updatedAt: Date.now() };
                                  if (s.id === targetSessionId) return { ...s, messages: [...s.messages, ...messagesToMove], updatedAt: Date.now() };
                                  return s;
                                }),
                                activeSessionId: targetSessionId,
                              };
                            });
                          } else if (targetSessionId) {
                            useChatStore.getState().setActiveSessionId(targetSessionId);
                          }
                        }
                      }
                      break;
                    case "progress":
                      setProgressMessage(data.message);
                      setProgressSteps((prev) => [...prev, data.message]);
                      break;
                    case "dashboard":
                      // Stage 5: Defer tab creation to after dashboard event fires
                      if (pendingTabCreation) {
                        useTabStore.getState().addTab(
                          pendingTabCreation.id,
                          pendingTabCreation.title,
                          pendingTabCreation.sessionId,
                          pendingTabCreation.tickers
                        );
                        useTabStore.getState().setActiveTabId(pendingTabCreation.id);
                        // Update the chat session to match the new tab
                        useChatStore.getState().setActiveSessionId(pendingTabCreation.sessionId);
                        pendingTabCreation = null;
                      }
                      setDashboardData(data);
                      // Save to tab workspace
                      useTabStore.getState().updateTabReport(
                        targetTabId, 
                        data, 
                        useDashboardStore.getState().activeResearchContext || ({} as ActiveResearchContext)
                      );
                      break;
                    case "context": {
                        if (!data) {
                          break;
                        }
                        useDashboardStore.setState({ activeResearchContext: data });
                        // Save context to this tab only.
                        // Stage 4: Cross-tab propagation removed — each tab stays isolated.
                        const currentD = useDashboardStore.getState().dashboardData;
                        if (currentD) {
                          useTabStore.getState().updateTabReport(targetTabId, currentD, data);
                        }
                        break;
                    }
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
