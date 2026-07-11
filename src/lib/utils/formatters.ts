/**
 * Formatting utilities for numbers, currencies, percentages, and dates in financial contexts.
 */

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentage(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${value > 0 ? "+" : ""}${formatted}%`;
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "N/A";
  try {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "N/A";
  }
}
