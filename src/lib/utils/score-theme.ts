export interface ScoreTheme {
  text: string;
  bg: string;
  border: string;
  fill: string;
  name: "danger" | "warning" | "moderate" | "excellent";
  label: string;
}

export function normalizeScore(rawScore: number): number {
  if (typeof rawScore !== "number" || isNaN(rawScore)) return 0;
  if (rawScore > 10) return rawScore / 10;
  return rawScore;
}

export function getScoreTheme(scoreVal: number): ScoreTheme {
  const score = normalizeScore(scoreVal);

  if (score >= 8.0) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/5",
      border: "border-emerald-500/20 dark:border-emerald-500/10",
      fill: "fill-emerald-600 dark:fill-emerald-400",
      name: "excellent",
      label: "Strong",
    };
  }
  if (score >= 6.0) {
    return {
      text: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-500/10 dark:bg-yellow-500/5",
      border: "border-yellow-500/20 dark:border-yellow-500/10",
      fill: "fill-yellow-600 dark:fill-yellow-400",
      name: "moderate",
      label: "Watch",
    };
  }
  if (score >= 4.0) {
    return {
      text: "text-amber-600 dark:text-amber-500",
      bg: "bg-amber-500/10 dark:bg-amber-500/5",
      border: "border-amber-500/20 dark:border-amber-500/10",
      fill: "fill-amber-600 dark:fill-amber-500",
      name: "warning",
      label: "Moderate Risk",
    };
  }
  return {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10 dark:bg-rose-500/5",
    border: "border-rose-500/20 dark:border-rose-500/10",
    fill: "fill-rose-600 dark:fill-rose-400",
    name: "danger",
    label: "High Risk",
  };
}
