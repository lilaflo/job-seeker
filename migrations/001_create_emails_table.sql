-- Migration: Create emails table for storing categorized emails
-- Created: 2024-01-14

-- Create emails table for storing scanned emails
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_id TEXT NOT NULL UNIQUE,
  subject TEXT,
  body TEXT,
  confidence TEXT NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
  is_job_related INTEGER NOT NULL CHECK(is_job_related IN (0, 1)),
  reason TEXT,
  created_at TEXT NOT NULL,
  scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by gmail_id
CREATE INDEX IF NOT EXISTS idx_gmail_id ON emails(gmail_id);

-- Index for filtering by confidence
CREATE INDEX IF NOT EXISTS idx_confidence ON emails(confidence);

-- Index for filtering by job-related status
CREATE INDEX IF NOT EXISTS idx_is_job_related ON emails(is_job_related);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_created_at ON emails(created_at);
