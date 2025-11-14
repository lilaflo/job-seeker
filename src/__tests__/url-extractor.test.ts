import { describe, it, expect } from 'vitest';
import {
  extractAllUrls,
  extractJobUrls,
  extractJobTitle,
  deduplicateUrls,
} from '../url-extractor';

describe('url-extractor', () => {
  describe('extractAllUrls', () => {
    it('should extract HTTP and HTTPS URLs from text', () => {
      const text = `
        Check out this job: https://example.com/jobs/123
        And this one: http://test.com/career
        Email me at test@example.com
      `;

      const urls = extractAllUrls(text);

      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://example.com/jobs/123');
      expect(urls).toContain('http://test.com/career');
    });

    it('should handle URLs with query parameters', () => {
      const text = 'Apply here: https://jobs.company.com/apply?id=123&source=email';

      const urls = extractAllUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://jobs.company.com/apply?id=123&source=email');
    });

    it('should remove trailing punctuation', () => {
      const text = 'Visit https://example.com/jobs. More info: https://test.com/career!';

      const urls = extractAllUrls(text);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe('https://example.com/jobs');
      expect(urls[1]).toBe('https://test.com/career');
    });

    it('should return empty array for text without URLs', () => {
      const text = 'This is just plain text without any links.';

      const urls = extractAllUrls(text);

      expect(urls).toHaveLength(0);
    });

    it('should return empty array for empty text', () => {
      const urls = extractAllUrls('');

      expect(urls).toHaveLength(0);
    });
  });

  describe('extractJobUrls', () => {
    it('should extract LinkedIn job URLs', () => {
      const text = 'Apply: https://www.linkedin.com/jobs/view/123456789';

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('linkedin.com/jobs/view');
    });

    it('should extract Indeed job URLs', () => {
      const text = 'Check out: https://www.indeed.com/viewjob?jk=abc123';

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('indeed.com');
    });

    it('should extract Freelancermap project URLs', () => {
      const text = 'Project: https://www.freelancermap.de/projektboerse/project/12345';

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('freelancermap.de');
    });

    it('should extract Greenhouse job board URLs', () => {
      const text = 'Apply here: https://boards.greenhouse.io/company/jobs/123456';

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('greenhouse.io');
    });

    it('should extract generic career page URLs', () => {
      const text = 'Visit our careers page: https://company.com/careers/software-engineer';

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('/careers/');
    });

    it('should filter out non-job URLs', () => {
      const text = `
        Job: https://example.com/jobs/developer
        Blog: https://example.com/blog/post
        Home: https://example.com/
      `;

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('/jobs/');
    });

    it('should return empty array when no job URLs found', () => {
      const text = 'Visit our website: https://example.com';

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(0);
    });

    it('should extract multiple job URLs from same text', () => {
      const text = `
        Position 1: https://linkedin.com/jobs/view/111
        Position 2: https://indeed.com/viewjob?jk=222
        Position 3: https://company.com/careers/333
      `;

      const urls = extractJobUrls(text);

      expect(urls).toHaveLength(3);
    });
  });

  describe('extractJobTitle', () => {
    it('should extract title from subject', () => {
      const subject = 'Senior Software Engineer - Remote';

      const title = extractJobTitle(subject);

      expect(title).toBe('Senior Software Engineer - Remote');
    });

    it('should remove Re: prefix from subject', () => {
      const subject = 'Re: Software Developer Position';

      const title = extractJobTitle(subject);

      expect(title).toBe('Software Developer Position');
    });

    it('should remove Fwd: prefix from subject', () => {
      const subject = 'Fwd: Job Opening - Data Scientist';

      const title = extractJobTitle(subject);

      expect(title).toBe('Job Opening - Data Scientist');
    });

    it('should remove brackets from subject', () => {
      const subject = '[Company Name] Backend Engineer Opportunity';

      const title = extractJobTitle(subject);

      expect(title).toBe('Backend Engineer Opportunity');
    });

    it('should remove trailing metadata', () => {
      const subject = 'Full Stack Developer (San Francisco)';

      const title = extractJobTitle(subject);

      expect(title).toBe('Full Stack Developer');
    });

    it('should return default title for null subject', () => {
      const title = extractJobTitle(null);

      expect(title).toBe('Job Opportunity');
    });

    it('should return default title for empty subject', () => {
      const title = extractJobTitle('');

      expect(title).toBe('Job Opportunity');
    });

    it('should truncate very long titles', () => {
      const subject = 'A'.repeat(250);

      const title = extractJobTitle(subject);

      expect(title.length).toBe(200);
      expect(title).toMatch(/\.\.\.$/);
    });

    it('should extract title from body when subject is short', () => {
      const subject = 'Job';
      const body = 'Position: Senior DevOps Engineer\nWe are hiring...';

      const title = extractJobTitle(subject, body);

      expect(title).toBe('Senior DevOps Engineer');
    });
  });

  describe('deduplicateUrls', () => {
    it('should remove exact duplicate URLs', () => {
      const urls = [
        'https://example.com/jobs/123',
        'https://example.com/jobs/123',
        'https://example.com/jobs/456',
      ];

      const deduplicated = deduplicateUrls(urls);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated).toContain('https://example.com/jobs/123');
      expect(deduplicated).toContain('https://example.com/jobs/456');
    });

    it('should remove URLs that differ only in tracking parameters', () => {
      const urls = [
        'https://example.com/jobs/123?utm_source=email',
        'https://example.com/jobs/123?utm_campaign=hiring',
        'https://example.com/jobs/123',
      ];

      const deduplicated = deduplicateUrls(urls);

      expect(deduplicated).toHaveLength(1);
    });

    it('should preserve URLs with different paths', () => {
      const urls = [
        'https://example.com/jobs/123?utm_source=email',
        'https://example.com/jobs/456?utm_source=email',
      ];

      const deduplicated = deduplicateUrls(urls);

      expect(deduplicated).toHaveLength(2);
    });

    it('should handle invalid URLs gracefully', () => {
      const urls = [
        'https://example.com/jobs/123',
        'not-a-valid-url',
        'https://example.com/jobs/123',
      ];

      const deduplicated = deduplicateUrls(urls);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated).toContain('https://example.com/jobs/123');
      expect(deduplicated).toContain('not-a-valid-url');
    });

    it('should return empty array for empty input', () => {
      const deduplicated = deduplicateUrls([]);

      expect(deduplicated).toHaveLength(0);
    });

    it('should preserve original URL even after normalization', () => {
      const urls = [
        'https://example.com/jobs/123?utm_source=email&id=456',
      ];

      const deduplicated = deduplicateUrls(urls);

      expect(deduplicated[0]).toBe('https://example.com/jobs/123?utm_source=email&id=456');
    });
  });
});
