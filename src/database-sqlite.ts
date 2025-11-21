import Database from 'better-sqlite3';
import path from 'path';
import type { EmailMessage } from './email-scanner';
import type { EmailCategory } from './email-categorizer';

export interface StoredEmail {
  id: number;
  gmail_id: string;
  subject: string | null;
  from_address: string | null;
  body: string | null;
  confidence: 'high' | 'medium' | 'low';
  is_job_related: 0 | 1;
  reason: string | null;
  processed: 0 | 1;
  platform_id: number | null;
  created_at: string;
  scanned_at: string;
}

export interface StoredLog {
  id: number;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  source: string | null;
  context: string | null;
  stack_trace: string | null;
  created_at: string;
}

export interface StoredJob {
  id: number;
  title: string;
  link: string;
  email_id: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly' | null;
  description: string | null;
  created_at: string;
  scanned_at: string;
  email_date: string | null;
  email_subject: string | null;
  blacklisted: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface StoredSkill {
  id: number;
  name: string;
  category: string;
  proficiency_level: 'Expert' | 'Advanced' | 'Proficient' | 'Intermediate' | 'Basic';
  created_at: string;
}

export interface JobSkillMatch {
  id: number;
  job_id: number;
  skill_id: number;
  relevance_score: number;
  created_at: string;
}

export interface Platform {
  id: number;
  platform_name: string;
  hostname: string;
  can_crawl: 0 | 1;
  skip_reason: string | null;
  created_at: string;
}

let db: Database.Database | null = null;

/**
 * Gets or creates the database connection
 */
export function getDatabase(): Database.Database {
  if (!db) {
    // Allow test environment to override database path
    const dbName = process.env.NODE_ENV === 'test' ? 'job-seeker.test.db' : 'job-seeker.db';
    const dbPath = path.join(process.cwd(), dbName);
    db = new Database(dbPath);
    // Use DELETE journal mode for better cross-process compatibility
    // WAL mode can have issues with multiple processes not properly sharing state
    db.pragma('journal_mode = DELETE');
    db.pragma('synchronous = FULL'); // Ensure durability with DELETE mode
  }
  return db;
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Checks if an email has already been scanned
 */
export function isEmailScanned(gmailId: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare('SELECT 1 FROM emails WHERE gmail_id = ? LIMIT 1');
  const result = stmt.get(gmailId);
  return result !== undefined;
}

/**
 * Saves an email to the database
 * - High confidence emails: saves gmail_id, subject, body, and metadata
 * - Low/medium confidence emails: saves gmail_id, subject, and metadata (body is NULL)
 */
export function saveEmail(
  email: EmailMessage,
  category: EmailCategory,
  body?: string,
  platformId?: number | null
): void {
  const database = getDatabase();

  // Determine what to save based on confidence level
  const shouldSaveBody = category.confidence === 'high';
  const bodyToSave = shouldSaveBody ? (body || null) : null;

  // If platformId not provided, try to extract it from email sender
  let finalPlatformId = platformId;
  if (finalPlatformId === undefined && email.from) {
    finalPlatformId = getPlatformIdFromEmail(email.from);
  }

  const stmt = database.prepare(`
    INSERT INTO emails (gmail_id, subject, from_address, body, confidence, is_job_related, reason, created_at, processed, platform_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(gmail_id) DO UPDATE SET
      subject = excluded.subject,
      from_address = excluded.from_address,
      body = excluded.body,
      confidence = excluded.confidence,
      is_job_related = excluded.is_job_related,
      reason = excluded.reason,
      platform_id = excluded.platform_id,
      scanned_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    email.id,
    email.subject || null,
    email.from || null,
    bodyToSave,
    category.confidence,
    category.isJobRelated ? 1 : 0,
    category.reason || null,
    email.internalDate || new Date().toISOString(),
    finalPlatformId || null
  );
}

/**
 * Marks an email as processed
 */
export function markEmailAsProcessed(gmailId: string): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE emails SET processed = 1 WHERE gmail_id = ?
  `);
  stmt.run(gmailId);
}

/**
 * Marks multiple emails as processed
 */
export function markEmailsAsProcessed(gmailIds: string[]): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE emails SET processed = 1 WHERE gmail_id = ?
  `);

  const transaction = database.transaction((ids: string[]) => {
    for (const id of ids) {
      stmt.run(id);
    }
  });

  transaction(gmailIds);
}

/**
 * Gets all unprocessed emails
 */
export function getUnprocessedEmails(): StoredEmail[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM emails
    WHERE processed = 0
    ORDER BY created_at DESC
  `);
  return stmt.all() as StoredEmail[];
}

