/**
 * Email Database Functions
 * Handles email-related database operations
 */

import { query } from './index';
import { EmailRow } from './types';

/**
 * Check if an email has been scanned
 */
export async function isEmailScanned(gmailId: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM emails WHERE gmail_id = $1) as exists',
    [gmailId]
  );
  return result.rows[0]?.exists || false;
}

/**
 * Get email by Gmail ID
 */
export async function getEmailByGmailId(gmailId: string): Promise<EmailRow | null> {
  const result = await query<EmailRow>(
    'SELECT * FROM emails WHERE gmail_id = $1',
    [gmailId]
  );
  return result.rows[0] || null;
}

/**
 * Save email to database
 */
export async function saveEmail(
  gmailId: string,
  subject: string | null,
  fromAddress: string | null,
  body: string | null,
  confidence: 'high' | 'medium' | 'low',
  isJobRelated: boolean,
  reason: string | null,
  platformId?: number,
  rawSource?: string | null
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO emails (gmail_id, subject, from_address, body, confidence, is_job_related, reason, platform_id, raw_source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (gmail_id)
     DO UPDATE SET
       subject = EXCLUDED.subject,
       from_address = EXCLUDED.from_address,
       body = EXCLUDED.body,
       confidence = EXCLUDED.confidence,
       is_job_related = EXCLUDED.is_job_related,
       reason = EXCLUDED.reason,
       platform_id = EXCLUDED.platform_id,
       raw_source = COALESCE(EXCLUDED.raw_source, emails.raw_source),
       scanned_at = NOW()
     RETURNING id`,
    [gmailId, subject, fromAddress, body, confidence, isJobRelated ? 1 : 0, reason, platformId || null, rawSource || null]
  );
  return result.rows[0].id;
}

/**
 * Get all scanned email IDs
 */
export async function getScannedEmailIds(): Promise<string[]> {
  const result = await query<{ gmail_id: string }>('SELECT gmail_id FROM emails');
  return result.rows.map(row => row.gmail_id);
}

/**
 * Get high-confidence emails
 */
export async function getHighConfidenceEmails(limit?: number): Promise<EmailRow[]> {
  const sql = `SELECT * FROM emails WHERE confidence = 'high' AND is_job_related = 1 ORDER BY created_at DESC${limit ? ` LIMIT ${limit}` : ''}`;
  const result = await query<EmailRow>(sql);
  return result.rows;
}

/**
 * Get emails with filters
 */
export async function getEmails(filters?: {
  confidence?: 'high' | 'medium' | 'low';
  isJobRelated?: boolean;
  limit?: number;
}): Promise<EmailRow[]> {
  let sql = 'SELECT * FROM emails WHERE 1=1';
  const params: any[] = [];
  let paramCount = 1;

  if (filters?.confidence) {
    sql += ` AND confidence = $${paramCount++}`;
    params.push(filters.confidence);
  }
  if (filters?.isJobRelated !== undefined) {
    sql += ` AND is_job_related = $${paramCount++}`;
    params.push(filters.isJobRelated ? 1 : 0);
  }
  sql += ' ORDER BY created_at DESC';
  if (filters?.limit) {
    sql += ` LIMIT $${paramCount++}`;
    params.push(filters.limit);
  }

  const result = await query<EmailRow>(sql, params);
  return result.rows;
}

/**
 * Get email statistics
 */
export async function getEmailStats(): Promise<{
  total: number;
  jobRelated: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}> {
  const result = await query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_job_related = 1 THEN 1 ELSE 0 END) as job_related,
      SUM(CASE WHEN confidence = 'high' THEN 1 ELSE 0 END) as high_confidence,
      SUM(CASE WHEN confidence = 'medium' THEN 1 ELSE 0 END) as medium_confidence,
      SUM(CASE WHEN confidence = 'low' THEN 1 ELSE 0 END) as low_confidence
    FROM emails
  `);

  const row = result.rows[0];
  return {
    total: parseInt(row.total) || 0,
    jobRelated: parseInt(row.job_related) || 0,
    highConfidence: parseInt(row.high_confidence) || 0,
    mediumConfidence: parseInt(row.medium_confidence) || 0,
    lowConfidence: parseInt(row.low_confidence) || 0,
  };
}

/**
 * Mark email as processed
 */
export async function markEmailAsProcessed(gmailId: string): Promise<void> {
  await query(
    'UPDATE emails SET processed = 1 WHERE gmail_id = $1',
    [gmailId]
  );
}

/**
 * Mark multiple emails as processed
 */
export async function markEmailsAsProcessed(gmailIds: string[]): Promise<void> {
  if (gmailIds.length === 0) return;

  const placeholders = gmailIds.map((_, i) => `$${i + 1}`).join(',');
  await query(
    `UPDATE emails SET processed = 1 WHERE gmail_id IN (${placeholders})`,
    gmailIds
  );
}

/**
 * Get unprocessed emails
 */
export async function getUnprocessedEmails(limit?: number): Promise<EmailRow[]> {
  let sql = 'SELECT * FROM emails WHERE processed = 0 ORDER BY created_at DESC';
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  const result = await query<EmailRow>(sql);
  return result.rows;
}

/**
 * Clear all emails (for testing)
 */
export async function clearAllEmails(): Promise<void> {
  await query('DELETE FROM emails');
}
