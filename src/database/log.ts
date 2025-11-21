/**
 * Log Database Functions
 * Handles log entry database operations
 */

import { query } from './index';

/**
 * Save a log entry to the database
 */
export function saveLog(
  level: 'error' | 'warning' | 'info' | 'debug',
  message: string,
  options?: {
    source?: string;
    context?: Record<string, any>;
    stackTrace?: string;
  }
): void {
  // Fire and forget - don't block on logging
  query(
    `INSERT INTO logs (level, message, source, context, stack_trace)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      level,
      message,
      options?.source || null,
      options?.context ? JSON.stringify(options.context) : null,
      options?.stackTrace || null,
    ]
  ).catch(err => {
    console.error('[LOGGER] Failed to save log to database:', err.message);
  });
}
