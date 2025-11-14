-- Migration: Add processed column to emails table
-- Purpose: Track which emails have been fully processed to prevent reprocessing
-- Created: 2025-11-14

ALTER TABLE emails ADD COLUMN processed INTEGER NOT NULL DEFAULT 0 CHECK(processed IN (0, 1));

-- Create index for fast filtering of unprocessed emails
CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed);

-- Optional: Mark all existing emails as processed (assumes they've already been handled)
-- Comment out the next line if you want to reprocess existing emails
UPDATE emails SET processed = 1;