/**
 * Gets all scanned email IDs
 */
export function getScannedEmailIds(): string[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT gmail_id FROM emails');
  const rows = stmt.all() as { gmail_id: string }[];
  return rows.map(row => row.gmail_id);
}

/**
 * Gets all high-confidence job-related emails
 */
export function getHighConfidenceEmails(): StoredEmail[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM emails
    WHERE confidence = 'high' AND is_job_related = 1
    ORDER BY created_at DESC
  `);
  return stmt.all() as StoredEmail[];
}

/**
 * Gets all emails matching filter criteria
 */
export function getEmails(filter?: {
  confidence?: 'high' | 'medium' | 'low';
  isJobRelated?: boolean;
  limit?: number;
}): StoredEmail[] {
  const database = getDatabase();

  let query = 'SELECT * FROM emails WHERE 1=1';
  const params: any[] = [];

  if (filter?.confidence) {
    query += ' AND confidence = ?';
    params.push(filter.confidence);
  }

  if (filter?.isJobRelated !== undefined) {
    query += ' AND is_job_related = ?';
    params.push(filter.isJobRelated ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC';

  if (filter?.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  const stmt = database.prepare(query);
  return stmt.all(...params) as StoredEmail[];
}

/**
 * Gets statistics about scanned emails
 */
export function getEmailStats(): {
  total: number;
  jobRelated: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
} {
  const database = getDatabase();

  const total = (database.prepare('SELECT COUNT(*) as count FROM emails').get() as { count: number }).count;
  const jobRelated = (database.prepare('SELECT COUNT(*) as count FROM emails WHERE is_job_related = 1').get() as { count: number }).count;
  const highConfidence = (database.prepare('SELECT COUNT(*) as count FROM emails WHERE confidence = ?').get('high') as { count: number }).count;
  const mediumConfidence = (database.prepare('SELECT COUNT(*) as count FROM emails WHERE confidence = ?').get('medium') as { count: number }).count;
  const lowConfidence = (database.prepare('SELECT COUNT(*) as count FROM emails WHERE confidence = ?').get('low') as { count: number }).count;

  return {
    total,
    jobRelated,
    highConfidence,
    mediumConfidence,
    lowConfidence,
  };
}

/**
 * Deletes all emails from the database (for testing purposes)
 */
export function clearAllEmails(): void {
  const database = getDatabase();
  database.prepare('DELETE FROM emails').run();
}

// ============================================================================
// Job Management Functions
// ============================================================================

/**
 * Checks if a job has already been scanned
 */
export function isJobScanned(link: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare('SELECT 1 FROM jobs WHERE link = ? LIMIT 1');
  const result = stmt.get(link);
  return result !== undefined;
}

/**
 * Saves a job to the database
 * If the job link already exists, it updates the scanned_at timestamp
 */
export function saveJob(
  title: string,
  link: string,
  emailId?: number,
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly';
  },
  description?: string
): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT INTO jobs (title, link, email_id, salary_min, salary_max, salary_currency, salary_period, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(link) DO UPDATE SET
      title = excluded.title,
      email_id = COALESCE(excluded.email_id, email_id),
      salary_min = COALESCE(excluded.salary_min, salary_min),
      salary_max = COALESCE(excluded.salary_max, salary_max),
      salary_currency = COALESCE(excluded.salary_currency, salary_currency),
      salary_period = COALESCE(excluded.salary_period, salary_period),
      description = COALESCE(excluded.description, description),
      scanned_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    title,
    link,
    emailId || null,
    salary?.min || null,
    salary?.max || null,
    salary?.currency || null,
    salary?.period || null,
    description || null
  );
}

/**
 * Updates the processing status of a job
 */
export function updateJobProcessingStatus(
  jobId: number,
  status: 'pending' | 'processing' | 'completed' | 'failed'
): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE jobs SET processing_status = ? WHERE id = ?');
  stmt.run(status, jobId);
}

/**
 * Gets all scanned job links
 */
export function getScannedJobLinks(): string[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT link FROM jobs');
  const rows = stmt.all() as { link: string }[];
  return rows.map(row => row.link);
}

/**
 * Gets all jobs matching filter criteria
 */
export function getJobs(filter?: {
  emailId?: number;
  limit?: number;
  includeBlacklisted?: boolean;
}): StoredJob[] {
  const database = getDatabase();

  let query = `
    SELECT
      j.id, j.title, j.link, j.email_id,
      j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
      j.description, j.created_at, j.scanned_at,
      e.created_at as email_date,
      e.subject as email_subject,
      j.blacklisted,
      j.processing_status
    FROM jobs j
    LEFT JOIN emails e ON j.email_id = e.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Filter out blacklisted jobs by default
  if (!filter?.includeBlacklisted) {
    query += ' AND j.blacklisted = 0';
  }

  if (filter?.emailId !== undefined) {
    query += ' AND j.email_id = ?';
    params.push(filter.emailId);
  }

  query += ' ORDER BY COALESCE(e.created_at, j.created_at) DESC';

  if (filter?.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  const stmt = database.prepare(query);
  return stmt.all(...params) as StoredJob[];
}

/**
 * Gets a single job by ID
 */
export function getJobById(jobId: number): StoredJob | null {
  const database = getDatabase();

  const query = `
    SELECT
      j.id, j.title, j.link, j.email_id,
      j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
      j.description, j.created_at, j.scanned_at,
      e.created_at as email_date,
      j.blacklisted
    FROM jobs j
    LEFT JOIN emails e ON j.email_id = e.id
    WHERE j.id = ?
  `;

  const stmt = database.prepare(query);
  const result = stmt.get(jobId) as StoredJob | undefined;
  return result || null;
}

/**
 * Mark a job as blacklisted or not
 */
export function markJobBlacklisted(jobId: number, blacklisted: boolean): void {
  const database = getDatabase();
  database.prepare('UPDATE jobs SET blacklisted = ? WHERE id = ?').run(blacklisted ? 1 : 0, jobId);
}

/**
 * Reset all jobs to not blacklisted
 */
export function resetAllJobsBlacklisted(): void {
  const database = getDatabase();
  database.prepare('UPDATE jobs SET blacklisted = 0').run();
}

/**
 * Get count of blacklisted jobs
 */
export function getBlacklistedJobCount(): number {
  const database = getDatabase();
  const result = database.prepare('SELECT COUNT(*) as count FROM jobs WHERE blacklisted = 1').get() as { count: number };
  return result.count;
}

/**
 * Gets statistics about scanned jobs
 */
export function getJobStats(): {
  total: number;
} {
  const database = getDatabase();

  const total = (database.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }).count;

  return {
    total,
  };
}

