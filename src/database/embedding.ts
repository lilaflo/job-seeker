/**
 * Embedding Database Functions
 * Handles vector embedding-related database operations using pgvector
 * Embeddings are now stored directly in the jobs table
 */

import { query } from './index';

/**
 * Save job embedding using pgvector (now stored in jobs table)
 */
export async function saveJobEmbedding(jobId: number, embedding: number[], model: string): Promise<void> {
  const vectorString = `[${embedding.join(',')}]`;
  await query(
    `UPDATE jobs
     SET embedding = $1::vector, embedding_model = $2
     WHERE id = $3`,
    [vectorString, model, jobId]
  );
}

/**
 * Get job embedding
 */
export async function getJobEmbedding(jobId: number): Promise<number[] | null> {
  const result = await query<{ embedding: string }>(
    'SELECT embedding::text FROM jobs WHERE id = $1',
    [jobId]
  );

  if (!result.rows[0] || !result.rows[0].embedding) return null;

  // Parse pgvector string format: "[0.1,0.2,0.3,...]"
  const embeddingString = result.rows[0].embedding;
  const values = embeddingString.slice(1, -1).split(',').map(parseFloat);
  return values;
}

/**
 * Check if job has embedding
 */
export async function hasJobEmbedding(jobId: number): Promise<boolean> {
  const result = await query<{ has_embedding: boolean }>(
    'SELECT (embedding IS NOT NULL) as has_embedding FROM jobs WHERE id = $1',
    [jobId]
  );
  return result.rows[0]?.has_embedding || false;
}

/**
 * Get jobs without embeddings
 */
export async function getJobsWithoutEmbeddings(): Promise<Array<{ id: number; title: string; description: string | null }>> {
  const result = await query<{ id: number; title: string; description: string | null }>(`
    SELECT id, title, description
    FROM jobs
    WHERE embedding IS NULL
  `);
  return result.rows;
}

/**
 * Search similar jobs using pgvector cosine similarity
 */
export async function searchSimilarJobsPG(
  queryEmbedding: number[],
  limit: number = 20,
  minSimilarity: number = 0.3
): Promise<Array<{
  id: number;
  title: string;
  link: string;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  created_at: string;
  similarity: number;
}>> {
  const vectorString = `[${queryEmbedding.join(',')}]`;

  const result = await query(`
    SELECT
      id, title, link, description,
      salary_min, salary_max, salary_currency, salary_period,
      created_at,
      1 - (embedding <=> $1::vector) as similarity
    FROM jobs
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) >= $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `, [vectorString, minSimilarity, limit]);

  return result.rows;
}

/**
 * Clear all job embeddings
 */
export async function clearAllEmbeddings(): Promise<void> {
  await query('UPDATE jobs SET embedding = NULL, embedding_model = NULL');
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(): Promise<{
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  const result = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embeddings
    FROM jobs
  `);

  const row = result.rows[0];
  const total = parseInt(row.total) || 0;
  const withEmbeddings = parseInt(row.with_embeddings) || 0;

  return {
    total,
    withEmbeddings,
    withoutEmbeddings: total - withEmbeddings,
  };
}

/**
 * Get all jobs with embeddings (for blacklist checking)
 */
export async function getJobsWithEmbeddings(): Promise<Array<{ id: number; title: string; embedding: string }>> {
  const result = await query<{ id: number; title: string; embedding: string }>(`
    SELECT id, title, embedding::text as embedding
    FROM jobs
    WHERE embedding IS NOT NULL
      AND blacklisted = 0
  `);
  return result.rows;
}
