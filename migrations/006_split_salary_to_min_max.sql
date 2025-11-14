-- Migration: Split salary_estimation into structured min/max fields
-- Created: 2025-01-14
-- Replaces single text field with structured numeric salary data
-- SQLite doesn't support DROP COLUMN, so we recreate the table

-- Drop the old salary index first
DROP INDEX IF EXISTS idx_jobs_salary;

-- Create new jobs table with updated schema
CREATE TABLE jobs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  email_id INTEGER,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_period TEXT CHECK(salary_period IN ('yearly', 'monthly', 'weekly', 'daily', 'hourly')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
);

-- Copy data from old table to new table (salary_estimation will be lost)
INSERT INTO jobs_new (id, title, link, email_id, created_at, scanned_at)
SELECT id, title, link, email_id, created_at, scanned_at FROM jobs;

-- Drop old table
DROP TABLE jobs;

-- Rename new table to jobs
ALTER TABLE jobs_new RENAME TO jobs;

-- Recreate indexes
CREATE INDEX idx_job_link ON jobs(link);
CREATE INDEX idx_job_email_id ON jobs(email_id);
CREATE INDEX idx_job_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_salary_min ON jobs(salary_min);
CREATE INDEX idx_jobs_salary_max ON jobs(salary_max);
CREATE INDEX idx_jobs_salary_currency ON jobs(salary_currency);