/**
 * Deletes all jobs from the database (for testing purposes)
 */
export function clearAllJobs(): void {
  const database = getDatabase();
  database.prepare('DELETE FROM jobs').run();
}

/**
 * Deletes a job by ID
 */
export function deleteJob(id: number): boolean {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================================================
// Skills Management Functions
// ============================================================================

/**
 * Gets all skills matching filter criteria
 */
export function getSkills(filter?: {
  category?: string;
  proficiencyLevel?: 'Expert' | 'Advanced' | 'Proficient' | 'Intermediate' | 'Basic';
  limit?: number;
}): StoredSkill[] {
  const database = getDatabase();

  let query = 'SELECT * FROM job_skills WHERE 1=1';
  const params: any[] = [];

  if (filter?.category) {
    query += ' AND category = ?';
    params.push(filter.category);
  }

  if (filter?.proficiencyLevel) {
    query += ' AND proficiency_level = ?';
    params.push(filter.proficiencyLevel);
  }

  query += ' ORDER BY proficiency_level DESC, name ASC';

  if (filter?.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  const stmt = database.prepare(query);
  return stmt.all(...params) as StoredSkill[];
}

/**
 * Gets skills by category
 */
export function getSkillsByCategory(category: string): StoredSkill[] {
  return getSkills({ category });
}

/**
 * Gets skills by proficiency level
 */
export function getSkillsByProficiency(proficiencyLevel: 'Expert' | 'Advanced' | 'Proficient' | 'Intermediate' | 'Basic'): StoredSkill[] {
  return getSkills({ proficiencyLevel });
}

/**
 * Gets a skill by name
 */
export function getSkillByName(name: string): StoredSkill | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM job_skills WHERE name = ? LIMIT 1');
  const result = stmt.get(name) as StoredSkill | undefined;
  return result || null;
}

/**
 * Gets list of unique skill categories
 */
export function getSkillCategories(): string[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT DISTINCT category FROM job_skills ORDER BY category');
  const rows = stmt.all() as { category: string }[];
  return rows.map(row => row.category);
}

/**
 * Gets statistics about skills
 */
export function getSkillStats(): {
  total: number;
  byProficiency: { [key: string]: number };
  byCategory: { [key: string]: number };
} {
  const database = getDatabase();

  const total = (database.prepare('SELECT COUNT(*) as count FROM job_skills').get() as { count: number }).count;

  // Get counts by proficiency level
  const proficiencyRows = database.prepare(`
    SELECT proficiency_level, COUNT(*) as count
    FROM job_skills
    GROUP BY proficiency_level
  `).all() as { proficiency_level: string; count: number }[];

  const byProficiency: { [key: string]: number } = {};
  proficiencyRows.forEach(row => {
    byProficiency[row.proficiency_level] = row.count;
  });

  // Get counts by category
  const categoryRows = database.prepare(`
    SELECT category, COUNT(*) as count
    FROM job_skills
    GROUP BY category
  `).all() as { category: string; count: number }[];

  const byCategory: { [key: string]: number } = {};
  categoryRows.forEach(row => {
    byCategory[row.category] = row.count;
  });

  return {
    total,
    byProficiency,
    byCategory,
  };
}

// ============================================================================
// Job-Skill Match Management Functions
// ============================================================================

/**
 * Associates a skill with a job
 */
export function addSkillToJob(
  jobId: number,
  skillId: number,
  relevanceScore: number = 50
): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT INTO job_skill_matches (job_id, skill_id, relevance_score)
    VALUES (?, ?, ?)
    ON CONFLICT(job_id, skill_id) DO UPDATE SET
      relevance_score = excluded.relevance_score
  `);

  stmt.run(jobId, skillId, relevanceScore);
}

/**
 * Associates multiple skills with a job
 */
export function addSkillsToJob(
  jobId: number,
  skillIds: number[],
  relevanceScore: number = 50
): void {
  skillIds.forEach(skillId => {
    addSkillToJob(jobId, skillId, relevanceScore);
  });
}

/**
 * Removes a skill association from a job
 */
export function removeSkillFromJob(jobId: number, skillId: number): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM job_skill_matches WHERE job_id = ? AND skill_id = ?');
  stmt.run(jobId, skillId);
}

/**
 * Gets all skills for a specific job
 */
export function getSkillsForJob(jobId: number): (StoredSkill & { relevance_score: number })[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT
      js.id,
      js.name,
      js.category,
      js.proficiency_level,
      js.created_at,
      jsm.relevance_score
    FROM job_skill_matches jsm
    JOIN job_skills js ON jsm.skill_id = js.id
    WHERE jsm.job_id = ?
    ORDER BY jsm.relevance_score DESC, js.name ASC
  `);

  return stmt.all(jobId) as (StoredSkill & { relevance_score: number })[];
}

