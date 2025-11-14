-- Migration: Create jobs table for tracking job postings
-- Created: 2024-01-14

-- Create jobs table for tracking job postings
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  email_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
);

-- Index for faster lookups by link (prevent duplicate job scans)
CREATE INDEX IF NOT EXISTS idx_job_link ON jobs(link);

-- Index for filtering jobs by email
CREATE INDEX IF NOT EXISTS idx_job_email_id ON jobs(email_id);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_job_created_at ON jobs(created_at);
