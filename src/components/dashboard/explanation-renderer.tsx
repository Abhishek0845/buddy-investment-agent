import React from "react";

interface ExplanationTextProps {
  text: string;
}

export function ExplanationText({ text }: ExplanationTextProps) {
  if (!text) return null;

  // Split by bold tags (**bold**)
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <span className="break-words leading-relaxed whitespace-pre-line block">
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className="font-extrabold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </span>
  );
}
export default ExplanationText;