/**
 * Gets all jobs that require a specific skill
 */
export function getJobsForSkill(skillId: number): (StoredJob & { relevance_score: number })[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT
      j.id,
      j.title,
      j.link,
      j.email_id,
      j.created_at,
      j.scanned_at,
      jsm.relevance_score
    FROM job_skill_matches jsm
    JOIN jobs j ON jsm.job_id = j.id
    WHERE jsm.skill_id = ?
    ORDER BY jsm.relevance_score DESC, j.created_at DESC
  `);

  return stmt.all(skillId) as (StoredJob & { relevance_score: number })[];
}

/**
 * Gets match score for a job based on user's skills
 * Returns percentage of required skills that the user has
 */
export function getJobMatchScore(jobId: number): {
  matchPercentage: number;
  matchedSkills: number;
  totalRequiredSkills: number;
  matchedSkillNames: string[];
} {
  const database = getDatabase();

  // Get total required skills for the job
  const totalStmt = database.prepare('SELECT COUNT(*) as count FROM job_skill_matches WHERE job_id = ?');
  const totalResult = totalStmt.get(jobId) as { count: number };
  const totalRequiredSkills = totalResult.count;

  if (totalRequiredSkills === 0) {
    return {
      matchPercentage: 0,
      matchedSkills: 0,
      totalRequiredSkills: 0,
      matchedSkillNames: [],
    };
  }

  // Get matched skills (all skills in job_skill_matches are assumed to be user's skills)
  const matchedStmt = database.prepare(`
    SELECT js.name
    FROM job_skill_matches jsm
    JOIN job_skills js ON jsm.skill_id = js.id
    WHERE jsm.job_id = ?
  `);

  const matchedRows = matchedStmt.all(jobId) as { name: string }[];
  const matchedSkills = matchedRows.length;
  const matchedSkillNames = matchedRows.map(row => row.name);

  const matchPercentage = Math.round((matchedSkills / totalRequiredSkills) * 100);

  return {
    matchPercentage,
    matchedSkills,
    totalRequiredSkills,
    matchedSkillNames,
  };
}

/**
 * Finds jobs that match user's skills with minimum match percentage
 */
export function findMatchingJobs(minMatchPercentage: number = 50): Array<{
  job: StoredJob;
  matchPercentage: number;
  matchedSkills: number;
  totalRequiredSkills: number;
}> {
  const database = getDatabase();

  // Get all jobs that have skill requirements
  const jobsStmt = database.prepare(`
    SELECT DISTINCT job_id FROM job_skill_matches
  `);

  const jobIds = (jobsStmt.all() as { job_id: number }[]).map(row => row.job_id);

  const matchingJobs: Array<{
    job: StoredJob;
    matchPercentage: number;
    matchedSkills: number;
    totalRequiredSkills: number;
  }> = [];

  jobIds.forEach(jobId => {
    const matchScore = getJobMatchScore(jobId);

    if (matchScore.matchPercentage >= minMatchPercentage) {
      // Get job details
      const jobStmt = database.prepare('SELECT * FROM jobs WHERE id = ?');
      const job = jobStmt.get(jobId) as StoredJob;

      if (job) {
        matchingJobs.push({
          job,
          matchPercentage: matchScore.matchPercentage,
          matchedSkills: matchScore.matchedSkills,
          totalRequiredSkills: matchScore.totalRequiredSkills,
        });
      }
    }
  });

  // Sort by match percentage descending
  return matchingJobs.sort((a, b) => b.matchPercentage - a.matchPercentage);
}

/**
 * Gets statistics about job-skill matches
 */
export function getJobSkillMatchStats(): {
  totalMatches: number;
  jobsWithSkills: number;
  avgSkillsPerJob: number;
} {
  const database = getDatabase();

  const totalMatches = (database.prepare('SELECT COUNT(*) as count FROM job_skill_matches').get() as { count: number }).count;
  const jobsWithSkills = (database.prepare('SELECT COUNT(DISTINCT job_id) as count FROM job_skill_matches').get() as { count: number }).count;

  const avgSkillsPerJob = jobsWithSkills > 0 ? Math.round((totalMatches / jobsWithSkills) * 10) / 10 : 0;

  return {
    totalMatches,
    jobsWithSkills,
    avgSkillsPerJob,
  };
}

/**
 * Deletes all job-skill matches (for testing purposes)
 */
export function clearAllJobSkillMatches(): void {
  const database = getDatabase();
  database.prepare('DELETE FROM job_skill_matches').run();
}

// ========================================
// Platform Functions
// ========================================

/**
 * Gets all platforms from database
 */
export function getPlatforms(): Platform[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM platforms ORDER BY platform_name ASC');
  return stmt.all() as Platform[];
}

/**
 * Extracts hostname from URL (without TLD)
 * Examples:
 *   https://linkedin.com/jobs → linkedin
 *   https://freelancermap.de/project → freelancermap
 *   https://jobs.linkedin.com/view → linkedin
 *   https://app.greenhouse.io/jobs → greenhouse
 *   https://linkedin.co.uk/jobs → linkedin
 */
function extractHostnameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.toLowerCase();

    // Remove www prefix if present
    domain = domain.replace(/^www\./, '');

    // Split by dots
    const parts = domain.split('.');

    // If only one part, return it
    if (parts.length === 1) return parts[0];

    // For 2 parts (domain.tld): return first part
    if (parts.length === 2) {
      return parts[0];
    }

    // For 3+ parts, check if it's a country code TLD (ccTLD)
    // Common pattern: domain.co.uk, domain.com.au, etc.
    // If second-to-last is 2-3 chars and looks like a ccTLD part, take third-to-last
    const lastPart = parts[parts.length - 1];
    const secondToLast = parts[parts.length - 2];

    // Check if this looks like a ccTLD pattern (e.g., co.uk, com.au, ne.jp)
    if (secondToLast.length <= 3 && lastPart.length <= 3 && parts.length >= 3) {
      // Likely a ccTLD, return third-to-last part
      return parts[parts.length - 3];
    }

    // For regular subdomains (jobs.linkedin.com), return second-to-last part
    return parts[parts.length - 2];
  } catch {
    return '';
  }
}

/**
 * Extracts hostname from domain string (without TLD)
 * Examples:
 *   linkedin.com → linkedin
 *   freelancermap.de → freelancermap
 *   jobs.linkedin.com → linkedin
 *   linkedin.co.uk → linkedin
 */
function extractHostnameFromDomain(domain: string): string {
  if (!domain) return '';

  // Remove www prefix if present
  domain = domain.replace(/^www\./, '');

  // Split by dots
  const parts = domain.split('.');

  // If only one part, return it
  if (parts.length === 1) return parts[0];

  // For 2 parts (domain.tld): return first part
  if (parts.length === 2) {
    return parts[0];
  }

  // For 3+ parts, check if it's a country code TLD (ccTLD)
  const lastPart = parts[parts.length - 1];
  const secondToLast = parts[parts.length - 2];

  // Check if this looks like a ccTLD pattern (e.g., co.uk, com.au, ne.jp)
  if (secondToLast.length <= 3 && lastPart.length <= 3 && parts.length >= 3) {
    // Likely a ccTLD, return third-to-last part
    return parts[parts.length - 3];
  }

  // For regular subdomains (jobs.linkedin.com), return second-to-last part
  return parts[parts.length - 2];
}

/**
 * Gets platform by matching URL hostname (TLD-agnostic)
 * Matches base hostname without TLD, so linkedin.com, linkedin.de, linkedin.co.uk all match "linkedin"
 * Also supports subdomain matching (e.g., jobs.linkedin.com matches linkedin)
 */
export function getPlatformByDomain(url: string): Platform | null {
  const hostname = extractHostnameFromUrl(url);
  if (!hostname) return null;

  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM platforms WHERE hostname = ? LIMIT 1');
  const platform = stmt.get(hostname) as Platform | undefined;

  return platform || null;
}

/**
 * Gets platform ID from email address (TLD-agnostic)
 * Uses hostname matching to find the platform
 * Handles email forwarding services (e.g., alias+original=domain.com@forwarder.li)
 */
export function getPlatformIdFromEmail(emailAddress: string): number | null {
  if (!emailAddress) return null;

  // Extract the full email part (everything between < and > or the whole string)
  const emailMatch = emailAddress.match(/<([^>]+)>|([^\s<>]+@[^\s<>]+)/);
  if (!emailMatch) return null;

  const fullEmail = (emailMatch[1] || emailMatch[2]).toLowerCase().trim();

  // Check if this is a forwarded email pattern: alias+something=originaldomain@forwarder.domain
  // Example: chjobs+candidate=jobs.ch@lale.li
  const forwardedMatch = fullEmail.match(/[^@]+\+[^=]+=([^@]+)@/);

  let domain: string;
  if (forwardedMatch) {
    // Extract the original domain from the forwarding pattern
    domain = forwardedMatch[1];
  } else {
    // Standard email - extract domain after @
    const standardMatch = fullEmail.match(/@([^>]+)/);
    if (!standardMatch) return null;
    domain = standardMatch[1].replace(/[>\)\]]+$/, '');
  }

  const hostname = extractHostnameFromDomain(domain);
  if (!hostname) return null;

  const database = getDatabase();
  const stmt = database.prepare('SELECT id FROM platforms WHERE hostname = ? LIMIT 1');
  const result = stmt.get(hostname) as { id: number } | undefined;

  return result ? result.id : null;
}

/**
 * Checks if a URL can be crawled
 * Returns true if platform is not found (allow unknown platforms) or if platform has can_crawl=1
 */
export function canCrawlUrl(url: string): boolean {
  const platform = getPlatformByDomain(url);

  // Allow crawling if platform not found (unknown platforms default to allowed)
  if (!platform) return true;

  // Check can_crawl flag
  return platform.can_crawl === 1;
}

/**
 * Gets the skip reason for a non-crawlable URL
 * Returns null if URL can be crawled or platform not found
 */
export function getSkipReason(url: string): string | null {
  const platform = getPlatformByDomain(url);

  if (!platform || platform.can_crawl === 1) {
    return null;
  }

  return platform.skip_reason || 'Platform marked as non-crawlable';
}

/**
 * Updates crawlability setting for a platform
 */
export function updatePlatformCrawlability(
  hostname: string,
  canCrawl: boolean,
  skipReason?: string
): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE platforms
    SET can_crawl = ?, skip_reason = ?
    WHERE hostname = ?
  `);
  stmt.run(canCrawl ? 1 : 0, skipReason || null, hostname);
}

