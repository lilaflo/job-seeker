-- Migration: Create job embeddings table for vector search
-- Created: 2025-11-19

-- Table to store vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS job_embeddings (
  job_id INTEGER PRIMARY KEY,
  embedding BLOB NOT NULL,
  embedding_dim INTEGER NOT NULL DEFAULT 768,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Index for faster lookups by model
CREATE INDEX IF NOT EXISTS idx_job_embeddings_model ON job_embeddings(model);
