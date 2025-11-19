/**
 * Tests for Bull job processors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Bull from 'bull';
import { processEmbeddingJob } from '../jobs/embedding.job';
import { processEmailScanJob } from '../jobs/email-scan.job';
import { processJobExtractionJob } from '../jobs/job-extraction.job';
import { processJobProcessingJob, setOllamaModel } from '../jobs/job-processing.job';

// Mock all dependencies
vi.mock('../embeddings', () => ({
  generateAndSaveJobEmbedding: vi.fn().mockResolvedValue(undefined),
  getBlacklistKeywords: vi.fn(() => []),
  bufferToEmbedding: vi.fn((buf) => [0.1, 0.2, 0.3]),
  cosineSimilarity: vi.fn(() => 0.5),
  getJobEmbedding: vi.fn(() => [0.1, 0.2, 0.3]),
}));

vi.mock('../database', () => ({
  markJobBlacklisted: vi.fn(),
  saveJob: vi.fn(),
  isJobScanned: vi.fn(() => false),
  canCrawlUrl: vi.fn(() => true),
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({ id: 1 })),
    })),
  })),
}));

vi.mock('../scan-runner', () => ({
  runScan: vi.fn(async ({ onProgress, onEmailProcessed }) => {
    // Simulate progress events
    if (onProgress) {
      onProgress({ type: 'start', message: 'Starting...', current: 0, total: 1 });
      onProgress({ type: 'end', message: 'Done', current: 1, total: 1 });
    }
    if (onEmailProcessed) {
      onEmailProcessed({ isJobRelated: true, confidence: 'high', subject: 'Test Job' });
    }
    return {
      success: true,
      message: 'Scan complete',
      processed: 5,
      jobRelated: 3,
      skipped: 2,
      jobsEnqueued: 3,
      stats: {
        total: 5,
        jobRelated: 3,
        highConfidence: 2,
        mediumConfidence: 1,
        lowConfidence: 0,
      },
    };
  }),
}));

vi.mock('../url-extractor', () => ({
  extractJobUrls: vi.fn((body) => ['https://example.com/job/1']),
  extractJobTitle: vi.fn(() => 'Software Engineer'),
  deduplicateUrls: vi.fn((urls) => urls),
}));

vi.mock('../job-scraper', () => ({
  scrapeJobPage: vi.fn(async () => ({
    error: null,
    description: 'This is a great job opportunity for a software engineer with 5+ years of experience in full-stack development. We are looking for someone who is passionate about technology.',
    salary: {
      min: 80000,
      max: 120000,
      currency: 'USD',
      period: 'yearly',
    },
  })),
}));

vi.mock('../queue', () => ({
  enqueueJobProcessing: vi.fn().mockResolvedValue(undefined),
  enqueueJobExtraction: vi.fn().mockResolvedValue(undefined),
  checkRedisConnection: vi.fn().mockResolvedValue(true),
}));

describe('Job Processors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processEmbeddingJob', () => {
    it('should generate embedding successfully', async () => {
      const job = {
        data: {
          jobId: 1,
          title: 'Software Engineer',
          description: 'Great job opportunity',
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processEmbeddingJob(job);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe(1);
      expect(result.blacklisted).toBe(false);
    });

    it('should handle errors and throw for retry', async () => {
      const { generateAndSaveJobEmbedding } = await import('../embeddings');
      vi.mocked(generateAndSaveJobEmbedding).mockRejectedValueOnce(new Error('Ollama unavailable'));

      const job = {
        data: {
          jobId: 1,
          title: 'Software Engineer',
          description: 'Great job opportunity',
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      await expect(processEmbeddingJob(job)).rejects.toThrow('Ollama unavailable');
    });
  });

  describe('processEmailScanJob', () => {
    it('should scan emails successfully', async () => {
      const job = {
        data: {
          query: 'newer_than:7d',
          maxResults: 20,
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processEmailScanJob(job);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(5);
      expect(result.jobRelated).toBe(3);
      expect(result.skipped).toBe(2);
    });

    it('should handle scan errors gracefully', async () => {
      const { runScan } = await import('../scan-runner');
      vi.mocked(runScan).mockRejectedValueOnce(new Error('Gmail API error'));

      const job = {
        data: {
          query: 'newer_than:7d',
          maxResults: 20,
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processEmailScanJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gmail API error');
      expect(result.processed).toBe(0);
    });
  });

  describe('processJobExtractionJob', () => {
    it('should extract jobs from email successfully', async () => {
      const job = {
        data: {
          emailId: 1,
          gmailId: 'gmail123',
          subject: 'Software Engineer position',
          body: 'Apply here: https://example.com/job/1',
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processJobExtractionJob(job);

      expect(result.success).toBe(true);
      expect(result.emailId).toBe(1);
      expect(result.jobsExtracted).toBe(1);
    });

    it('should handle emails with no job URLs', async () => {
      const { extractJobUrls } = await import('../url-extractor');
      vi.mocked(extractJobUrls).mockReturnValueOnce([]);

      const job = {
        data: {
          emailId: 1,
          gmailId: 'gmail123',
          subject: 'Newsletter',
          body: 'No job URLs here',
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processJobExtractionJob(job);

      expect(result.success).toBe(true);
      expect(result.jobsExtracted).toBe(0);
    });

    it('should handle extraction errors', async () => {
      const { extractJobUrls } = await import('../url-extractor');
      vi.mocked(extractJobUrls).mockImplementationOnce(() => {
        throw new Error('Extraction failed');
      });

      const job = {
        data: {
          emailId: 1,
          gmailId: 'gmail123',
          subject: 'Software Engineer position',
          body: 'Apply here: https://example.com/job/1',
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processJobExtractionJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Extraction failed');
    });
  });

  describe('processJobProcessingJob', () => {
    beforeEach(() => {
      setOllamaModel('llama3.2');
    });

    afterEach(() => {
      setOllamaModel(null);
    });

    it('should process job with description successfully', async () => {
      const job = {
        data: {
          jobId: 1,
          title: 'Software Engineer',
          url: 'https://example.com/job/1',
          emailId: 1,
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processJobProcessingJob(job);

      expect(result.success).toBe(true);
      expect(result.hasDescription).toBe(true);
      expect(result.hasEmbedding).toBe(true);
      expect(result.blacklisted).toBe(false);
    });

    it('should skip description fetch for non-crawlable URLs', async () => {
      const { canCrawlUrl } = await import('../database');
      vi.mocked(canCrawlUrl).mockReturnValueOnce(false);

      const job = {
        data: {
          jobId: 1,
          title: 'Software Engineer',
          url: 'https://linkedin.com/jobs/view/123',
          emailId: 1,
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processJobProcessingJob(job);

      expect(result.success).toBe(true);
      expect(result.hasDescription).toBe(false);
      expect(result.hasEmbedding).toBe(true);
    });

    it('should handle processing errors', async () => {
      const { generateAndSaveJobEmbedding } = await import('../embeddings');
      vi.mocked(generateAndSaveJobEmbedding).mockRejectedValueOnce(new Error('Embedding failed'));

      const job = {
        data: {
          jobId: 1,
          title: 'Software Engineer',
          url: 'https://example.com/job/1',
          emailId: 1,
        },
        progress: vi.fn(),
      } as unknown as Bull.Job;

      const result = await processJobProcessingJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Embedding failed');
    });
  });
});
