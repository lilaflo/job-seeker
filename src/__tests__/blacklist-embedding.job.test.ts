/**
 * Tests for blacklist-embedding.job module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processBlacklistEmbeddingJob } from "../jobs/blacklist-embedding.job";
import Bull from "bull";
import type { BlacklistEmbeddingJobData } from "../queue";

// Mock the embeddings module
const mockGenerateEmbedding = vi.fn();
const mockUpdateBlacklistKeywordEmbedding = vi.fn();
const mockGetJobEmbedding = vi.fn();
const mockCosineSimilarity = vi.fn();
const mockBufferToEmbedding = vi.fn();

vi.mock("../embeddings", () => ({
  generateEmbedding: (...args: any[]) => mockGenerateEmbedding(...args),
  updateBlacklistKeywordEmbedding: (...args: any[]) =>
    mockUpdateBlacklistKeywordEmbedding(...args),
  getJobEmbedding: (...args: any[]) => mockGetJobEmbedding(...args),
  cosineSimilarity: (...args: any[]) => mockCosineSimilarity(...args),
  bufferToEmbedding: (...args: any[]) => mockBufferToEmbedding(...args),
}));

// Mock the database module
const mockMarkJobBlacklisted = vi.fn();
const mockGetDatabase = vi.fn();

vi.mock("../database", () => ({
  markJobBlacklisted: (...args: any[]) => mockMarkJobBlacklisted(...args),
  getDatabase: () => mockGetDatabase(),
}));

// Mock the logger module
vi.mock("../logger", () => ({
  logger: {
    errorFromException: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock the pubsub module
const mockPublishJobEvent = vi.fn();

vi.mock("../pubsub", () => ({
  publishJobEvent: (...args: any[]) => mockPublishJobEvent(...args),
}));

describe("processBlacklistEmbeddingJob", () => {
  const mockPrepare = vi.fn();
  const mockAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup database mock
    mockGetDatabase.mockReturnValue({
      prepare: mockPrepare,
    });

    mockPrepare.mockReturnValue({
      all: mockAll,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should generate embedding and check jobs successfully", async () => {
    const jobData: BlacklistEmbeddingJobData = {
      keyword: "junior",
      blacklistId: 1,
    };

    const job = {
      id: "test-job-1",
      data: jobData,
    } as Bull.Job<BlacklistEmbeddingJobData>;

    // Mock embedding generation
    const testEmbedding = new Array(768).fill(0.5);
    mockGenerateEmbedding.mockResolvedValue(testEmbedding);

    // Mock jobs with embeddings (2 jobs, 1 will be blacklisted)
    const jobEmbedding1 = new Array(768).fill(0.8);
    const jobEmbedding2 = new Array(768).fill(0.3);
    const jobBuffer1 = Buffer.from([1, 2, 3]);
    const jobBuffer2 = Buffer.from([4, 5, 6]);

    mockAll.mockReturnValue([
      { id: 100, title: "Junior Developer", embedding: jobBuffer1 },
      { id: 101, title: "Senior Developer", embedding: jobBuffer2 },
    ]);

    // Mock buffer to embedding conversion
    mockBufferToEmbedding
      .mockReturnValueOnce(jobEmbedding1)
      .mockReturnValueOnce(jobEmbedding2);

    // Mock similarity calculation (first job matches, second doesn't)
    mockCosineSimilarity
      .mockReturnValueOnce(0.75) // Above threshold (0.7)
      .mockReturnValueOnce(0.5); // Below threshold

    const result = await processBlacklistEmbeddingJob(job);

    expect(result.success).toBe(true);
    expect(result.blacklistId).toBe(1);
    expect(result.keyword).toBe("junior");
    expect(result.jobsBlacklisted).toBe(1);

    expect(mockGenerateEmbedding).toHaveBeenCalledWith("junior");
    expect(mockUpdateBlacklistKeywordEmbedding).toHaveBeenCalledWith(
      1,
      testEmbedding
    );
    expect(mockMarkJobBlacklisted).toHaveBeenCalledWith(100, true);
    expect(mockMarkJobBlacklisted).toHaveBeenCalledTimes(1);
    expect(mockPublishJobEvent).toHaveBeenCalledWith({
      type: 'job_removed',
      jobId: 100,
      reason: 'blacklisted',
    });
  });

  it("should handle no matching jobs", async () => {
    const jobData: BlacklistEmbeddingJobData = {
      keyword: "test",
      blacklistId: 2,
    };

    const job = {
      id: "test-job-2",
      data: jobData,
    } as Bull.Job<BlacklistEmbeddingJobData>;

    const testEmbedding = new Array(768).fill(0.5);
    mockGenerateEmbedding.mockResolvedValue(testEmbedding);

    // Mock jobs with embeddings (none match)
    const jobEmbedding1 = new Array(768).fill(0.2);
    const jobBuffer1 = Buffer.from([1, 2, 3]);

    mockAll.mockReturnValue([
      { id: 100, title: "Senior Developer", embedding: jobBuffer1 },
    ]);

    mockBufferToEmbedding.mockReturnValue(jobEmbedding1);
    mockCosineSimilarity.mockReturnValue(0.3); // Below threshold

    const result = await processBlacklistEmbeddingJob(job);

    expect(result.success).toBe(true);
    expect(result.jobsBlacklisted).toBe(0);
    expect(mockMarkJobBlacklisted).not.toHaveBeenCalled();
    expect(mockPublishJobEvent).not.toHaveBeenCalled();
  });

  it("should handle embedding generation failure", async () => {
    const jobData: BlacklistEmbeddingJobData = {
      keyword: "test",
      blacklistId: 3,
    };

    const job = {
      id: "test-job-3",
      data: jobData,
    } as Bull.Job<BlacklistEmbeddingJobData>;

    mockGenerateEmbedding.mockRejectedValue(new Error("Ollama unavailable"));

    const result = await processBlacklistEmbeddingJob(job);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to generate embedding");
    expect(result.jobsBlacklisted).toBe(0);
    expect(mockUpdateBlacklistKeywordEmbedding).not.toHaveBeenCalled();
    expect(mockMarkJobBlacklisted).not.toHaveBeenCalled();
  });

  it("should handle empty job list", async () => {
    const jobData: BlacklistEmbeddingJobData = {
      keyword: "test",
      blacklistId: 4,
    };

    const job = {
      id: "test-job-4",
      data: jobData,
    } as Bull.Job<BlacklistEmbeddingJobData>;

    const testEmbedding = new Array(768).fill(0.5);
    mockGenerateEmbedding.mockResolvedValue(testEmbedding);

    mockAll.mockReturnValue([]);

    const result = await processBlacklistEmbeddingJob(job);

    expect(result.success).toBe(true);
    expect(result.jobsBlacklisted).toBe(0);
    expect(mockMarkJobBlacklisted).not.toHaveBeenCalled();
  });

  it("should only check non-blacklisted jobs", async () => {
    const jobData: BlacklistEmbeddingJobData = {
      keyword: "junior",
      blacklistId: 5,
    };

    const job = {
      id: "test-job-5",
      data: jobData,
    } as Bull.Job<BlacklistEmbeddingJobData>;

    const testEmbedding = new Array(768).fill(0.5);
    mockGenerateEmbedding.mockResolvedValue(testEmbedding);

    // Verify SQL query includes WHERE blacklisted = 0
    mockAll.mockReturnValue([]);

    await processBlacklistEmbeddingJob(job);

    const sqlQuery = mockPrepare.mock.calls[0][0];
    expect(sqlQuery).toContain("WHERE j.blacklisted = 0");
  });
});
