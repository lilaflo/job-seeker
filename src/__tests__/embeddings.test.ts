/**
 * Tests for embeddings module - vector embeddings and semantic search
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
} from '../embeddings';
import { saveJob, clearAllJobs, closeDatabase, getJobs } from '../database';

describe('Embedding utilities', () => {
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

describe('Embedding storage', () => {
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

describe('EMBEDDING_DIM constant', () => {
  it('should be 768 for nomic-embed-text', () => {
    expect(EMBEDDING_DIM).toBe(768);
  });
});
