import { describe, it, expect } from 'vitest';
import { extractDomain, isFromJobPortal } from '../job-portal-domains';

describe('job-portal-domains', () => {
  describe('extractDomain', () => {
    it('should extract domain from simple email address', () => {
      const domain = extractDomain('user@example.com');
      expect(domain).toBe('example.com');
    });

    it('should extract domain from email with display name', () => {
      const domain = extractDomain('John Doe <user@example.com>');
      expect(domain).toBe('example.com');
    });

    it('should handle email with trailing characters', () => {
      const domain = extractDomain('user@example.com>');
      expect(domain).toBe('example.com');
    });

    it('should return empty string for invalid email', () => {
      const domain = extractDomain('not-an-email');
      expect(domain).toBe('');
    });

    it('should handle empty string', () => {
      const domain = extractDomain('');
      expect(domain).toBe('');
    });
  });

  describe('isFromJobPortal', () => {
    it('should recognize freelancermap domain', () => {
      expect(isFromJobPortal('office@freelancermap.de')).toBe(true);
      expect(isFromJobPortal('service@freelancermap.com')).toBe(true);
    });

    it('should recognize linkedin domain', () => {
      expect(isFromJobPortal('jobs-noreply@linkedin.com')).toBe(true);
      expect(isFromJobPortal('LinkedIn Jobs <jobs@linkedin.com>')).toBe(true);
    });

    it('should recognize indeed domains', () => {
      expect(isFromJobPortal('noreply@indeed.com')).toBe(true);
      expect(isFromJobPortal('jobs@indeed.de')).toBe(true);
    });

    it('should recognize upwork domain', () => {
      expect(isFromJobPortal('notifications@upwork.com')).toBe(true);
    });

    it('should recognize stepstone domain', () => {
      expect(isFromJobPortal('service@stepstone.de')).toBe(true);
    });

    it('should recognize subdomains of job portals', () => {
      expect(isFromJobPortal('noreply@jobs.linkedin.com')).toBe(true);
      expect(isFromJobPortal('alerts@mail.indeed.com')).toBe(true);
    });

    it('should not recognize regular email domains', () => {
      expect(isFromJobPortal('user@gmail.com')).toBe(false);
      expect(isFromJobPortal('info@company.com')).toBe(false);
      expect(isFromJobPortal('recruiter@startup.io')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isFromJobPortal('')).toBe(false);
    });

    it('should handle invalid email', () => {
      expect(isFromJobPortal('not-an-email')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isFromJobPortal('User@LINKEDIN.COM')).toBe(true);
      expect(isFromJobPortal('INFO@FreelancerMap.De')).toBe(true);
    });
  });
});
