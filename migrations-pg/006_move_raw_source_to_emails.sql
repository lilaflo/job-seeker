-- Migration: Move raw_source from jobs to emails table
-- Store raw email HTML instead of scraped job page HTML
-- This allows re-processing emails without re-fetching from Gmail

-- Remove raw_source from jobs table
ALTER TABLE jobs
  DROP COLUMN IF EXISTS raw_source;

-- Add raw_source to emails table
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS raw_source TEXT;

-- Add comment to document the column's purpose
COMMENT ON COLUMN emails.raw_source IS 'Raw HTML content from the email body for re-processing without Gmail API calls';
