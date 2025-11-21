/**
 * Job Database Functions
 * Handles job-related database operations
 */

import { query } from './index';
import { JobRow } from './types';

/**
 * Check if a job link has been scanned
 */
export async function isJobScanned(link: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM jobs WHERE link = $1) as exists',
    [link]
  );
  return result.rows[0]?.exists || false;
}

/**
 * Save job to database (legacy sync version - throws error)
 * @deprecated Use saveJobAsync instead
 */
export function saveJob(
  title: string,
  link: string,
  emailId?: number,
  salary?: { min: number | null; max: number | null; currency: string | null; period: string | null } | null,
  description?: string | null
): number {
  // Note: For PostgreSQL, we need to make this async. For now, keeping sync signature for compatibility
  // This will be updated when we migrate the calling code
  throw new Error('saveJob must be called with saveJobAsync for PostgreSQL');
}

/**
 * Save job to database (async version for PostgreSQL)
 * Returns { id: number, isNew: boolean } to indicate if job was created or updated
 */
export async function saveJobAsync(
  title: string,
  link: string,
  emailId?: number,
  salary?: { min: number | null; max: number | null; currency: string | null; period: string | null } | null,
  description?: string | null
): Promise<{ id: number; isNew: boolean }> {
  // First check if job exists
  const existingJob = await query<{ id: number }>(
    'SELECT id FROM jobs WHERE link = $1',
    [link]
  );
  const isNew = existingJob.rows.length === 0;

  const result = await query<{ id: number }>(
    `INSERT INTO jobs (title, link, email_id, salary_min, salary_max, salary_currency, salary_period, description, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (link)
     DO UPDATE SET
       title = EXCLUDED.title,
       email_id = COALESCE(EXCLUDED.email_id, jobs.email_id),
       salary_min = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
       salary_max = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
       salary_currency = COALESCE(EXCLUDED.salary_currency, jobs.salary_currency),
       salary_period = COALESCE(EXCLUDED.salary_period, jobs.salary_period),
       description = COALESCE(EXCLUDED.description, jobs.description),
       scanned_at = NOW()
     RETURNING id`,
    [
      title,
      link,
      emailId || null,
      salary?.min || null,
      salary?.max || null,
      salary?.currency || null,
      salary?.period || null,
      description || null,
    ]
  );
  return { id: result.rows[0].id, isNew };
}

/**
 * Update job processing status
 */
export async function updateJobProcessingStatus(
  jobId: number,
  status: 'pending' | 'processing' | 'completed' | 'failed'
): Promise<void> {
  await query('UPDATE jobs SET processing_status = $1 WHERE id = $2', [status, jobId]);
}

/**
 * Get all scanned job links
 */
export async function getScannedJobLinks(): Promise<string[]> {
  const result = await query<{ link: string }>('SELECT link FROM jobs');
  return result.rows.map(row => row.link);
}

/**
 * Get jobs with filters (includes email subject via JOIN)
 */
export async function getJobs(filters?: {
  emailId?: number;
  limit?: number;
  includeBlacklisted?: boolean;
}): Promise<JobRow[]> {
  let sql = `
    SELECT
      jobs.*,
      emails.subject as email_subject,
      emails.created_at as email_date
    FROM jobs
    LEFT JOIN emails ON jobs.email_id = emails.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 1;

  if (filters?.emailId) {
    sql += ` AND jobs.email_id = $${paramCount++}`;
    params.push(filters.emailId);
  }
  if (!filters?.includeBlacklisted) {
    sql += ' AND jobs.blacklisted = FALSE';
  }
  sql += ' ORDER BY jobs.created_at DESC';
  if (filters?.limit) {
    sql += ` LIMIT $${paramCount++}`;
    params.push(filters.limit);
  }

  const result = await query<JobRow>(sql, params);
  return result.rows;
}

/**
 * Get job statistics
 */
export async function getJobStats(): Promise<{ total: number }> {
  const result = await query('SELECT COUNT(*) as total FROM jobs');
  return {
    total: parseInt(result.rows[0].total) || 0,
  };
}

/**
 * Get job by ID
 */
export async function getJobById(jobId: number): Promise<JobRow | null> {
  const result = await query<JobRow>('SELECT * FROM jobs WHERE id = $1', [jobId]);
  return result.rows[0] || null;
}

/**
 * Delete job by ID
 */
export async function deleteJob(jobId: number): Promise<boolean> {
  const result = await query('DELETE FROM jobs WHERE id = $1', [jobId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Mark job as blacklisted
 */
export async function markJobBlacklisted(jobId: number, blacklisted: boolean): Promise<void> {
  await query('UPDATE jobs SET blacklisted = $1 WHERE id = $2', [blacklisted, jobId]);
}

/**
 * Reset all jobs blacklisted status
 */
export async function resetAllJobsBlacklisted(): Promise<void> {
  await query('UPDATE jobs SET blacklisted = FALSE');
}

/**
 * Get blacklisted job count
 */
export async function getBlacklistedJobCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM jobs WHERE blacklisted = TRUE');
  return parseInt(result.rows[0].count) || 0;
}

/**
 * Clear all jobs (for testing)
 */
export async function clearAllJobs(): Promise<void> {
  await query('DELETE FROM jobs');
}
