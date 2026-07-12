import React from "react";
import { Loader2 } from "lucide-react";
import { ChatMarkdownRenderer } from "./chat-markdown-renderer";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isLast?: boolean;
  isGenerating?: boolean;
  isFetchingData?: boolean;
  progressSteps?: string[];
  onSuggestionClick?: (text: string) => void;
}

export function ChatMessage({
  role,
  content,
  isLast = false,
  isGenerating = false,
  isFetchingData = false,
  progressSteps = [],
  onSuggestionClick,
}: ChatMessageProps) {
  if (role === "system") {
    return (
      <div 
        className="w-full flex justify-center my-2 px-4 animate-fadeIn" 
        aria-label="System status message"
      >
        <p className="text-center text-xs italic text-muted-foreground break-words whitespace-pre-wrap max-w-[90%] select-text">
          {content}
        </p>
      </div>
    );
  }

  const isUser = role === "user";
  const showThinking = isLast && isFetchingData && progressSteps.length > 0;
  const showSuggestionChips = !isGenerating && role === "assistant" && content.includes("Analysis complete");

  const getContextualChips = (): string[] => {
    const tickerMatch = content.match(/\*\*([A-Z]{1,5})\*\*/);
    const ticker = tickerMatch ? tickerMatch[1] : "";

    if (ticker) {
      return [
        `Why invest?`,
        `Should I wait?`,
        `Biggest risk?`,
        `Price target`,
        `Compare Microsoft`,
        `Dividend outlook`,
      ];
    }
    return [
      "Compare Apple and Microsoft",
      "Should I invest in Tesla?",
      "How does the risk scoring work?",
      "Explain the moving average indicators",
    ];
  };

  const chips = getContextualChips();

  return (
    <div 
      className={`w-full flex flex-col ${isUser ? "items-end" : "items-start"} mb-4 px-4 animate-fadeIn`}
      aria-label={`${isUser ? "User" : "Assistant"} chat message`}
    >
      <div
        className={`max-w-[70%] rounded-2xl md:rounded-3xl px-4 py-3 shadow-sm select-text text-xs md:text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-xs"
            : "bg-card text-foreground border border-border rounded-bl-xs"
        }`}
      >
        {/* Inline Thinking logs - single status line */}
        {showThinking && (
          <div className="mb-2.5 p-2 bg-muted/65 border border-border/60 rounded-xl select-none flex items-center gap-2 text-xs font-bold text-muted-foreground animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>{progressSteps[progressSteps.length - 1] || "Analyzing market data..."}</span>
          </div>
        )}

        {/* Content message (rendered cleanly without raw markdown) */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words font-medium select-text">
            {content}
          </div>
        ) : (
          <ChatMarkdownRenderer content={content} />
        )}
      </div>

      {/* Suggestion action chips below assistant's message */}
      {showSuggestionChips && onSuggestionClick && (
        <div className="flex flex-wrap gap-1.5 mt-2 max-w-[70%] animate-fadeIn">
          {chips.map((chipText) => (
            <button
              key={chipText}
              onClick={() => onSuggestionClick(chipText)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-muted hover:bg-elevated border border-border text-foreground hover:text-primary transition-all duration-150 cursor-pointer"
            >
              {chipText}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChatMessage;
