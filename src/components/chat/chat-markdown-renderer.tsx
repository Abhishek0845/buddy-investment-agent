import React from "react";

interface ChatMarkdownRendererProps {
  content: string;
}

export function ChatMarkdownRenderer({ content }: ChatMarkdownRendererProps) {
  if (!content) return null;

  // Split content by newline to process line-by-line
  const lines = content.split("\n");

  const renderInlineMarkup = (text: string) => {
    if (!text) return "";
    // Match inline bold **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <>
        {parts.map((part, idx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={idx} className="font-extrabold text-foreground">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </>
    );
  };

  return (
    <div className="space-y-2.5 leading-relaxed text-xs sm:text-sm select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // 1. Headings (e.g. ### Heading or ## Heading)
        if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
          const headerText = trimmed.replace(/^#+\s+/, "");
          return (
            <h3
              key={idx}
              className="text-xs sm:text-sm font-extrabold text-foreground border-b border-border/40 pb-1 mt-4 mb-2 first:mt-0 uppercase tracking-wider select-text"
            >
              {renderInlineMarkup(headerText)}
            </h3>
          );
        }

        // 2. Bullet Lists (e.g. * Item or - Item or • Item)
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const bulletText = trimmed.replace(/^[\*\-•]\s+/, "");
          return (
            <div
              key={idx}
              className="flex items-start gap-1.5 ml-2.5 my-1 text-foreground/90 select-text"
            >
              <span className="text-primary font-extrabold mt-0.5 select-none">•</span>
              <span className="flex-1">{renderInlineMarkup(bulletText)}</span>
            </div>
          );
        }

        // 3. Spacing for empty lines
        if (trimmed === "") {
          return <div key={idx} className="h-1" />;
        }

        // 4. Regular Paragraphs
        return (
          <p key={idx} className="text-foreground/90 my-1 break-words select-text">
            {renderInlineMarkup(line)}
          </p>
        );
      })}
    </div>
  );
}

export default ChatMarkdownRenderer;
