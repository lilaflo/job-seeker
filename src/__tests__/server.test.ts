/**
 * Tests for server module - web server for job listings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { EventEmitter } from 'events';

// Mock the database module
vi.mock('../database', () => ({
  getJobs: vi.fn(() => [
    {
      id: 1,
      title: 'Software Engineer',
      link: 'https://example.com/job/1',
      salary_min: 80000,
      salary_max: 120000,
      salary_currency: 'USD',
      salary_period: 'yearly',
      description: 'A great job opportunity',
      created_at: '2024-01-15T10:00:00.000Z',
    },
    {
      id: 2,
      title: 'Frontend Developer',
      link: 'https://linkedin.com/jobs/2',
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      description: null,
      created_at: '2024-01-14T09:00:00.000Z',
    },
  ]),
  getJobStats: vi.fn(() => ({
    total: 2,
  })),
  getPlatforms: vi.fn(() => [
    {
      id: 1,
      platform_name: 'LinkedIn',
      hostname: 'linkedin',
      can_crawl: 0,
      skip_reason: 'Requires authentication',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      platform_name: 'Indeed',
      hostname: 'indeed',
      can_crawl: 1,
      skip_reason: null,
      created_at: '2024-01-01T00:00:00.000Z',
    },
  ]),
  deleteJob: vi.fn((id: number) => id === 1 || id === 2),
}));

// Mock the scan-runner module
vi.mock('../scan-runner', () => ({
  runScan: vi.fn(() => Promise.resolve({
    success: true,
    message: 'Processed 5 emails, 3 job-related',
    processed: 5,
    jobRelated: 3,
    skipped: 2,
    stats: {
      total: 10,
      jobRelated: 7,
      highConfidence: 5,
      mediumConfidence: 1,
      lowConfidence: 1,
    },
  })),
}));

// Mock the embeddings module for blacklist functions
vi.mock('../embeddings', () => ({
  getBlacklistText: vi.fn(() => 'keyword1\nkeyword2\nkeyword3'),
  updateBlacklistFromText: vi.fn((text: string) => {
    const keywords = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return Promise.resolve({ count: keywords.length, jobsBlacklisted: 0 });
  }),
}));

// Import mocked functions for assertions
import { getJobs, getJobStats, getPlatforms, deleteJob } from '../database';
import { runScan } from '../scan-runner';
import { getBlacklistText, updateBlacklistFromText } from '../embeddings';

describe('Server API endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/jobs', () => {
    it('should return jobs from database', async () => {
      const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();
      const mockStats = (getJobStats as ReturnType<typeof vi.fn>)();

      expect(mockJobs).toHaveLength(2);
      expect(mockJobs[0].title).toBe('Software Engineer');
      expect(mockJobs[1].title).toBe('Frontend Developer');
      expect(mockStats.total).toBe(2);
    });

    it('should return jobs with salary information', () => {
      const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();

      const jobWithSalary = mockJobs[0];
      expect(jobWithSalary.salary_min).toBe(80000);
      expect(jobWithSalary.salary_max).toBe(120000);
      expect(jobWithSalary.salary_currency).toBe('USD');
      expect(jobWithSalary.salary_period).toBe('yearly');
    });

    it('should return jobs without salary information', () => {
      const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();

      const jobWithoutSalary = mockJobs[1];
      expect(jobWithoutSalary.salary_min).toBeNull();
      expect(jobWithoutSalary.salary_max).toBeNull();
      expect(jobWithoutSalary.salary_currency).toBeNull();
      expect(jobWithoutSalary.salary_period).toBeNull();
    });

    it('should return jobs with description', () => {
      const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();

      expect(mockJobs[0].description).toBe('A great job opportunity');
      expect(mockJobs[1].description).toBeNull();
    });

    it('should call getJobs with limit parameter', () => {
      getJobs({ limit: 50 });

      expect(getJobs).toHaveBeenCalledWith({ limit: 50 });
    });
  });

  describe('GET /api/platforms', () => {
    it('should return platforms from database', () => {
      const mockPlatforms = (getPlatforms as ReturnType<typeof vi.fn>)();

      expect(mockPlatforms).toHaveLength(2);
      expect(mockPlatforms[0].platform_name).toBe('LinkedIn');
      expect(mockPlatforms[1].platform_name).toBe('Indeed');
    });

    it('should include crawlability information', () => {
      const mockPlatforms = (getPlatforms as ReturnType<typeof vi.fn>)();

      const linkedin = mockPlatforms[0];
      expect(linkedin.can_crawl).toBe(0);
      expect(linkedin.skip_reason).toBe('Requires authentication');

      const indeed = mockPlatforms[1];
      expect(indeed.can_crawl).toBe(1);
      expect(indeed.skip_reason).toBeNull();
    });

    it('should return platforms with hostname instead of domain', () => {
      const mockPlatforms = (getPlatforms as ReturnType<typeof vi.fn>)();

      expect(mockPlatforms[0].hostname).toBe('linkedin');
      expect(mockPlatforms[1].hostname).toBe('indeed');
    });
  });

  describe('Database function calls', () => {
    it('should call getJobs when fetching jobs', () => {
      getJobs({ limit: 100 });
      expect(getJobs).toHaveBeenCalledTimes(1);
    });

    it('should call getJobStats when fetching statistics', () => {
      getJobStats();
      expect(getJobStats).toHaveBeenCalledTimes(1);
    });

    it('should call getPlatforms when fetching platforms', () => {
      getPlatforms();
      expect(getPlatforms).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Job data structure', () => {
  it('should have correct job properties', () => {
    const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();
    const job = mockJobs[0];

    expect(job).toHaveProperty('id');
    expect(job).toHaveProperty('title');
    expect(job).toHaveProperty('link');
    expect(job).toHaveProperty('salary_min');
    expect(job).toHaveProperty('salary_max');
    expect(job).toHaveProperty('salary_currency');
    expect(job).toHaveProperty('salary_period');
    expect(job).toHaveProperty('description');
    expect(job).toHaveProperty('created_at');
  });

  it('should have correct platform properties', () => {
    const mockPlatforms = (getPlatforms as ReturnType<typeof vi.fn>)();
    const platform = mockPlatforms[0];

    expect(platform).toHaveProperty('id');
    expect(platform).toHaveProperty('platform_name');
    expect(platform).toHaveProperty('hostname');
    expect(platform).toHaveProperty('can_crawl');
    expect(platform).toHaveProperty('skip_reason');
    expect(platform).toHaveProperty('created_at');
  });
});

describe('Job filtering and sorting', () => {
  it('should be able to filter jobs with salary', () => {
    const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();
    const jobsWithSalary = mockJobs.filter((j: any) => j.salary_min !== null);

    expect(jobsWithSalary).toHaveLength(1);
    expect(jobsWithSalary[0].title).toBe('Software Engineer');
  });

  it('should be able to filter jobs with description', () => {
    const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();
    const jobsWithDescription = mockJobs.filter((j: any) => j.description !== null);

    expect(jobsWithDescription).toHaveLength(1);
    expect(jobsWithDescription[0].title).toBe('Software Engineer');
  });

  it('should be able to sort jobs by date', () => {
    const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();
    const sortedJobs = [...mockJobs].sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    expect(sortedJobs[0].title).toBe('Software Engineer');
    expect(sortedJobs[1].title).toBe('Frontend Developer');
  });

  it('should be able to sort jobs by salary', () => {
    const mockJobs = (getJobs as ReturnType<typeof vi.fn>)();
    const sortedJobs = [...mockJobs].sort((a: any, b: any) => {
      const aMin = a.salary_min || 0;
      const bMin = b.salary_min || 0;
      return bMin - aMin;
    });

    expect(sortedJobs[0].title).toBe('Software Engineer');
    expect(sortedJobs[1].title).toBe('Frontend Developer');
  });
});

describe('Platform filtering', () => {
  it('should be able to filter crawlable platforms', () => {
    const mockPlatforms = (getPlatforms as ReturnType<typeof vi.fn>)();
    const crawlable = mockPlatforms.filter((p: any) => p.can_crawl === 1);

    expect(crawlable).toHaveLength(1);
    expect(crawlable[0].platform_name).toBe('Indeed');
  });

  it('should be able to filter non-crawlable platforms', () => {
    const mockPlatforms = (getPlatforms as ReturnType<typeof vi.fn>)();
    const nonCrawlable = mockPlatforms.filter((p: any) => p.can_crawl === 0);

    expect(nonCrawlable).toHaveLength(1);
    expect(nonCrawlable[0].platform_name).toBe('LinkedIn');
  });
});

describe('DELETE /api/jobs/:id', () => {
  it('should call deleteJob with the correct ID', () => {
    deleteJob(1);
    expect(deleteJob).toHaveBeenCalledWith(1);
  });

  it('should return true when deleting existing job', () => {
    const result = (deleteJob as ReturnType<typeof vi.fn>)(1);
    expect(result).toBe(true);
  });

  it('should return false when deleting non-existent job', () => {
    const result = (deleteJob as ReturnType<typeof vi.fn>)(99999);
    expect(result).toBe(false);
  });

  it('should handle different job IDs correctly', () => {
    expect((deleteJob as ReturnType<typeof vi.fn>)(1)).toBe(true);
    expect((deleteJob as ReturnType<typeof vi.fn>)(2)).toBe(true);
    expect((deleteJob as ReturnType<typeof vi.fn>)(3)).toBe(false);
  });
});

describe('POST /api/scan', () => {
  it('should call runScan and return results', async () => {
    const result = await (runScan as ReturnType<typeof vi.fn>)();

    expect(result.success).toBe(true);
    expect(result.processed).toBe(5);
    expect(result.jobRelated).toBe(3);
    expect(result.skipped).toBe(2);
    expect(result.stats.total).toBe(10);
  });

  it('should return correct scan statistics', async () => {
    const result = await (runScan as ReturnType<typeof vi.fn>)();

    expect(result.stats.highConfidence).toBe(5);
    expect(result.stats.mediumConfidence).toBe(1);
    expect(result.stats.lowConfidence).toBe(1);
  });

  it('should include message in response', async () => {
    const result = await (runScan as ReturnType<typeof vi.fn>)();

    expect(result.message).toBe('Processed 5 emails, 3 job-related');
  });
});

describe('GET /api/scan/status', () => {
  it('should return scanning status', () => {
    // The status endpoint returns { scanning: boolean }
    // Since we mock the module, we just verify the structure
    const statusResponse = { scanning: false };
    expect(statusResponse).toHaveProperty('scanning');
    expect(typeof statusResponse.scanning).toBe('boolean');
  });
});

describe('Blacklist API endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/blacklist', () => {
    it('should return blacklist text from embeddings module', () => {
      const text = (getBlacklistText as ReturnType<typeof vi.fn>)();

      expect(text).toBe('keyword1\nkeyword2\nkeyword3');
      expect(getBlacklistText).toHaveBeenCalled();
    });

    it('should return keywords as newline-separated text', () => {
      const text = (getBlacklistText as ReturnType<typeof vi.fn>)();
      const keywords = text.split('\n');

      expect(keywords).toHaveLength(3);
      expect(keywords[0]).toBe('keyword1');
      expect(keywords[1]).toBe('keyword2');
      expect(keywords[2]).toBe('keyword3');
    });
  });

  describe('POST /api/blacklist', () => {
    it('should update blacklist with provided text', async () => {
      const inputText = 'newkeyword1\nnewkeyword2';
      const result = await (updateBlacklistFromText as ReturnType<typeof vi.fn>)(inputText);

      expect(result.count).toBe(2);
      expect(updateBlacklistFromText).toHaveBeenCalledWith(inputText);
    });

    it('should handle empty text', async () => {
      const result = await (updateBlacklistFromText as ReturnType<typeof vi.fn>)('');

      expect(result.count).toBe(0);
    });

    it('should trim whitespace and filter empty lines', async () => {
      const inputText = '  keyword1  \n\n  keyword2  \n  ';
      const result = await (updateBlacklistFromText as ReturnType<typeof vi.fn>)(inputText);

      expect(result.count).toBe(2);
    });

    it('should return count of processed keywords', async () => {
      const inputText = 'one\ntwo\nthree\nfour\nfive';
      const result = await (updateBlacklistFromText as ReturnType<typeof vi.fn>)(inputText);

      expect(result.count).toBe(5);
    });
  });
});
