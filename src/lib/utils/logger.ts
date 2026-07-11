type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private getMinLevel(): LogLevel {
    if (typeof window === "undefined") {
      // Server-side
      return (process.env.LOG_LEVEL as LogLevel) || "info";
    }
    // Client-side default
    return "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevel = this.getMinLevel();
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: unknown): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: unknown) {
    if (!this.shouldLog("debug")) return;
    console.debug(this.formatMessage("debug", message, context));
  }

  info(message: string, context?: unknown) {
    if (!this.shouldLog("info")) return;
    console.info(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: unknown) {
    if (!this.shouldLog("warn")) return;
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, context?: unknown) {
    if (!this.shouldLog("error")) return;
    console.error(this.formatMessage("error", message, context));
  }
}

export const logger = new Logger();
