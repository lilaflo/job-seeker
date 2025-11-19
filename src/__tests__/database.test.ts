import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import {
  saveEmail,
  isEmailScanned,
  getScannedEmailIds,
  markEmailAsProcessed,
  markEmailsAsProcessed,
  getUnprocessedEmails,
  getHighConfidenceEmails,
  getEmails,
  getEmailStats,
  clearAllEmails,
  saveJob,
  isJobScanned,
  getScannedJobLinks,
  getJobs,
  getJobById,
  getJobStats,
  clearAllJobs,
  deleteJob,
  addSkillToJob,
  addSkillsToJob,
  removeSkillFromJob,
  getSkillsForJob,
  getJobsForSkill,
  getJobMatchScore,
  findMatchingJobs,
  getJobSkillMatchStats,
  clearAllJobSkillMatches,
  getSkillByName,
  getPlatforms,
  getPlatformByDomain,
  getPlatformIdFromEmail,
  canCrawlUrl,
  getSkipReason,
  updatePlatformCrawlability,
  getPlatformStats,
  closeDatabase,
} from '../database';
import type { EmailMessage } from '../email-scanner';
import type { EmailCategory } from '../email-categorizer';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

describe('database', () => {
  const testDbPath = path.join(process.cwd(), 'job-seeker.test.db');

  beforeAll(() => {
    // Create database and tables for testing
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
        platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_gmail_id ON emails(gmail_id);
      CREATE INDEX IF NOT EXISTS idx_confidence ON emails(confidence);
      CREATE INDEX IF NOT EXISTS idx_is_job_related ON emails(is_job_related);
      CREATE INDEX IF NOT EXISTS idx_created_at ON emails(created_at);
      CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed);
      CREATE INDEX IF NOT EXISTS idx_emails_platform_id ON emails(platform_id);
      CREATE INDEX IF NOT EXISTS idx_emails_from_address ON emails(from_address);

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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_job_link ON jobs(link);
      CREATE INDEX IF NOT EXISTS idx_job_email_id ON jobs(email_id);
      CREATE INDEX IF NOT EXISTS idx_job_created_at ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_salary_min ON jobs(salary_min);
      CREATE INDEX IF NOT EXISTS idx_jobs_salary_max ON jobs(salary_max);
      CREATE INDEX IF NOT EXISTS idx_jobs_salary_currency ON jobs(salary_currency);
      CREATE INDEX IF NOT EXISTS idx_jobs_description ON jobs(description);

      CREATE TABLE IF NOT EXISTS job_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        proficiency_level TEXT CHECK(proficiency_level IN ('Expert', 'Advanced', 'Proficient', 'Intermediate', 'Basic')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_skill_name ON job_skills(name);
      CREATE INDEX IF NOT EXISTS idx_skill_category ON job_skills(category);
      CREATE INDEX IF NOT EXISTS idx_skill_proficiency ON job_skills(proficiency_level);

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
      CREATE INDEX IF NOT EXISTS idx_job_skill_job_id ON job_skill_matches(job_id);
      CREATE INDEX IF NOT EXISTS idx_job_skill_skill_id ON job_skill_matches(skill_id);
      CREATE INDEX IF NOT EXISTS idx_job_skill_relevance ON job_skill_matches(relevance_score DESC);
      CREATE INDEX IF NOT EXISTS idx_job_skill_composite ON job_skill_matches(job_id, skill_id);

      CREATE TABLE IF NOT EXISTS platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_name TEXT NOT NULL,
        hostname TEXT NOT NULL UNIQUE,
        can_crawl INTEGER NOT NULL DEFAULT 1 CHECK(can_crawl IN (0, 1)),
        skip_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_platforms_hostname ON platforms(hostname);
      CREATE INDEX IF NOT EXISTS idx_platforms_can_crawl ON platforms(can_crawl);

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

      -- Insert test skills
      INSERT INTO job_skills (name, category, proficiency_level) VALUES
        ('JavaScript', 'Programming Languages', 'Expert'),
        ('TypeScript', 'Programming Languages', 'Expert'),
        ('Node.js', 'Programming Languages', 'Expert'),
        ('React', 'Modern Web Stack', 'Proficient'),
        ('Docker', 'Cloud & Infrastructure', 'Expert'),
        ('AWS', 'Cloud & Infrastructure', 'Advanced'),
        ('PostgreSQL', 'Databases', 'Proficient'),
        ('MongoDB', 'Databases', 'Expert');

      -- Insert test platforms (hostname without TLD for TLD-agnostic matching)
      INSERT INTO platforms (platform_name, hostname, can_crawl, skip_reason) VALUES
        ('LinkedIn', 'linkedin', 0, 'Requires multi-level authentication (username, password, mobile app)'),
        ('Indeed', 'indeed', 1, NULL),
        ('Greenhouse', 'greenhouse', 1, NULL),
        ('Test Platform', 'example', 1, NULL),
        ('FreelancerMap', 'freelancermap', 1, NULL),
        ('Jobs.ch', 'jobs', 1, NULL),
        ('Experteer', 'experteer', 1, NULL);
    `);
    db.close();
  });

  beforeEach(() => {
    // Clear database before each test
    clearAllJobSkillMatches();
    clearAllEmails();
    clearAllJobs();
  });

  afterEach(() => {
    // Clear database after each test
    clearAllJobSkillMatches();
    clearAllEmails();
    clearAllJobs();
  });

  afterAll(() => {
    // Close database connection and clean up
    closeDatabase();

    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Remove WAL files if they exist
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  const createMockEmail = (id: string, subject: string): EmailMessage => ({
    id,
    threadId: 'thread-' + id,
    snippet: 'Test snippet',
    internalDate: new Date().toISOString(),
    subject,
    from: 'test@example.com',
    to: 'user@example.com',
  });

  const createMockCategory = (
    confidence: 'high' | 'medium' | 'low',
    isJobRelated: boolean
  ): EmailCategory => ({
    isJobRelated,
    confidence,
    matchedKeywords: [],
    reason: 'Test reason',
  });

  describe('saveEmail', () => {
    it('should save high-confidence email with body', () => {
      const email = createMockEmail('email1', 'Job Offer - Software Engineer');
      const category = createMockCategory('high', true);
      const body = 'Full email body text here';

      saveEmail(email, category, body);

      const emails = getEmails({ confidence: 'high' });
      expect(emails).toHaveLength(1);
      expect(emails[0].gmail_id).toBe('email1');
      expect(emails[0].subject).toBe('Job Offer - Software Engineer');
      expect(emails[0].body).toBe('Full email body text here');
      expect(emails[0].confidence).toBe('high');
      expect(emails[0].is_job_related).toBe(1);
    });

    it('should save low-confidence email without body', () => {
      const email = createMockEmail('email2', 'Newsletter');
      const category = createMockCategory('low', false);
      const body = 'This body should not be saved';

      saveEmail(email, category, body);

      const emails = getEmails({ confidence: 'low' });
      expect(emails).toHaveLength(1);
      expect(emails[0].gmail_id).toBe('email2');
      expect(emails[0].subject).toBe('Newsletter');
      expect(emails[0].body).toBeNull();
      expect(emails[0].confidence).toBe('low');
      expect(emails[0].is_job_related).toBe(0);
    });

    it('should save medium-confidence email without body', () => {
      const email = createMockEmail('email3', 'Project Inquiry');
      const category = createMockCategory('medium', true);
      const body = 'This body should not be saved';

      saveEmail(email, category, body);

      const emails = getEmails({ confidence: 'medium' });
      expect(emails).toHaveLength(1);
      expect(emails[0].gmail_id).toBe('email3');
      expect(emails[0].body).toBeNull();
    });

    it('should update existing email on duplicate gmail_id', () => {
      const email = createMockEmail('email4', 'First Subject');
      const category1 = createMockCategory('low', false);

      saveEmail(email, category1);

      const updatedEmail = { ...email, subject: 'Updated Subject' };
      const category2 = createMockCategory('high', true);

      saveEmail(updatedEmail, category2, 'Updated body');

      const emails = getEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].subject).toBe('Updated Subject');
      expect(emails[0].confidence).toBe('high');
      expect(emails[0].body).toBe('Updated body');
    });
  });

  describe('isEmailScanned', () => {
    it('should return true for scanned email', () => {
      const email = createMockEmail('email5', 'Test');
      const category = createMockCategory('high', true);

      saveEmail(email, category);

      expect(isEmailScanned('email5')).toBe(true);
    });

    it('should return false for non-scanned email', () => {
      expect(isEmailScanned('nonexistent')).toBe(false);
    });
  });

  describe('getScannedEmailIds', () => {
    it('should return all scanned email IDs', () => {
      const email1 = createMockEmail('email6', 'Test 1');
      const email2 = createMockEmail('email7', 'Test 2');
      const category = createMockCategory('high', true);

      saveEmail(email1, category);
      saveEmail(email2, category);

      const ids = getScannedEmailIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('email6');
      expect(ids).toContain('email7');
    });

    it('should return empty array when no emails scanned', () => {
      const ids = getScannedEmailIds();
      expect(ids).toHaveLength(0);
    });
  });

  describe('processed field', () => {
    it('should default processed to 0 when saving new email', () => {
      const email = createMockEmail('processed1', 'Test Email');
      const category = createMockCategory('high', true);

      saveEmail(email, category);

      const emails = getEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].processed).toBe(0);
    });

    it('should preserve processed value when updating email', () => {
      const email = createMockEmail('processed2', 'Test Email');
      const category = createMockCategory('high', true);

      saveEmail(email, category);
      markEmailAsProcessed('processed2');

      // Update the email
      const updatedEmail = { ...email, subject: 'Updated Subject' };
      saveEmail(updatedEmail, category);

      const emails = getEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].processed).toBe(1); // Should still be processed
    });
  });

  describe('markEmailAsProcessed', () => {
    it('should mark email as processed', () => {
      const email = createMockEmail('mark1', 'Test Email');
      const category = createMockCategory('high', true);

      saveEmail(email, category);

      let emails = getEmails();
      expect(emails[0].processed).toBe(0);

      markEmailAsProcessed('mark1');

      emails = getEmails();
      expect(emails[0].processed).toBe(1);
    });
  });

  describe('markEmailsAsProcessed', () => {
    it('should mark multiple emails as processed', () => {
      const email1 = createMockEmail('batch1', 'Test Email 1');
      const email2 = createMockEmail('batch2', 'Test Email 2');
      const email3 = createMockEmail('batch3', 'Test Email 3');
      const category = createMockCategory('high', true);

      saveEmail(email1, category);
      saveEmail(email2, category);
      saveEmail(email3, category);

      markEmailsAsProcessed(['batch1', 'batch2', 'batch3']);

      const emails = getEmails();
      expect(emails).toHaveLength(3);
      expect(emails.every(e => e.processed === 1)).toBe(true);
    });
  });

  describe('getUnprocessedEmails', () => {
    it('should return only unprocessed emails', () => {
      const email1 = createMockEmail('unproc1', 'Unprocessed 1');
      const email2 = createMockEmail('unproc2', 'Processed');
      const email3 = createMockEmail('unproc3', 'Unprocessed 2');
      const category = createMockCategory('high', true);

      saveEmail(email1, category);
      saveEmail(email2, category);
      saveEmail(email3, category);

      markEmailAsProcessed('unproc2');

      const unprocessed = getUnprocessedEmails();
      expect(unprocessed).toHaveLength(2);
      expect(unprocessed.some(e => e.gmail_id === 'unproc1')).toBe(true);
      expect(unprocessed.some(e => e.gmail_id === 'unproc3')).toBe(true);
      expect(unprocessed.some(e => e.gmail_id === 'unproc2')).toBe(false);
    });

    it('should return empty array when all emails are processed', () => {
      const email = createMockEmail('allproc', 'All Processed');
      const category = createMockCategory('high', true);

      saveEmail(email, category);
      markEmailAsProcessed('allproc');

      const unprocessed = getUnprocessedEmails();
      expect(unprocessed).toHaveLength(0);
    });
  });

  describe('getHighConfidenceEmails', () => {
    it('should return only high-confidence job-related emails', () => {
      const email1 = createMockEmail('email8', 'Job Offer');
      const email2 = createMockEmail('email9', 'Another Job');
      const email3 = createMockEmail('email10', 'Newsletter');

      saveEmail(email1, createMockCategory('high', true));
      saveEmail(email2, createMockCategory('high', true));
      saveEmail(email3, createMockCategory('low', false));

      const highEmails = getHighConfidenceEmails();
      expect(highEmails).toHaveLength(2);
      expect(highEmails.every(e => e.confidence === 'high')).toBe(true);
      expect(highEmails.every(e => e.is_job_related === 1)).toBe(true);
    });

    it('should not return high-confidence non-job-related emails', () => {
      const email = createMockEmail('email11', 'Not a job');
      saveEmail(email, createMockCategory('high', false));

      const highEmails = getHighConfidenceEmails();
      expect(highEmails).toHaveLength(0);
    });
  });

  describe('getEmails', () => {
    beforeEach(() => {
      const emails = [
        { email: createMockEmail('e1', 'High Job'), category: createMockCategory('high', true) },
        { email: createMockEmail('e2', 'High Non-Job'), category: createMockCategory('high', false) },
        { email: createMockEmail('e3', 'Medium Job'), category: createMockCategory('medium', true) },
        { email: createMockEmail('e4', 'Low Non-Job'), category: createMockCategory('low', false) },
      ];

      emails.forEach(({ email, category }) => saveEmail(email, category));
    });

    it('should filter by confidence', () => {
      const highEmails = getEmails({ confidence: 'high' });
      expect(highEmails).toHaveLength(2);
      expect(highEmails.every(e => e.confidence === 'high')).toBe(true);
    });

    it('should filter by job-related status', () => {
      const jobEmails = getEmails({ isJobRelated: true });
      expect(jobEmails).toHaveLength(2);
      expect(jobEmails.every(e => e.is_job_related === 1)).toBe(true);
    });

    it('should filter by both confidence and job-related status', () => {
      const highJobEmails = getEmails({ confidence: 'high', isJobRelated: true });
      expect(highJobEmails).toHaveLength(1);
      expect(highJobEmails[0].gmail_id).toBe('e1');
    });

    it('should limit results', () => {
      const limitedEmails = getEmails({ limit: 2 });
      expect(limitedEmails).toHaveLength(2);
    });

    it('should return all emails without filter', () => {
      const allEmails = getEmails();
      expect(allEmails).toHaveLength(4);
    });
  });

  describe('getEmailStats', () => {
    it('should return correct statistics', () => {
      const emails = [
        { email: createMockEmail('s1', 'Test 1'), category: createMockCategory('high', true) },
        { email: createMockEmail('s2', 'Test 2'), category: createMockCategory('high', true) },
        { email: createMockEmail('s3', 'Test 3'), category: createMockCategory('medium', true) },
        { email: createMockEmail('s4', 'Test 4'), category: createMockCategory('low', false) },
        { email: createMockEmail('s5', 'Test 5'), category: createMockCategory('low', false) },
      ];

      emails.forEach(({ email, category }) => saveEmail(email, category));

      const stats = getEmailStats();
      expect(stats.total).toBe(5);
      expect(stats.jobRelated).toBe(3);
      expect(stats.highConfidence).toBe(2);
      expect(stats.mediumConfidence).toBe(1);
      expect(stats.lowConfidence).toBe(2);
    });

    it('should return zeros for empty database', () => {
      const stats = getEmailStats();
      expect(stats.total).toBe(0);
      expect(stats.jobRelated).toBe(0);
      expect(stats.highConfidence).toBe(0);
      expect(stats.mediumConfidence).toBe(0);
      expect(stats.lowConfidence).toBe(0);
    });
  });

  describe('clearAllEmails', () => {
    it('should delete all emails from database', () => {
      const email1 = createMockEmail('clear1', 'Test 1');
      const email2 = createMockEmail('clear2', 'Test 2');
      const category = createMockCategory('high', true);

      saveEmail(email1, category);
      saveEmail(email2, category);

      expect(getEmails()).toHaveLength(2);

      clearAllEmails();

      expect(getEmails()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Job Management Tests
  // ============================================================================

  describe('saveJob', () => {
    it('should save job with title and link', () => {
      saveJob('Senior TypeScript Developer', 'https://example.com/job/123');

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Senior TypeScript Developer');
      expect(jobs[0].link).toBe('https://example.com/job/123');
      expect(jobs[0].email_id).toBeNull();
      expect(jobs[0].salary_min).toBeNull();
      expect(jobs[0].salary_max).toBeNull();
    });

    it('should save job with email reference', () => {
      const email = createMockEmail('email1', 'Job Offer');
      const category = createMockCategory('high', true);
      saveEmail(email, category);

      const emails = getEmails();
      const emailId = emails[0].id;

      saveJob('Backend Engineer', 'https://example.com/job/456', emailId);

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].email_id).toBe(emailId);
    });

    it('should save job with salary range', () => {
      saveJob('Full Stack Developer', 'https://example.com/job/salary1', undefined, {
        min: 60000,
        max: 80000,
        currency: 'EUR',
        period: 'yearly'
      });

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Full Stack Developer');
      expect(jobs[0].salary_min).toBe(60000);
      expect(jobs[0].salary_max).toBe(80000);
      expect(jobs[0].salary_currency).toBe('EUR');
      expect(jobs[0].salary_period).toBe('yearly');
    });

    it('should save job with hourly rate', () => {
      saveJob('Freelance Developer', 'https://example.com/job/hourly1', undefined, {
        min: 80,
        max: 120,
        currency: 'EUR',
        period: 'hourly'
      });

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].salary_min).toBe(80);
      expect(jobs[0].salary_max).toBe(120);
      expect(jobs[0].salary_period).toBe('hourly');
    });

    it('should save job with all parameters including salary', () => {
      const email = createMockEmail('email2', 'Senior Position');
      const category = createMockCategory('high', true);
      saveEmail(email, category);

      const emails = getEmails();
      const emailId = emails[0].id;

      saveJob('Senior Engineer', 'https://example.com/job/complete', emailId, {
        min: 120000,
        max: 150000,
        currency: 'USD',
        period: 'yearly'
      });

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Senior Engineer');
      expect(jobs[0].email_id).toBe(emailId);
      expect(jobs[0].salary_min).toBe(120000);
      expect(jobs[0].salary_max).toBe(150000);
      expect(jobs[0].salary_currency).toBe('USD');
    });

    it('should save job with only minimum salary', () => {
      saveJob('Contract Role', 'https://example.com/job/minonly', undefined, {
        min: 50000,
        currency: 'GBP',
        period: 'yearly'
      });

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].salary_min).toBe(50000);
      expect(jobs[0].salary_max).toBeNull();
      expect(jobs[0].salary_currency).toBe('GBP');
    });

    it('should update existing job on duplicate link', () => {
      saveJob('Old Title', 'https://example.com/job/789');
      saveJob('New Title', 'https://example.com/job/789');

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('New Title');
    });

    it('should update salary when updating existing job', () => {
      saveJob('Software Engineer', 'https://example.com/job/update1', undefined, {
        min: 50000,
        currency: 'EUR',
        period: 'yearly'
      });
      saveJob('Software Engineer', 'https://example.com/job/update1', undefined, {
        min: 50000,
        max: 70000,
        currency: 'EUR',
        period: 'yearly'
      });

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].salary_min).toBe(50000);
      expect(jobs[0].salary_max).toBe(70000);
    });

    it('should handle null salary', () => {
      saveJob('Developer', 'https://example.com/job/nosalary', undefined, undefined);

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].salary_min).toBeNull();
      expect(jobs[0].salary_max).toBeNull();
      expect(jobs[0].salary_currency).toBeNull();
      expect(jobs[0].salary_period).toBeNull();
    });

    it('should save job with description', () => {
      const description = 'We are looking for a senior software engineer with 5+ years of experience...';
      saveJob('Senior Engineer', 'https://example.com/job/withdesc', undefined, undefined, description);

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Senior Engineer');
      expect(jobs[0].description).toBe(description);
    });

    it('should update job description without overwriting existing data', () => {
      // First save with salary
      saveJob('Full Stack Dev', 'https://example.com/job/update-desc', undefined, {
        min: 70000,
        max: 90000,
        currency: 'EUR',
        period: 'yearly'
      });

      // Then update with description only
      const description = 'Full Stack Developer role with React and Node.js experience required.';
      saveJob('Full Stack Dev', 'https://example.com/job/update-desc', undefined, undefined, description);

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].description).toBe(description);
      expect(jobs[0].salary_min).toBe(70000); // Salary should still be there
      expect(jobs[0].salary_max).toBe(90000);
    });

    it('should not overwrite existing description with null', () => {
      const description = 'Original description';
      saveJob('Test Job', 'https://example.com/job/keep-desc', undefined, undefined, description);

      // Update without description parameter
      saveJob('Test Job Updated', 'https://example.com/job/keep-desc');

      const jobs = getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Test Job Updated');
      expect(jobs[0].description).toBe(description); // Description should remain
    });
  });

  describe('isJobScanned', () => {
    it('should return true for scanned job', () => {
      saveJob('Test Job', 'https://example.com/job/111');

      expect(isJobScanned('https://example.com/job/111')).toBe(true);
    });

    it('should return false for non-scanned job', () => {
      expect(isJobScanned('https://example.com/job/nonexistent')).toBe(false);
    });
  });

  describe('getScannedJobLinks', () => {
    it('should return all scanned job links', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');
      saveJob('Job 3', 'https://example.com/job/3');

      const links = getScannedJobLinks();
      expect(links).toHaveLength(3);
      expect(links).toContain('https://example.com/job/1');
      expect(links).toContain('https://example.com/job/2');
      expect(links).toContain('https://example.com/job/3');
    });

    it('should return empty array when no jobs scanned', () => {
      const links = getScannedJobLinks();
      expect(links).toHaveLength(0);
    });
  });

  describe('getJobs', () => {
    beforeEach(() => {
      const email1 = createMockEmail('e1', 'Email 1');
      const email2 = createMockEmail('e2', 'Email 2');
      const category = createMockCategory('high', true);

      saveEmail(email1, category);
      saveEmail(email2, category);

      const emails = getEmails();
      const emailId1 = emails.find(e => e.gmail_id === 'e1')!.id;
      const emailId2 = emails.find(e => e.gmail_id === 'e2')!.id;

      saveJob('Job from Email 1', 'https://example.com/job/a', emailId1);
      saveJob('Job from Email 2', 'https://example.com/job/b', emailId2);
      saveJob('Job from Email 1 again', 'https://example.com/job/c', emailId1);
      saveJob('Job without email', 'https://example.com/job/d');
    });

    it('should filter by emailId', () => {
      const emails = getEmails();
      const emailId1 = emails.find(e => e.gmail_id === 'e1')!.id;

      const jobs = getJobs({ emailId: emailId1 });
      expect(jobs).toHaveLength(2);
      expect(jobs.every(j => j.email_id === emailId1)).toBe(true);
    });

    it('should limit results', () => {
      const jobs = getJobs({ limit: 2 });
      expect(jobs).toHaveLength(2);
    });

    it('should return all jobs without filter', () => {
      const jobs = getJobs();
      expect(jobs).toHaveLength(4);
    });
  });

  describe('getJobById', () => {
    it('should return a job by ID', () => {
      saveJob('Test Job', 'https://example.com/job/1', undefined, {
        min: 80000,
        max: 120000,
        currency: 'USD',
        period: 'yearly',
      }, 'Job description here');

      const jobs = getJobs();
      const jobId = jobs[0].id;

      const job = getJobById(jobId);
      expect(job).not.toBeNull();
      expect(job?.id).toBe(jobId);
      expect(job?.title).toBe('Test Job');
      expect(job?.link).toBe('https://example.com/job/1');
      expect(job?.salary_min).toBe(80000);
      expect(job?.salary_max).toBe(120000);
      expect(job?.salary_currency).toBe('USD');
      expect(job?.salary_period).toBe('yearly');
      expect(job?.description).toBe('Job description here');
    });

    it('should return null for non-existent job ID', () => {
      const job = getJobById(99999);
      expect(job).toBeNull();
    });

    it('should include email_date when job has email association', () => {
      const email = createMockEmail('e1', 'Test Email');
      const category = createMockCategory('high', true);
      saveEmail(email, category);

      const emails = getEmails();
      const emailId = emails[0].id;

      saveJob('Job with Email', 'https://example.com/job/1', emailId);

      const jobs = getJobs();
      const jobId = jobs[0].id;

      const job = getJobById(jobId);
      expect(job).not.toBeNull();
      expect(job?.email_id).toBe(emailId);
      expect(job?.email_date).toBeDefined();
    });
  });

  describe('getJobStats', () => {
    it('should return correct statistics', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');
      saveJob('Job 3', 'https://example.com/job/3');

      const stats = getJobStats();
      expect(stats.total).toBe(3);
    });

    it('should return zero for empty database', () => {
      const stats = getJobStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('clearAllJobs', () => {
    it('should delete all jobs from database', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');

      expect(getJobs()).toHaveLength(2);

      clearAllJobs();

      expect(getJobs()).toHaveLength(0);
    });
  });

  describe('deleteJob', () => {
    it('should delete a job by ID and return true', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');

      const jobs = getJobs();
      expect(jobs).toHaveLength(2);

      // Find the job with job/1 to delete it
      const jobToDelete = jobs.find(j => j.link === 'https://example.com/job/1');
      expect(jobToDelete).toBeDefined();

      const result = deleteJob(jobToDelete!.id);
      expect(result).toBe(true);

      const remainingJobs = getJobs();
      expect(remainingJobs).toHaveLength(1);
      expect(remainingJobs[0].link).toBe('https://example.com/job/2');
    });

    it('should return false when job ID does not exist', () => {
      saveJob('Job 1', 'https://example.com/job/1');

      const result = deleteJob(99999);
      expect(result).toBe(false);

      expect(getJobs()).toHaveLength(1);
    });

    it('should only delete the specified job', () => {
      saveJob('Job 1', 'https://example.com/job/1');
      saveJob('Job 2', 'https://example.com/job/2');
      saveJob('Job 3', 'https://example.com/job/3');

      const jobs = getJobs();
      const jobToDelete = jobs.find(j => j.link === 'https://example.com/job/2');
      expect(jobToDelete).toBeDefined();

      deleteJob(jobToDelete!.id);

      const remainingJobs = getJobs();
      expect(remainingJobs).toHaveLength(2);
      expect(remainingJobs.map(j => j.link)).not.toContain('https://example.com/job/2');
    });
  });

  // ============================================================================
  // Job-Skill Match Tests
  // ============================================================================

  describe('addSkillToJob', () => {
    it('should associate a skill with a job', () => {
      saveJob('Full Stack Developer', 'https://example.com/job/fullstack');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const jsSkill = getSkillByName('JavaScript');
      expect(jsSkill).not.toBeNull();

      addSkillToJob(jobId, jsSkill!.id, 80);

      const skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('JavaScript');
      expect(skills[0].relevance_score).toBe(80);
    });

    it('should update relevance score on duplicate', () => {
      saveJob('Backend Developer', 'https://example.com/job/backend');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const nodeSkill = getSkillByName('Node.js');
      expect(nodeSkill).not.toBeNull();

      addSkillToJob(jobId, nodeSkill!.id, 60);
      addSkillToJob(jobId, nodeSkill!.id, 90); // Update relevance

      const skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(1);
      expect(skills[0].relevance_score).toBe(90);
    });
  });

  describe('addSkillsToJob', () => {
    it('should associate multiple skills with a job', () => {
      saveJob('React Developer', 'https://example.com/job/react');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const jsSkill = getSkillByName('JavaScript')!;
      const tsSkill = getSkillByName('TypeScript')!;
      const reactSkill = getSkillByName('React')!;

      addSkillsToJob(jobId, [jsSkill.id, tsSkill.id, reactSkill.id], 75);

      const skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(3);
      expect(skills.map(s => s.name)).toContain('JavaScript');
      expect(skills.map(s => s.name)).toContain('TypeScript');
      expect(skills.map(s => s.name)).toContain('React');
    });
  });

  describe('removeSkillFromJob', () => {
    it('should remove skill association from job', () => {
      saveJob('DevOps Engineer', 'https://example.com/job/devops');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const dockerSkill = getSkillByName('Docker')!;
      const awsSkill = getSkillByName('AWS')!;

      addSkillsToJob(jobId, [dockerSkill.id, awsSkill.id]);

      let skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(2);

      removeSkillFromJob(jobId, dockerSkill.id);

      skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('AWS');
    });
  });

  describe('getSkillsForJob', () => {
    it('should return all skills for a job ordered by relevance', () => {
      saveJob('Full Stack Engineer', 'https://example.com/job/fullstack2');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const jsSkill = getSkillByName('JavaScript')!;
      const tsSkill = getSkillByName('TypeScript')!;
      const reactSkill = getSkillByName('React')!;

      addSkillToJob(jobId, jsSkill.id, 90);
      addSkillToJob(jobId, tsSkill.id, 95);
      addSkillToJob(jobId, reactSkill.id, 70);

      const skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(3);
      expect(skills[0].name).toBe('TypeScript'); // Highest relevance
      expect(skills[0].relevance_score).toBe(95);
    });

    it('should return empty array for job with no skills', () => {
      saveJob('Unnamed Role', 'https://example.com/job/norequirements');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const skills = getSkillsForJob(jobId);
      expect(skills).toHaveLength(0);
    });
  });

  describe('getJobsForSkill', () => {
    it('should return all jobs requiring a specific skill', () => {
      saveJob('Frontend Job', 'https://example.com/job/frontend');
      saveJob('Backend Job', 'https://example.com/job/backend2');
      const jobs = getJobs();

      const jsSkill = getSkillByName('JavaScript')!;

      addSkillToJob(jobs[0].id, jsSkill.id, 80);
      addSkillToJob(jobs[1].id, jsSkill.id, 90);

      const jobsForSkill = getJobsForSkill(jsSkill.id);
      expect(jobsForSkill).toHaveLength(2);
      expect(jobsForSkill[0].relevance_score).toBe(90); // Sorted by relevance
    });
  });

  describe('getJobMatchScore', () => {
    it('should calculate match percentage correctly', () => {
      saveJob('JS Developer', 'https://example.com/job/jsdev');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const jsSkill = getSkillByName('JavaScript')!;
      const tsSkill = getSkillByName('TypeScript')!;
      const nodeSkill = getSkillByName('Node.js')!;
      const reactSkill = getSkillByName('React')!;

      // Add 4 skills to job
      addSkillsToJob(jobId, [jsSkill.id, tsSkill.id, nodeSkill.id, reactSkill.id]);

      const matchScore = getJobMatchScore(jobId);
      expect(matchScore.totalRequiredSkills).toBe(4);
      expect(matchScore.matchedSkills).toBe(4);
      expect(matchScore.matchPercentage).toBe(100);
      expect(matchScore.matchedSkillNames).toHaveLength(4);
    });

    it('should return zero for job with no skill requirements', () => {
      saveJob('Generic Role', 'https://example.com/job/generic');
      const jobs = getJobs();
      const jobId = jobs[0].id;

      const matchScore = getJobMatchScore(jobId);
      expect(matchScore.matchPercentage).toBe(0);
      expect(matchScore.totalRequiredSkills).toBe(0);
    });
  });

  describe('findMatchingJobs', () => {
    it('should find jobs with skills and exclude jobs without skills', () => {
      // Create jobs - some with skills, some without
      saveJob('Job with 4 Skills', 'https://example.com/job/fullstack');
      saveJob('Job with 2 Skills', 'https://example.com/job/backend');
      saveJob('Job with No Skills', 'https://example.com/job/nomatch');
      const jobs = getJobs();

      // Lookup skills by name
      const jsSkill = getSkillByName('JavaScript')!;
      const tsSkill = getSkillByName('TypeScript')!;
      const nodeSkill = getSkillByName('Node.js')!;
      const reactSkill = getSkillByName('React')!;

      // Job 1: 4 skills (100% match since all skills in db are user skills)
      addSkillsToJob(jobs[0].id, [jsSkill.id, tsSkill.id, nodeSkill.id, reactSkill.id]);

      // Job 2: 2 skills (100% match)
      addSkillsToJob(jobs[1].id, [jsSkill.id, tsSkill.id]);

      // Job 3: No skills (0% match)

      // Find jobs with at least 50% match - should return jobs 1 and 2
      const matches = findMatchingJobs(50);

      expect(matches).toHaveLength(2);
      expect(matches[0].matchPercentage).toBe(100);
      expect(matches[1].matchPercentage).toBe(100);
    });

    it('should exclude jobs without any skill requirements', () => {
      // Job with no skills should have 0% match and be excluded
      saveJob('Job with No Requirements', 'https://example.com/job/norequirements');

      const matches = findMatchingJobs(50);
      expect(matches).toHaveLength(0);
    });
  });

  describe('getJobSkillMatchStats', () => {
    it('should return correct statistics', () => {
      saveJob('Job 1', 'https://example.com/job/stats1');
      saveJob('Job 2', 'https://example.com/job/stats2');
      const jobs = getJobs();

      const jsSkill = getSkillByName('JavaScript')!;
      const tsSkill = getSkillByName('TypeScript')!;
      const nodeSkill = getSkillByName('Node.js')!;

      addSkillsToJob(jobs[0].id, [jsSkill.id, tsSkill.id, nodeSkill.id]); // 3 skills
      addSkillsToJob(jobs[1].id, [jsSkill.id, tsSkill.id]); // 2 skills

      const stats = getJobSkillMatchStats();
      expect(stats.totalMatches).toBe(5);
      expect(stats.jobsWithSkills).toBe(2);
      expect(stats.avgSkillsPerJob).toBe(2.5);
    });

    it('should return zeros for empty database', () => {
      const stats = getJobSkillMatchStats();
      expect(stats.totalMatches).toBe(0);
      expect(stats.jobsWithSkills).toBe(0);
      expect(stats.avgSkillsPerJob).toBe(0);
    });
  });

  describe('clearAllJobSkillMatches', () => {
    it('should delete all job-skill matches', () => {
      saveJob('Test Job', 'https://example.com/job/testclear');
      const jobs = getJobs();

      const jsSkill = getSkillByName('JavaScript')!;
      const tsSkill = getSkillByName('TypeScript')!;
      const nodeSkill = getSkillByName('Node.js')!;

      addSkillsToJob(jobs[0].id, [jsSkill.id, tsSkill.id, nodeSkill.id]);

      let skills = getSkillsForJob(jobs[0].id);
      expect(skills).toHaveLength(3);

      clearAllJobSkillMatches();

      skills = getSkillsForJob(jobs[0].id);
      expect(skills).toHaveLength(0);
    });
  });

  describe('Platform functions', () => {
    describe('getPlatforms', () => {
      it('should return all platforms', () => {
        const platforms = getPlatforms();
        expect(platforms.length).toBeGreaterThanOrEqual(7); // At least 7 test platforms
        expect(platforms[0]).toHaveProperty('id');
        expect(platforms[0]).toHaveProperty('platform_name');
        expect(platforms[0]).toHaveProperty('hostname');
        expect(platforms[0]).toHaveProperty('can_crawl');
        expect(platforms[0]).toHaveProperty('skip_reason');
        expect(platforms[0]).toHaveProperty('created_at');
      });

      it('should return platforms sorted by name', () => {
        const platforms = getPlatforms();
        const platformNames = platforms.map(p => p.platform_name);
        const sortedNames = [...platformNames].sort();
        expect(platformNames).toEqual(sortedNames);
      });
    });

    describe('getPlatformByDomain', () => {
      it('should find platform by exact domain match', () => {
        const platform = getPlatformByDomain('https://linkedin.com/jobs/123');
        expect(platform).not.toBeNull();
        expect(platform?.hostname).toBe('linkedin');
        expect(platform?.platform_name).toBe('LinkedIn');
      });

      it('should find platform by subdomain match', () => {
        const platform = getPlatformByDomain('https://jobs.linkedin.com/view/12345');
        expect(platform).not.toBeNull();
        expect(platform?.hostname).toBe('linkedin');
        expect(platform?.platform_name).toBe('LinkedIn');
      });

      it('should handle multiple subdomain levels', () => {
        const platform = getPlatformByDomain('https://app.greenhouse.io/jobs/123');
        expect(platform).not.toBeNull();
        expect(platform?.hostname).toBe('greenhouse');
        expect(platform?.platform_name).toBe('Greenhouse');
      });

      it('should return null for unknown domain', () => {
        const platform = getPlatformByDomain('https://unknown-job-site.com/job/123');
        expect(platform).toBeNull();
      });

      it('should return null for invalid URL', () => {
        const platform = getPlatformByDomain('not-a-url');
        expect(platform).toBeNull();
      });

      it('should be case insensitive', () => {
        const platform = getPlatformByDomain('https://LINKEDIN.COM/jobs/123');
        expect(platform).not.toBeNull();
        expect(platform?.hostname).toBe('linkedin');
      });

      it('should match different TLDs to same platform (TLD-agnostic)', () => {
        // linkedin.de should match linkedin hostname
        const platformDE = getPlatformByDomain('https://linkedin.de/jobs/123');
        expect(platformDE).not.toBeNull();
        expect(platformDE?.hostname).toBe('linkedin'); // Stored as hostname only

        // linkedin.co.uk should also match
        const platformUK = getPlatformByDomain('https://linkedin.co.uk/jobs/456');
        expect(platformUK).not.toBeNull();
        expect(platformUK?.hostname).toBe('linkedin');

        // Both should be the same platform
        expect(platformDE?.id).toBe(platformUK?.id);
      });

      it('should match freelancermap with different TLDs', () => {
        const platformCom = getPlatformByDomain('https://freelancermap.com/job/123');
        const platformDe = getPlatformByDomain('https://freelancermap.de/job/456');
        const platformCh = getPlatformByDomain('https://freelancermap.ch/job/789');

        expect(platformCom).not.toBeNull();
        expect(platformDe).not.toBeNull();
        expect(platformCh).not.toBeNull();

        // All should have same hostname
        expect(platformCom?.hostname).toBe('freelancermap');
        expect(platformDe?.hostname).toBe('freelancermap');
        expect(platformCh?.hostname).toBe('freelancermap');

        // All should resolve to the same platform
        expect(platformCom?.id).toBe(platformDe?.id);
        expect(platformCom?.id).toBe(platformCh?.id);
      });
    });

    describe('canCrawlUrl', () => {
      it('should return false for non-crawlable platforms', () => {
        const canCrawl = canCrawlUrl('https://linkedin.com/jobs/123');
        expect(canCrawl).toBe(false);
      });

      it('should return true for crawlable platforms', () => {
        const canCrawl = canCrawlUrl('https://indeed.com/job/123');
        expect(canCrawl).toBe(true);
      });

      it('should return true for unknown platforms (default allow)', () => {
        const canCrawl = canCrawlUrl('https://unknown-job-board.com/job/123');
        expect(canCrawl).toBe(true);
      });

      it('should handle subdomains correctly', () => {
        const linkedInCrawl = canCrawlUrl('https://jobs.linkedin.com/view/12345');
        expect(linkedInCrawl).toBe(false);

        const indeedCrawl = canCrawlUrl('https://www.indeed.com/viewjob?jk=12345');
        expect(indeedCrawl).toBe(true);
      });
    });

    describe('getSkipReason', () => {
      it('should return skip reason for non-crawlable platform', () => {
        const reason = getSkipReason('https://linkedin.com/jobs/123');
        expect(reason).not.toBeNull();
        expect(reason).toContain('multi-level authentication');
      });

      it('should return null for crawlable platforms', () => {
        const reason = getSkipReason('https://indeed.com/job/123');
        expect(reason).toBeNull();
      });

      it('should return null for unknown platforms', () => {
        const reason = getSkipReason('https://unknown-job-board.com/job/123');
        expect(reason).toBeNull();
      });
    });

    describe('updatePlatformCrawlability', () => {
      it('should update can_crawl flag', () => {
        // Make Indeed non-crawlable
        updatePlatformCrawlability('indeed', false, 'Testing purposes');

        let canCrawl = canCrawlUrl('https://indeed.com/job/123');
        expect(canCrawl).toBe(false);

        let reason = getSkipReason('https://indeed.com/job/123');
        expect(reason).toBe('Testing purposes');

        // Restore Indeed to crawlable
        updatePlatformCrawlability('indeed', true, undefined);

        canCrawl = canCrawlUrl('https://indeed.com/job/123');
        expect(canCrawl).toBe(true);

        reason = getSkipReason('https://indeed.com/job/123');
        expect(reason).toBeNull();
      });

      it('should clear skip_reason when setting to crawlable', () => {
        updatePlatformCrawlability('example', false, 'Test reason');
        let reason = getSkipReason('https://test-jobs.example.com/job/1');
        expect(reason).toBe('Test reason');

        updatePlatformCrawlability('example', true);
        reason = getSkipReason('https://test-jobs.example.com/job/1');
        expect(reason).toBeNull();
      });
    });

    describe('getPlatformStats', () => {
      it('should return correct platform statistics', () => {
        const stats = getPlatformStats();
        expect(stats).toHaveProperty('total');
        expect(stats).toHaveProperty('crawlable');
        expect(stats).toHaveProperty('nonCrawlable');
        expect(stats.total).toBeGreaterThanOrEqual(7);
        expect(stats.nonCrawlable).toBeGreaterThanOrEqual(1); // At least LinkedIn
        expect(stats.crawlable).toBe(stats.total - stats.nonCrawlable);
      });
    });

    describe('getPlatformIdFromEmail', () => {
      it('should extract platform ID from email address', () => {
        const platformId = getPlatformIdFromEmail('jobs-noreply@linkedin.com');
        expect(platformId).not.toBeNull();

        // Verify it's actually LinkedIn's ID
        const platforms = getPlatforms();
        const linkedin = platforms.find(p => p.hostname === 'linkedin');
        expect(platformId).toBe(linkedin?.id);
      });

      it('should handle email addresses with display names', () => {
        const platformId = getPlatformIdFromEmail('LinkedIn Jobs <jobs@linkedin.com>');
        expect(platformId).not.toBeNull();
      });

      it('should match subdomain emails', () => {
        const platformId = getPlatformIdFromEmail('notifications@jobs.indeed.com');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const indeed = platforms.find(p => p.hostname === 'indeed');
        expect(platformId).toBe(indeed?.id);
      });

      it('should return null for unknown platforms', () => {
        const platformId = getPlatformIdFromEmail('hr@unknown-company.com');
        expect(platformId).toBeNull();
      });

      it('should return null for invalid email addresses', () => {
        const platformId = getPlatformIdFromEmail('not-an-email');
        expect(platformId).toBeNull();
      });

      it('should be case insensitive', () => {
        const platformId = getPlatformIdFromEmail('JOBS@LINKEDIN.COM');
        expect(platformId).not.toBeNull();
      });

      it('should extract platform ID from jobs.ch email address', () => {
        const platformId = getPlatformIdFromEmail('noreply@jobs.ch');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const jobsCh = platforms.find(p => p.hostname === 'jobs');
        expect(platformId).toBe(jobsCh?.id);
      });

      it('should handle jobs.ch subdomain emails', () => {
        const platformId = getPlatformIdFromEmail('noreply@mail.jobs.ch');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const jobsCh = platforms.find(p => p.hostname === 'jobs');
        expect(platformId).toBe(jobsCh?.id);
      });

      it('should handle forwarded email addresses (jobs.ch via lale.li)', () => {
        const platformId = getPlatformIdFromEmail('chjobs+candidate=jobs.ch@lale.li');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const jobsCh = platforms.find(p => p.hostname === 'jobs');
        expect(platformId).toBe(jobsCh?.id);
      });

      it('should handle forwarded email with display name', () => {
        const platformId = getPlatformIdFromEmail('"Service jobs.ch - info(a)jobs.ch" <chjobs+candidate=jobs.ch@lale.li>');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const jobsCh = platforms.find(p => p.hostname === 'jobs');
        expect(platformId).toBe(jobsCh?.id);
      });

      it('should handle forwarded freelancermap email', () => {
        const platformId = getPlatformIdFromEmail('flmch+office=freelancermap.de@lale.li');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const freelancermap = platforms.find(p => p.hostname === 'freelancermap');
        expect(platformId).toBe(freelancermap?.id);
      });

      it('should handle forwarded indeed email', () => {
        const platformId = getPlatformIdFromEmail('indeed+do-not-reply=indeed.com@lale.li');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const indeed = platforms.find(p => p.hostname === 'indeed');
        expect(platformId).toBe(indeed?.id);
      });

      it('should handle forwarded experteer email', () => {
        const platformId = getPlatformIdFromEmail('experteer+news=email.experteer.com@lale.li');
        expect(platformId).not.toBeNull();

        const platforms = getPlatforms();
        const experteer = platforms.find(p => p.hostname === 'experteer');
        expect(platformId).toBe(experteer?.id);
      });
    });
  });
});
