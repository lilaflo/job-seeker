-- Migration: Update blacklist embedding column to 768 dimensions
-- The blacklist table was created with vector(384) but should match
-- the jobs table which uses vector(768) for consistency

-- Alter the embedding column to use 768 dimensions
ALTER TABLE blacklist
  ALTER COLUMN embedding TYPE vector(768);