/**
 * Gets statistics about platforms
 */
export function getPlatformStats(): {
  total: number;
  crawlable: number;
  nonCrawlable: number;
} {
  const database = getDatabase();

  const total = (database.prepare('SELECT COUNT(*) as count FROM platforms').get() as { count: number }).count;
  const crawlable = (database.prepare('SELECT COUNT(*) as count FROM platforms WHERE can_crawl = 1').get() as { count: number }).count;
  const nonCrawlable = total - crawlable;

  return {
    total,
    crawlable,
    nonCrawlable,
  };
}

// ============================================================================
// Log Management Functions
// ============================================================================

/**
 * Saves a log entry to the database
 */
export function saveLog(
  level: 'error' | 'warning' | 'info' | 'debug',
  message: string,
  options?: {
    source?: string;
    context?: Record<string, any>;
    stackTrace?: string;
  }
): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT INTO logs (level, message, source, context, stack_trace)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    level,
    message,
    options?.source || null,
    options?.context ? JSON.stringify(options.context) : null,
    options?.stackTrace || null
  );
}

/**
 * Gets all logs matching filter criteria
 */
export function getLogs(filter?: {
  level?: 'error' | 'warning' | 'info' | 'debug';
  source?: string;
  limit?: number;
  offset?: number;
}): StoredLog[] {
  const database = getDatabase();

  let query = 'SELECT * FROM logs WHERE 1=1';
  const params: any[] = [];

  if (filter?.level) {
    query += ' AND level = ?';
    params.push(filter.level);
  }

  if (filter?.source) {
    query += ' AND source = ?';
    params.push(filter.source);
  }

  query += ' ORDER BY created_at DESC, id DESC';

  if (filter?.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  if (filter?.offset) {
    query += ' OFFSET ?';
    params.push(filter.offset);
  }

  const stmt = database.prepare(query);
  return stmt.all(...params) as StoredLog[];
}

/**
 * Gets log statistics
 */
export function getLogStats(): {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  debug: number;
} {
  const database = getDatabase();

  const total = (database.prepare('SELECT COUNT(*) as count FROM logs').get() as { count: number }).count;
  const errors = (database.prepare('SELECT COUNT(*) as count FROM logs WHERE level = ?').get('error') as { count: number }).count;
  const warnings = (database.prepare('SELECT COUNT(*) as count FROM logs WHERE level = ?').get('warning') as { count: number }).count;
  const info = (database.prepare('SELECT COUNT(*) as count FROM logs WHERE level = ?').get('info') as { count: number }).count;
  const debug = (database.prepare('SELECT COUNT(*) as count FROM logs WHERE level = ?').get('debug') as { count: number }).count;

  return {
    total,
    errors,
    warnings,
    info,
    debug,
  };
}

/**
 * Gets recent logs by level
 */
export function getRecentLogs(level: 'error' | 'warning' | 'info' | 'debug', limit: number = 10): StoredLog[] {
  return getLogs({ level, limit });
}

/**
 * Deletes old logs (older than specified days)
 */
export function deleteOldLogs(daysOld: number): number {
  const database = getDatabase();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const stmt = database.prepare(`
    DELETE FROM logs WHERE created_at < ?
  `);

  const result = stmt.run(cutoffDate.toISOString());
  return result.changes;
}

/**
 * Deletes all logs from the database (for testing purposes)
 */
export function clearAllLogs(): void {
  const database = getDatabase();

  // Check if logs table exists, if not, create it
  const tableExists = database.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='logs'
  `).get();

  if (!tableExists) {
    // Create the logs table if it doesn't exist
    database.exec(`
      CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL CHECK(level IN ('error', 'warning', 'info', 'debug')),
        message TEXT NOT NULL,
        source TEXT,
        context TEXT,
        stack_trace TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_logs_level ON logs(level);
      CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
      CREATE INDEX idx_logs_source ON logs(source);
    `);
  } else {
    // Table exists, clear it
    database.prepare('DELETE FROM logs').run();
  }
}
