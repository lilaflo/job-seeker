/**
 * Global Logger Module
 * Provides centralized logging with database persistence
 */

import { saveLog } from "./database";

type LogLevel = "error" | "warning" | "info" | "debug";

interface LogOptions {
  source?: string;
  context?: Record<string, any>;
  skipConsole?: boolean;
  skipDatabase?: boolean;
}

/**
 * Get the calling file/function name from stack trace
 */
function getCallerInfo(): string {
  const stack = new Error().stack;
  if (!stack) return "unknown";

  const lines = stack.split("\n");
  // Skip first 3 lines: Error, getCallerInfo, log function
  const callerLine = lines[3] || "";

  // Extract file path from stack trace
  const match = callerLine.match(/at\s+(?:.*\s+)?\(?(.*):(\d+):(\d+)\)?/);
  if (match) {
    const fullPath = match[1];
    // Get just the filename without path
    const fileName = fullPath.split("/").pop() || fullPath;
    return fileName.replace(".ts", "").replace(".js", "");
  }

  return "unknown";
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, options?: LogOptions): void {
  const source = options?.source || getCallerInfo();
  const context = options?.context;

  // Capture stack trace for errors
  let stackTrace: string | undefined;
  if (level === "error") {
    const stack = new Error().stack;
    if (stack) {
      // Remove first 2 lines (Error and this function)
      stackTrace = stack.split("\n").slice(2).join("\n");
    }
  }

  // Write to console (unless skipped)
  if (!options?.skipConsole) {
    const prefix = `[${level.toUpperCase()}]`;
    const sourceInfo = source ? ` [${source}]` : "";
    const contextInfo = context ? ` ${JSON.stringify(context)}` : "";

    switch (level) {
      case "error":
        console.error(`${prefix}${sourceInfo} ${message}${contextInfo}`);
        if (stackTrace) {
          console.error(stackTrace);
        }
        break;
      case "warning":
        console.warn(`${prefix}${sourceInfo} ${message}${contextInfo}`);
        break;
      case "info":
        console.info(`${prefix}${sourceInfo} ${message}${contextInfo}`);
        break;
      case "debug":
        console.debug(`${prefix}${sourceInfo} ${message}${contextInfo}`);
        break;
    }
  }

  // Write to database (unless skipped)
  if (!options?.skipDatabase) {
    try {
      saveLog(level, message, {
        source,
        context,
        stackTrace,
      });
    } catch (err) {
      // If database logging fails, only log to console
      console.error("[LOGGER] Failed to save log to database:", err);
    }
  }
}

/**
 * Global logger instance with convenience methods
 */
export const logger = {
  /**
   * Log an error message
   */
  error(message: string, options?: LogOptions): void {
    log("error", message, options);
  },

  /**
   * Log a warning message
   */
  warning(message: string, options?: LogOptions): void {
    log("warning", message, options);
  },

  /**
   * Log an info message
   */
  info(message: string, options?: LogOptions): void {
    log("info", message, options);
  },

  /**
   * Log a debug message
   */
  debug(message: string, options?: LogOptions): void {
    log("debug", message, options);
  },

  /**
   * Log an error from an Error object
   */
  errorFromException(error: Error | unknown, options?: LogOptions): void {
    const message = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    const source = options?.source || getCallerInfo();

    // Write to console
    if (!options?.skipConsole) {
      console.error(`[ERROR] [${source}] ${message}`);
      if (stackTrace) {
        console.error(stackTrace);
      }
    }

    // Write to database
    if (!options?.skipDatabase) {
      try {
        saveLog("error", message, {
          source,
          context: options?.context,
          stackTrace,
        });
      } catch (err) {
        console.error("[LOGGER] Failed to save log to database:", err);
      }
    }
  },
};

export default logger;
