-- Migration: Create job_skill_matches junction table
-- Created: 2024-01-14
-- Links jobs to required skills for classification and matching

-- Create junction table for job-skill relationships
CREATE TABLE IF NOT EXISTS job_skill_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  relevance_score INTEGER DEFAULT 50 CHECK(relevance_score >= 0 AND relevance_score <= 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES job_skills(id) ON DELETE CASCADE,
  UNIQUE(job_id, skill_id)
);

-- Index for finding all skills for a specific job
CREATE INDEX IF NOT EXISTS idx_job_skill_job_id ON job_skill_matches(job_id);

-- Index for finding all jobs requiring a specific skill
CREATE INDEX IF NOT EXISTS idx_job_skill_skill_id ON job_skill_matches(skill_id);

-- Index for sorting by relevance
CREATE INDEX IF NOT EXISTS idx_job_skill_relevance ON job_skill_matches(relevance_score DESC);

-- Composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_job_skill_composite ON job_skill_matches(job_id, skill_id);
