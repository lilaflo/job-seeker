import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeEmail, formatEmailForDisplay, checkOllamaAvailability, resetOllamaClient, type EmailMessage, type CategorizedEmail } from '../email-categorizer';
import { Ollama } from 'ollama';

// Mock Ollama
vi.mock('ollama');

describe('email-categorizer', () => {
  const mockEmail: EmailMessage = {
    id: 'test-email-1',
    threadId: 'thread-1',
    snippet: 'We have an exciting opportunity for a software engineer...',
    internalDate: '1234567890',
    subject: 'Software Engineer Position at TechCorp',
    from: 'recruiter@techcorp.com',
    to: 'user@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetOllamaClient(); // Reset the singleton client between tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkOllamaAvailability', () => {
    it('should return true when Ollama is available', async () => {
      const mockList = vi.fn().mockResolvedValue({
        models: [{ name: 'llama3.2' }],
      });

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          list: mockList,
        } as any;
      } as any);

      const available = await checkOllamaAvailability();

      expect(available).toBe(true);
      expect(mockList).toHaveBeenCalled();
    });

    it('should return false when Ollama is not available', async () => {
      const mockList = vi.fn().mockRejectedValue(new Error('Connection refused'));

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          list: mockList,
        } as any;
      } as any);

      const available = await checkOllamaAvailability();

      expect(available).toBe(false);
    });

    it('should return false when no models are available', async () => {
      const mockList = vi.fn().mockResolvedValue({
        models: [],
      });

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          list: mockList,
        } as any;
      } as any);

      const available = await checkOllamaAvailability();

      expect(available).toBe(false);
    });
  });

  describe('categorizeEmail', () => {
    it('should immediately recognize freelancermap domain as job-related', async () => {
      const jobEmail: EmailMessage = {
        id: 'test-id',
        threadId: 'thread-id',
        snippet: 'Neue Projekte verfügbar',
        internalDate: '1234567890',
        subject: 'Remote Jobs - Anzahl neue Projekte: 51',
        from: 'freelancermap Service - office@freelancermap.de',
        to: 'user@example.com',
      };

      // No Ollama mocking needed - should return immediately based on domain
      const category = await categorizeEmail(jobEmail);

      expect(category.isJobRelated).toBe(true);
      expect(category.confidence).toBe('high');
      expect(category.reason).toBe('From known job board/freelance platform domain');
    });

    it('should recognize linkedin domain as job-related', async () => {
      const linkedinEmail: EmailMessage = {
        id: 'test-id',
        threadId: 'thread-id',
        snippet: 'New job opportunities',
        internalDate: '1234567890',
        subject: 'Jobs you may be interested in',
        from: 'LinkedIn Jobs <jobs-noreply@linkedin.com>',
        to: 'user@example.com',
      };

      const category = await categorizeEmail(linkedinEmail);

      expect(category.isJobRelated).toBe(true);
      expect(category.confidence).toBe('high');
      expect(category.reason).toBe('From known job board/freelance platform domain');
    });

    it('should categorize a job-related email correctly using Ollama', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          isJobRelated: true,
          confidence: 'high',
          reason: 'Email contains job offer keywords',
          keywords: ['software engineer', 'position', 'opportunity'],
        }),
      });

      const mockList = vi.fn().mockResolvedValue({
        models: [{ name: 'llama3.2' }],
      });

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          generate: mockGenerate,
          list: mockList,
        } as any;
      } as any);

      const category = await categorizeEmail(mockEmail, 'Full email body about job opportunity');

      expect(category.isJobRelated).toBe(true);
      expect(category.confidence).toBe('high');
      expect(category.reason).toBe('Email contains job offer keywords');
      expect(category.matchedKeywords).toContain('software engineer');
    });

    it('should categorize a non-job-related email correctly', async () => {
      const nonJobEmail: EmailMessage = {
        ...mockEmail,
        subject: 'Meeting reminder',
        snippet: 'Don\'t forget about the team meeting tomorrow',
        from: 'colleague@company.com',
      };

      const mockGenerate = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          isJobRelated: false,
          confidence: 'high',
          reason: 'Email is about a team meeting, not a job offer',
          keywords: [],
        }),
      });

      const mockList = vi.fn().mockResolvedValue({
        models: [{ name: 'llama3.2' }],
      });

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          generate: mockGenerate,
          list: mockList,
        } as any;
      } as any);

      const category = await categorizeEmail(nonJobEmail, 'Team meeting details');

      expect(category.isJobRelated).toBe(false);
      expect(category.confidence).toBe('high');
    });

    it('should handle Ollama errors gracefully', async () => {
      const nonPortalEmail: EmailMessage = {
        ...mockEmail,
        from: 'someone@example.com', // Not a job portal domain
      };

      const mockGenerate = vi.fn().mockRejectedValue(new Error('Ollama connection failed'));
      const mockList = vi.fn().mockResolvedValue({
        models: [{ name: 'llama3.2' }],
      });

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          generate: mockGenerate,
          list: mockList,
        } as any;
      } as any);

      const category = await categorizeEmail(nonPortalEmail);

      expect(category.isJobRelated).toBe(false);
      expect(category.confidence).toBe('low');
      expect(category.reason).toContain('Ollama error');
    });

    it('should handle invalid JSON response from Ollama', async () => {
      const nonPortalEmail: EmailMessage = {
        ...mockEmail,
        from: 'someone@example.com',
      };

      const mockGenerate = vi.fn().mockResolvedValue({
        response: 'This is not valid JSON',
      });

      const mockList = vi.fn().mockResolvedValue({
        models: [{ name: 'llama3.2' }],
      });

      vi.mocked(Ollama).mockImplementation(function() {
        return {
          generate: mockGenerate,
          list: mockList,
        } as any;
      } as any);

      const category = await categorizeEmail(nonPortalEmail);

      expect(category.isJobRelated).toBe(false);
      expect(category.confidence).toBe('low');
      expect(category.reason).toContain('invalid format');
    });
  });

  describe('formatEmailForDisplay', () => {
    it('should format job-related email with green checkmark', () => {
      const categorizedEmail: CategorizedEmail = {
        ...mockEmail,
        category: {
          isJobRelated: true,
          confidence: 'high',
          matchedKeywords: ['job', 'position'],
          reason: 'Job offer detected',
        },
      };

      const formatted = formatEmailForDisplay(categorizedEmail, 0);

      expect(formatted).toContain('✓');
      expect(formatted).toContain('Software Engineer Position at TechCorp');
      expect(formatted).toContain('[high]');
      expect(formatted).toMatch(/\x1b\[32m/); // Green color code
    });

    it('should format non-job-related email with red X', () => {
      const categorizedEmail: CategorizedEmail = {
        ...mockEmail,
        subject: 'Newsletter',
        category: {
          isJobRelated: false,
          confidence: 'high',
          matchedKeywords: [],
          reason: 'Not a job offer',
        },
      };

      const formatted = formatEmailForDisplay(categorizedEmail, 0);

      expect(formatted).toContain('✗');
      expect(formatted).toContain('Newsletter');
      expect(formatted).toContain('[high]');
      expect(formatted).toMatch(/\x1b\[31m/); // Red color code
    });

    it('should handle emails without subject', () => {
      const categorizedEmail: CategorizedEmail = {
        ...mockEmail,
        subject: undefined,
        category: {
          isJobRelated: false,
          confidence: 'low',
          matchedKeywords: [],
          reason: 'No subject',
        },
      };

      const formatted = formatEmailForDisplay(categorizedEmail, 0);

      expect(formatted).toContain('(no subject)');
    });

    it('should display confidence level', () => {
      const categorizedEmail: CategorizedEmail = {
        ...mockEmail,
        category: {
          isJobRelated: true,
          confidence: 'medium',
          matchedKeywords: [],
          reason: 'Possible job offer',
        },
      };

      const formatted = formatEmailForDisplay(categorizedEmail, 5);

      expect(formatted).toContain('[medium]');
      expect(formatted).toContain('6.'); // index + 1
    });
  });
});
