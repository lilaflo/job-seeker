/**
 * Platform Database Functions
 * Handles platform-related database operations
 */

import { query } from './index';
import { PlatformRow } from './types';

/**
 * Get all platforms
 */
export async function getPlatforms(): Promise<PlatformRow[]> {
  const result = await query<PlatformRow>('SELECT * FROM platforms ORDER BY platform_name');
  return result.rows;
}

/**
 * Get platform by domain/URL
 */
export async function getPlatformByDomain(url: string): Promise<PlatformRow | null> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const parts = hostname.split('.');

    // Try exact match first
    let result = await query<PlatformRow>(
      'SELECT * FROM platforms WHERE hostname = $1',
      [hostname]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Try subdomain match (e.g., jobs.linkedin.com -> linkedin)
    if (parts.length > 2) {
      const domain = parts[parts.length - 2];
      result = await query<PlatformRow>(
        'SELECT * FROM platforms WHERE hostname = $1',
        [domain]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing URL:', url, error);
    return null;
  }
}

/**
 * Get platform ID from email address
 * Extracts all domain-like patterns and tries to match them against platforms
 */
export async function getPlatformIdFromEmail(emailAddress: string): Promise<number | null> {
  // Extract all domain patterns from the email address
  // Matches: word.word or word.word.word (ignoring forwarding services)
  const domainPattern = /([a-z0-9-]+)\.([a-z0-9-]+(?:\.[a-z]{2,})?)/gi;
  const matches = emailAddress.toLowerCase().matchAll(domainPattern);

  // Try each extracted domain
  for (const match of matches) {
    const fullDomain = match[0]; // e.g., "indeed.com", "my.jobs.ch"
    const parts = fullDomain.split('.');

    // Extract second-level domain (the part before TLD)
    // For "indeed.com" → "indeed"
    // For "my.jobs.ch" → "jobs"
    const domainWithoutTld = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

    const result = await query<{ id: number }>(
      'SELECT id FROM platforms WHERE hostname = $1',
      [domainWithoutTld]
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
  }

  return null;
}

/**
 * Check if URL can be crawled
 */
export async function canCrawlUrl(url: string): Promise<boolean> {
  const platform = await getPlatformByDomain(url);
  if (!platform) return true; // Allow crawling unknown platforms
  return platform.can_crawl === true;
}

/**
 * Get skip reason for non-crawlable URL
 */
export async function getSkipReason(url: string): Promise<string | null> {
  const platform = await getPlatformByDomain(url);
  return platform?.skip_reason || null;
}

/**
 * Update platform crawlability
 */
export async function updatePlatformCrawlability(
  domain: string,
  canCrawl: boolean,
  skipReason?: string
): Promise<void> {
  await query(
    'UPDATE platforms SET can_crawl = $1, skip_reason = $2 WHERE hostname = $3',
    [canCrawl, skipReason || null, domain]
  );
}

/**
 * Get platform statistics
 */
export async function getPlatformStats(): Promise<{
  total: number;
  crawlable: number;
  nonCrawlable: number;
}> {
  const result = await query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN can_crawl = TRUE THEN 1 ELSE 0 END) as crawlable,
      SUM(CASE WHEN can_crawl = FALSE THEN 1 ELSE 0 END) as non_crawlable
    FROM platforms
  `);

  const row = result.rows[0];
  return {
    total: parseInt(row.total) || 0,
    crawlable: parseInt(row.crawlable) || 0,
    nonCrawlable: parseInt(row.non_crawlable) || 0,
  };
}
