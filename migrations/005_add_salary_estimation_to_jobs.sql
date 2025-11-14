-- Migration: Add salary_estimation column to jobs table
-- Created: 2025-01-14
-- Stores estimated salary information for job postings

-- Add salary_estimation column (TEXT for flexibility: ranges, hourly, unknown)
ALTER TABLE jobs ADD COLUMN salary_estimation TEXT;

-- Index for filtering/sorting by salary
CREATE INDEX IF NOT EXISTS idx_jobs_salary ON jobs(salary_estimation);
