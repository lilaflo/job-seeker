-- Migration: Convert SMALLINT columns to BOOLEAN
-- Created: 2025-01-21
-- Description: Converts integer columns (0/1) to native PostgreSQL BOOLEAN type

-- Step 1: Drop CHECK constraints (they reference integer values 0 and 1)
-- PostgreSQL names these constraints automatically: tablename_columnname_check
ALTER TABLE platforms
  DROP CONSTRAINT IF EXISTS platforms_can_crawl_check;

ALTER TABLE emails
  DROP CONSTRAINT IF EXISTS emails_is_job_related_check;

ALTER TABLE emails
  DROP CONSTRAINT IF EXISTS emails_processed_check;

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_blacklisted_check;

-- Step 2: Drop existing default values (they are SMALLINT and can't auto-cast to BOOLEAN)
ALTER TABLE platforms
  ALTER COLUMN can_crawl DROP DEFAULT;

ALTER TABLE emails
  ALTER COLUMN processed DROP DEFAULT;

ALTER TABLE jobs
  ALTER COLUMN blacklisted DROP DEFAULT;

-- Step 2: Convert column types from SMALLINT to BOOLEAN
-- The USING clause converts: 1 → TRUE, 0 → FALSE

-- Platforms table: can_crawl (SMALLINT → BOOLEAN)
ALTER TABLE platforms
  ALTER COLUMN can_crawl TYPE BOOLEAN
  USING (can_crawl = 1);

-- Emails table: is_job_related (SMALLINT → BOOLEAN)
ALTER TABLE emails
  ALTER COLUMN is_job_related TYPE BOOLEAN
  USING (is_job_related = 1);

-- Emails table: processed (SMALLINT → BOOLEAN)
ALTER TABLE emails
  ALTER COLUMN processed TYPE BOOLEAN
  USING (processed = 1);

-- Jobs table: blacklisted (SMALLINT → BOOLEAN)
ALTER TABLE jobs
  ALTER COLUMN blacklisted TYPE BOOLEAN
  USING (blacklisted = 1);

-- Step 3: Set new default values using boolean literals
ALTER TABLE platforms
  ALTER COLUMN can_crawl SET DEFAULT TRUE;

ALTER TABLE emails
  ALTER COLUMN processed SET DEFAULT FALSE;

ALTER TABLE jobs
  ALTER COLUMN blacklisted SET DEFAULT FALSE;

-- Step 4: Ensure NOT NULL constraints are preserved
ALTER TABLE platforms
  ALTER COLUMN can_crawl SET NOT NULL;

ALTER TABLE emails
  ALTER COLUMN is_job_related SET NOT NULL;

ALTER TABLE emails
  ALTER COLUMN processed SET NOT NULL;

ALTER TABLE jobs
  ALTER COLUMN blacklisted SET NOT NULL;
