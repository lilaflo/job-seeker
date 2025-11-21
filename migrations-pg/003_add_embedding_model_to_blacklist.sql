-- Migration: Add embedding_model column to blacklist table
-- Date: 2025-11-21

-- Add embedding_model column to blacklist table
ALTER TABLE blacklist
  ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(255);
