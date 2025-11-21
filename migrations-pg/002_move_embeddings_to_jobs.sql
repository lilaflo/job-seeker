-- Migration: Move embeddings from job_embeddings table to jobs table
-- Date: 2025-11-21

-- Drop the job_embeddings table
DROP TABLE IF EXISTS job_embeddings CASCADE;

-- Add embedding and embedding_model columns to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(255);

-- Create index on embedding for similarity search
-- Note: For large datasets, consider using ivfflat or hnsw index
-- CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
