-- Migration: Create logs table for error and warning tracking
-- Created: 2025-01-19

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK(level IN ('error', 'warning', 'info', 'debug')),
  message TEXT NOT NULL,
  source TEXT,              -- Module/file that generated the log
  context TEXT,             -- JSON string for additional data
  stack_trace TEXT,         -- Stack trace for errors
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying by level
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

-- Index for querying by timestamp
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- Index for querying by source
CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
