-- Migration: Add raw_source column to jobs table
-- Stores the raw HTML content from scraped job pages for debugging and re-processing

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS raw_source TEXT;

-- Add comment to document the column's purpose
COMMENT ON COLUMN jobs.raw_source IS 'Raw HTML content from the job page for debugging and re-processing';
