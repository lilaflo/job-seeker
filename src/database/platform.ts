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
 */
export async function getPlatformIdFromEmail(emailAddress: string): Promise<number | null> {
  const domain = emailAddress.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const parts = domain.split('.');
  const domainWithoutTld = parts.length > 1 ? parts[0] : domain;

  const result = await query<{ id: number }>(
    'SELECT id FROM platforms WHERE hostname = $1',
    [domainWithoutTld]
  );

  return result.rows[0]?.id || null;
}

/**
 * Check if URL can be crawled
 */
export async function canCrawlUrl(url: string): Promise<boolean> {
  const platform = await getPlatformByDomain(url);
  if (!platform) return true; // Allow crawling unknown platforms
  return platform.can_crawl === 1;
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
    [canCrawl ? 1 : 0, skipReason || null, domain]
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
      SUM(CASE WHEN can_crawl = 1 THEN 1 ELSE 0 END) as crawlable,
      SUM(CASE WHEN can_crawl = 0 THEN 1 ELSE 0 END) as non_crawlable
    FROM platforms
  `);

  const row = result.rows[0];
  return {
    total: parseInt(row.total) || 0,
    crawlable: parseInt(row.crawlable) || 0,
    nonCrawlable: parseInt(row.non_crawlable) || 0,
  };
}
