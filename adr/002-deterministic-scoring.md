ADR 002: Deterministic backend scoring over LLM scoring
Decision

All financial scores (Fundamentals, Technicals, Risk, Sentiment, Overall) will be calculated programmatically in TypeScript.
Alternatives Considered

Passing raw data to the LLM and asking it to output a 1-10 score per category.
Pros

    100% deterministic. Same input always yields the same score.
    Eliminates LLM math hallucinations.
    Easier to tune thresholds via code than via prompt engineering.

Cons

    Requires hardcoding scoring rules in TypeScript.

Final Choice

Deterministic TypeScript scoring engine.