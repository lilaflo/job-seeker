-- Migration: Add blacklisted column to jobs table
-- Created: 2025-11-19

-- Add blacklisted flag to jobs table (0 = visible, 1 = hidden due to blacklist match)
ALTER TABLE jobs ADD COLUMN blacklisted INTEGER NOT NULL DEFAULT 0 CHECK(blacklisted IN (0, 1));

-- Index for filtering blacklisted jobs
CREATE INDEX IF NOT EXISTS idx_jobs_blacklisted ON jobs(blacklisted);
