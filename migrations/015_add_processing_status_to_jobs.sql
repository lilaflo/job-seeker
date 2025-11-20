-- Migration: Add processing_status column to jobs table
-- Purpose: Track the processing state of jobs for step-by-step debugging
-- Created: 2024-11-20

ALTER TABLE jobs ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending'
  CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create index for filtering by processing status
CREATE INDEX IF NOT EXISTS idx_jobs_processing_status ON jobs(processing_status);

-- Update existing jobs to 'completed' status (they were already processed)
UPDATE jobs SET processing_status = 'completed' WHERE description IS NOT NULL;
