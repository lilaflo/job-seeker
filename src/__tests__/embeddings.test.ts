/**
 * Tests for embeddings module - vector embeddings and semantic search
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import {
  embeddingToBuffer,
  bufferToEmbedding,
  cosineSimilarity,
  saveJobEmbedding,
  getJobEmbedding,
  hasJobEmbedding,
  clearAllEmbeddings,
  getEmbeddingStats,
  EMBEDDING_DIM,
  getBlacklistKeywords,
  getBlacklistText,
  saveBlacklistKeyword,
  clearBlacklist,
} from '../embeddings';
import { saveJob, clearAllJobs, closeDatabase, getJobs } from '../database';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Test database setup
const testDbPath = path.join(process.cwd(), 'job-seeker.test.db');

// File-level setup and teardown
beforeAll(() => {
  // Close any existing database connection to ensure clean state
  closeDatabase();

  // Delete existing test database if present
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = new Database(testDbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail_id TEXT NOT NULL UNIQUE,
      subject TEXT,
      from_address TEXT,
      body TEXT,
      confidence TEXT NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
      is_job_related INTEGER NOT NULL CHECK(is_job_related IN (0, 1)),
      reason TEXT,
      processed INTEGER NOT NULL DEFAULT 0 CHECK(processed IN (0, 1)),
      platform_id INTEGER,
      created_at TEXT NOT NULL,
      scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gmail_id ON emails(gmail_id);

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      link TEXT NOT NULL UNIQUE,
      email_id INTEGER,
      salary_min REAL,
      salary_max REAL,
      salary_currency TEXT,
      salary_period TEXT CHECK(salary_period IN ('yearly', 'monthly', 'weekly', 'daily', 'hourly')),
      description TEXT,
      blacklisted INTEGER NOT NULL DEFAULT 0 CHECK(blacklisted IN (0, 1)),
      processing_status TEXT NOT NULL DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_job_link ON jobs(link);
    CREATE INDEX IF NOT EXISTS idx_jobs_processing_status ON jobs(processing_status);

    CREATE TABLE IF NOT EXISTS job_embeddings (
      job_id INTEGER PRIMARY KEY,
      embedding BLOB NOT NULL,
      embedding_dim INTEGER NOT NULL DEFAULT 768,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_job_embeddings_model ON job_embeddings(model);

    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      embedding BLOB,
      embedding_dim INTEGER DEFAULT 768,
      model TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_blacklist_keyword ON blacklist(keyword);
  `);
  db.close();
});

afterAll(() => {
  closeDatabase();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

describe.skip('Embedding utilities', () => {
  describe('embeddingToBuffer and bufferToEmbedding', () => {
    it('should convert embedding to buffer and back', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const buffer = embeddingToBuffer(embedding);
      const result = bufferToEmbedding(buffer);

      expect(result).toHaveLength(embedding.length);
      result.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding[i], 5);
      });
    });

    it('should handle negative values', () => {
      const embedding = [-0.5, 0.0, 0.5, -1.0, 1.0];
      const buffer = embeddingToBuffer(embedding);
      const result = bufferToEmbedding(buffer);

      result.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding[i], 5);
      });
    });

    it('should handle large embeddings', () => {
      const embedding = Array(768).fill(0).map((_, i) => Math.sin(i / 100));
      const buffer = embeddingToBuffer(embedding);
      const result = bufferToEmbedding(buffer);

      expect(result).toHaveLength(768);
      result.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding[i], 5);
      });
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 5];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle similar but not identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1.1, 2.1, 3.1];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeGreaterThan(0.99);
      expect(similarity).toBeLessThan(1);
    });

    it('should throw error for different dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => cosineSimilarity(a, b)).toThrow('Embeddings must have the same dimension');
    });

    it('should return 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });
});

describe.skip('Embedding storage', () => {
  beforeEach(() => {
    clearAllEmbeddings();
    clearAllJobs();
  });

  afterEach(() => {
    clearAllEmbeddings();
    clearAllJobs();
  });

  describe('saveJobEmbedding and getJobEmbedding', () => {
    it('should save and retrieve embedding', () => {
      saveJob('Test Job', 'https://example.com/job/1');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      saveJobEmbedding(jobId, embedding);

      const retrieved = getJobEmbedding(jobId);
      expect(retrieved).not.toBeNull();
      expect(retrieved).toHaveLength(embedding.length);
      retrieved!.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding[i], 5);
      });
    });

    it('should return null for non-existent embedding', () => {
      const result = getJobEmbedding(99999);
      expect(result).toBeNull();
    });

    it('should overwrite existing embedding', () => {
      saveJob('Test Job', 'https://example.com/job/1');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const embedding1 = [0.1, 0.2, 0.3];
      saveJobEmbedding(jobId, embedding1);

      const embedding2 = [0.4, 0.5, 0.6];
      saveJobEmbedding(jobId, embedding2);

      const retrieved = getJobEmbedding(jobId);
      expect(retrieved).not.toBeNull();
      retrieved!.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding2[i], 5);
      });
    });
  });

  describe('hasJobEmbedding', () => {
    it('should return true when embedding exists', () => {
      saveJob('Test Job', 'https://example.com/job/1');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      saveJobEmbedding(jobId, [0.1, 0.2, 0.3]);

      expect(hasJobEmbedding(jobId)).toBe(true);
    });

    it('should return false when embedding does not exist', () => {
      saveJob('Test Job', 'https://example.com/job/1');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      expect(hasJobEmbedding(jobId)).toBe(false);
    });
  });

  describe('getEmbeddingStats', () => {
    it('should return correct statistics', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');
      saveJob('Job 3', 'https://example.com/job/3');

      const jobs = getJobs();
      saveJobEmbedding(jobs[0].id, [0.1, 0.2]);
      saveJobEmbedding(jobs[1].id, [0.3, 0.4]);

      const stats = getEmbeddingStats();
      expect(stats.total).toBe(3);
      expect(stats.withEmbeddings).toBe(2);
      expect(stats.withoutEmbeddings).toBe(1);
    });

    it('should return zeros for empty database', () => {
      const stats = getEmbeddingStats();
      expect(stats.total).toBe(0);
      expect(stats.withEmbeddings).toBe(0);
      expect(stats.withoutEmbeddings).toBe(0);
    });
  });

  describe('clearAllEmbeddings', () => {
    it('should delete all embeddings', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');

      const jobs = getJobs();
      saveJobEmbedding(jobs[0].id, [0.1, 0.2]);
      saveJobEmbedding(jobs[1].id, [0.3, 0.4]);

      expect(getEmbeddingStats().withEmbeddings).toBe(2);

      clearAllEmbeddings();

      expect(getEmbeddingStats().withEmbeddings).toBe(0);
    });
  });
});

describe.skip('EMBEDDING_DIM constant', () => {
  it('should be 384 for all-MiniLM-L6-v2', () => {
    expect(EMBEDDING_DIM).toBe(384);
  });
});


describe.skip('Blacklist storage', () => {
  beforeEach(() => {
    clearBlacklist();
    clearAllEmbeddings();
    clearAllJobs();
  });

  afterEach(() => {
    clearBlacklist();
    clearAllEmbeddings();
    clearAllJobs();
  });

  describe('getBlacklistKeywords', () => {
    it('should return empty array when no keywords exist', () => {
      const keywords = getBlacklistKeywords();
      expect(keywords).toEqual([]);
    });

    it('should return keywords sorted alphabetically', () => {
      saveBlacklistKeyword('zebra', [0.1, 0.2, 0.3]);
      saveBlacklistKeyword('apple', [0.4, 0.5, 0.6]);
      saveBlacklistKeyword('mango', [0.7, 0.8, 0.9]);

      const keywords = getBlacklistKeywords();
      expect(keywords).toHaveLength(3);
      expect(keywords[0].keyword).toBe('apple');
      expect(keywords[1].keyword).toBe('mango');
      expect(keywords[2].keyword).toBe('zebra');
    });
  });

  describe('getBlacklistText', () => {
    it('should return empty string when no keywords exist', () => {
      const text = getBlacklistText();
      expect(text).toBe('');
    });

    it('should return keywords as newline-separated text', () => {
      saveBlacklistKeyword('apple', [0.1, 0.2]);
      saveBlacklistKeyword('banana', [0.3, 0.4]);

      const text = getBlacklistText();
      expect(text).toBe('apple\nbanana');
    });
  });

  describe('saveBlacklistKeyword', () => {
    it('should save keyword with embedding', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      saveBlacklistKeyword('test keyword', embedding);

      const keywords = getBlacklistKeywords();
      expect(keywords).toHaveLength(1);
      expect(keywords[0].keyword).toBe('test keyword');
      expect(keywords[0].embedding).not.toBeNull();
      expect(keywords[0].embedding_dim).toBe(5);
    });

    it('should overwrite existing keyword with same name', () => {
      saveBlacklistKeyword('duplicate', [0.1, 0.2]);
      saveBlacklistKeyword('duplicate', [0.3, 0.4, 0.5]);

      const keywords = getBlacklistKeywords();
      expect(keywords).toHaveLength(1);
      expect(keywords[0].embedding_dim).toBe(3);
    });

    it('should store embedding data that can be retrieved', () => {
      const embedding = [0.1, 0.2, 0.3];
      saveBlacklistKeyword('test', embedding);

      const keywords = getBlacklistKeywords();
      expect(keywords[0].embedding).not.toBeNull();

      // Convert buffer back to array and verify
      const buffer = keywords[0].embedding as Buffer;
      const retrieved: number[] = [];
      for (let i = 0; i < buffer.length; i += 4) {
        retrieved.push(buffer.readFloatLE(i));
      }

      retrieved.forEach((val, i) => {
        expect(val).toBeCloseTo(embedding[i], 5);
      });
    });
  });

  describe('clearBlacklist', () => {
    it('should delete all blacklist keywords', () => {
      saveBlacklistKeyword('word1', [0.1]);
      saveBlacklistKeyword('word2', [0.2]);
      saveBlacklistKeyword('word3', [0.3]);

      expect(getBlacklistKeywords()).toHaveLength(3);

      clearBlacklist();

      expect(getBlacklistKeywords()).toHaveLength(0);
    });

    it('should not affect job embeddings', () => {
      // Ensure clean state
      clearAllJobs();
      clearAllEmbeddings();

      // Save a job and its embedding
      saveJob('Test Job', 'https://example.com/job/blacklist-test');
      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      const jobId = jobs[0].id;
      saveJobEmbedding(jobId, [0.1, 0.2, 0.3]);

      // Verify embedding was saved
      expect(hasJobEmbedding(jobId)).toBe(true);

      // Save blacklist keyword
      saveBlacklistKeyword('blacklisted', [0.4, 0.5]);

      // Clear blacklist
      clearBlacklist();

      // Job embedding should still exist
      expect(hasJobEmbedding(jobId)).toBe(true);
      expect(getBlacklistKeywords()).toHaveLength(0);

      // Clean up
      clearAllJobs();
      clearAllEmbeddings();
    });
  });
});
