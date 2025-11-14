-- Migration: Add description column to jobs table
-- Created: 2025-01-14
-- Stores AI-summarized job description from scraped job pages

-- Add description column
ALTER TABLE jobs ADD COLUMN description TEXT;

-- Add index for searching job descriptions
CREATE INDEX IF NOT EXISTS idx_jobs_description ON jobs(description);
