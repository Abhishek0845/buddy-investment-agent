import React, { useState, useEffect, useRef } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { ChatMessage } from "./chat-message";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Square, ArrowDown, Paperclip } from "lucide-react";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);

  const { submitPrompt, abort, isGenerating } = useAgentStream();

  const isFetchingData = useDashboardStore((s) => s.isFetchingData);
  const progressSteps = useDashboardStore((s) => s.progressSteps);

  const [showJumpButton, setShowJumpButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-initialize active session if none is present
  useEffect(() => {
    if (!activeSessionId) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      } else {
        createSession("AI Research Session");
      }
    }
  }, [activeSessionId, sessions, createSession, setActiveSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  // Smooth scroll helper
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setAutoScroll(true);
      setShowJumpButton(false);
    }
  };

  // Scroll position monitor to toggle smart auto-scroll
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 100) {
      setAutoScroll(false);
      setShowJumpButton(true);
    } else {
      setAutoScroll(true);
      setShowJumpButton(false);
    }
  };

  // Re-scroll on stream token updates
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages.length, latestMessageContent, autoScroll]);

  const handleSubmit = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isGenerating) return;

    submitPrompt(trimmedInput);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden shadow-sm relative transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold text-primary leading-none select-none">∞</span>
          <h2 className="text-sm font-semibold tracking-wide text-foreground">
            Research Copilot
          </h2>
        </div>
        {isGenerating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={abort}
            aria-label="Stop research stream"
            className="flex items-center gap-1.5 h-7 text-xs font-semibold text-destructive hover:text-destructive/80 hover:bg-destructive/10 border border-destructive/20 px-2.5 rounded-full"
          >
            <Square className="h-2.5 w-2.5 fill-current" />
            Stop
          </Button>
        )}
      </div>

      {/* Messages Viewport */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-background/30 select-text pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
        role="log"
        aria-live="polite"
        aria-label="Chat messages history"
      >
        <div className="py-6 px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 mt-8 space-y-5 animate-fadeIn">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
                <span className="text-xl font-extrabold text-primary leading-none select-none">∞</span>
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-sm font-bold text-foreground">
                  Ask Buddy anything.
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask Buddy about any public company ticker or compare multiple assets to evaluate rating scores.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 w-full max-w-xs pt-2">
                {[
                  "Should I buy Apple?",
                  "Compare Tesla vs Nvidia",
                  "Find undervalued AI companies",
                  "Should I buy Microsoft today?",
                ].map((sug) => (
                  <button
                    key={sug}
                    onClick={() => !isGenerating && submitPrompt(sug)}
                    className="text-left text-xs font-semibold px-4 py-2.5 rounded-xl bg-muted hover:bg-elevated border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
                  >
                    {sug} &rarr;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isLast={idx === messages.length - 1}
                  isGenerating={isGenerating}
                  isFetchingData={isFetchingData}
                  progressSteps={progressSteps}
                  onSuggestionClick={submitPrompt}
                />
              ))}

              {/* Render dynamic UI-only loading bubble when fetching report */}
              {isGenerating && messages.length > 0 && messages[messages.length - 1].role === "user" && (
                <ChatMessage
                  role="assistant"
                  content={(() => {
                    const lastUserMsg = messages[messages.length - 1].content;
                    const match = lastUserMsg.match(/\b([A-Z]{1,5})\b/) || lastUserMsg.match(/\b(tesla|nvidia|apple|google|amazon|microsoft|meta|netflix)\b/i);
                    const subject = match ? match[0].toUpperCase() : "the target company";
                    return `I'm reviewing ${subject}'s latest financial statements, valuation, technical indicators, recent news, and overall investment risk.\n\nThis usually takes around 20–40 seconds. I'll explain my recommendation once the analysis is complete.`;
                  })()}
                  isLast={true}
                  isGenerating={isGenerating}
                  isFetchingData={isFetchingData}
                  progressSteps={progressSteps}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Jump to Latest Button */}
      {showJumpButton && (
        <button
          onClick={scrollToBottom}
          aria-label="Jump to latest message"
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-card/90 border border-border text-foreground hover:bg-muted px-4 py-2 rounded-full text-xs font-bold shadow-md transition-all animate-bounce"
        >
          <ArrowDown className="h-3 w-3" />
          Jump to Latest
        </button>
      )}

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4 space-y-2 z-10">
        <div className="relative flex items-end gap-2 bg-muted border border-border rounded-2xl px-4 py-2.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-150">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0 hover:bg-background/50 border border-transparent"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            aria-label="Ask Buddy about any company..."
            placeholder={
              isGenerating
                ? "Agent is compiling research..."
                : "Ask Buddy about any company..."
            }
            className="flex-1 min-h-[40px] max-h-[160px] resize-none border-0 bg-transparent p-1 focus-visible:ring-0 text-sm text-foreground placeholder:text-muted-foreground"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={isGenerating || !input.trim()}
            className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:text-muted-foreground transition-all duration-150 flex-shrink-0 shadow-sm border border-transparent"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Press <kbd className="font-sans px-1 bg-muted border border-border rounded">Enter</kbd> to submit, <kbd className="font-sans px-1 bg-muted border border-border rounded">Shift + Enter</kbd> for newline.
        </p>
      </div>
    </div>
  );
}
export default ChatPanel;
