-- Migration: Add from column to emails table
-- Purpose: Store sender email address to avoid re-fetching from Gmail
-- Created: 2025-11-14

ALTER TABLE emails ADD COLUMN from_address TEXT;

-- Create index for fast sender lookups
CREATE INDEX IF NOT EXISTS idx_emails_from_address ON emails(from_address);
