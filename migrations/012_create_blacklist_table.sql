-- Migration: Create blacklist table for keyword filtering
-- Created: 2025-11-19

-- Table to store blacklisted keywords with embeddings for semantic matching
CREATE TABLE IF NOT EXISTS blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  embedding BLOB,
  embedding_dim INTEGER DEFAULT 768,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for keyword lookups
CREATE INDEX IF NOT EXISTS idx_blacklist_keyword ON blacklist(keyword);
