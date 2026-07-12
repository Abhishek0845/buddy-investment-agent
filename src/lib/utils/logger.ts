import { LOG_LEVEL } from "../config";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function shouldLog(level: LogLevel): boolean {
  const currentLevel = (LOG_LEVEL as LogLevel) || "INFO";
  const currentVal = LOG_LEVEL_VALUES[currentLevel] ?? 1;
  const targetVal = LOG_LEVEL_VALUES[level];
  return targetVal >= currentVal;
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("key") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("password")
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function printLog(level: LogLevel, message: string, metadata: Record<string, unknown> = {}) {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const sanitizedMeta = sanitizeMetadata(metadata);

  if (process.env.NODE_ENV === "production") {
    // Structured JSON output for production
    console.log(
      JSON.stringify({
        timestamp,
        level,
        message,
        metadata: sanitizedMeta,
      })
    );
  } else {
    // Pretty colored console output for development
    const colorMap: Record<LogLevel, string> = {
      DEBUG: "\x1b[36m", // Cyan
      INFO: "\x1b[32m",  // Green
      WARN: "\x1b[33m",  // Yellow
      ERROR: "\x1b[31m", // Red
    };
    const resetColor = "\x1b[0m";
    const color = colorMap[level] || "";

    console.log(
      `[${timestamp}] ${color}${level.padEnd(5)}${resetColor} ${message}${
        Object.keys(sanitizedMeta).length > 0 ? " " + JSON.stringify(sanitizedMeta) : ""
      }`
    );
  }
}

export const logger = {
  debug(message: string, metadata: Record<string, unknown> = {}) {
    printLog("DEBUG", message, metadata);
  },
  info(message: string, metadata: Record<string, unknown> = {}) {
    printLog("INFO", message, metadata);
  },
  warn(message: string, metadata: Record<string, unknown> = {}) {
    printLog("WARN", message, metadata);
  },
  error(message: string, metadata: Record<string, unknown> = {}) {
    printLog("ERROR", message, metadata);
  },
};
