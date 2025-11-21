/**
 * Blacklist Database Functions
 * Handles blacklist keyword-related database operations
 */

import { query } from './index';
import { BlacklistKeyword } from './types';

/**
 * Get all blacklist keywords
 */
export async function getBlacklistKeywords(): Promise<BlacklistKeyword[]> {
  const result = await query<BlacklistKeyword>('SELECT * FROM blacklist ORDER BY keyword ASC');
  return result.rows;
}

/**
 * Save blacklist keyword without embedding
 */
export async function saveBlacklistKeywordWithoutEmbedding(keyword: string): Promise<number> {
  const result = await query<{ id: number }>(
    'INSERT INTO blacklist (keyword) VALUES ($1) ON CONFLICT (keyword) DO UPDATE SET keyword = EXCLUDED.keyword RETURNING id',
    [keyword]
  );
  return result.rows[0].id;
}

/**
 * Update blacklist keyword embedding
 */
export async function updateBlacklistKeywordEmbedding(blacklistId: number, embedding: number[]): Promise<void> {
  const vectorString = `[${embedding.join(',')}]`;
  await query(
    'UPDATE blacklist SET embedding = $1::vector WHERE id = $2',
    [vectorString, blacklistId]
  );
}

/**
 * Clear all blacklist keywords
 */
export async function clearBlacklist(): Promise<void> {
  await query('DELETE FROM blacklist');
}

/**
 * Get blacklist text (one keyword per line)
 */
export async function getBlacklistText(): Promise<string> {
  const keywords = await getBlacklistKeywords();
  return keywords.map(k => k.keyword).join('\n');
}
