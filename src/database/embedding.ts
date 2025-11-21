/**
 * Embedding Database Functions
 * Handles vector embedding-related database operations using pgvector
 */

import { query } from './index';

/**
 * Save job embedding using pgvector
 */
export async function saveJobEmbedding(jobId: number, embedding: number[], model: string): Promise<void> {
  const vectorString = `[${embedding.join(',')}]`;
  await query(
    `INSERT INTO job_embeddings (job_id, embedding, model)
     VALUES ($1, $2::vector, $3)
     ON CONFLICT (job_id)
     DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model`,
    [jobId, vectorString, model]
  );
}

/**
 * Get job embedding
 */
export async function getJobEmbedding(jobId: number): Promise<number[] | null> {
  const result = await query<{ embedding: string }>(
    'SELECT embedding::text FROM job_embeddings WHERE job_id = $1',
    [jobId]
  );

  if (!result.rows[0]) return null;

  // Parse pgvector string format: "[0.1,0.2,0.3,...]"
  const embeddingString = result.rows[0].embedding;
  const values = embeddingString.slice(1, -1).split(',').map(parseFloat);
  return values;
}

/**
 * Check if job has embedding
 */
export async function hasJobEmbedding(jobId: number): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM job_embeddings WHERE job_id = $1) as exists',
    [jobId]
  );
  return result.rows[0]?.exists || false;
}

/**
 * Get jobs without embeddings
 */
export async function getJobsWithoutEmbeddings(): Promise<Array<{ id: number; title: string; description: string | null }>> {
  const result = await query<{ id: number; title: string; description: string | null }>(`
    SELECT j.id, j.title, j.description
    FROM jobs j
    LEFT JOIN job_embeddings e ON j.id = e.job_id
    WHERE e.job_id IS NULL
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
      j.id, j.title, j.link, j.description,
      j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
      j.created_at,
      1 - (e.embedding <=> $1::vector) as similarity
    FROM jobs j
    INNER JOIN job_embeddings e ON j.id = e.job_id
    WHERE 1 - (e.embedding <=> $1::vector) >= $2
    ORDER BY e.embedding <=> $1::vector
    LIMIT $3
  `, [vectorString, minSimilarity, limit]);

  return result.rows;
}

/**
 * Clear all job embeddings
 */
export async function clearAllEmbeddings(): Promise<void> {
  await query('DELETE FROM job_embeddings');
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
      (SELECT COUNT(*) FROM jobs) as total,
      (SELECT COUNT(*) FROM job_embeddings) as with_embeddings
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
    SELECT j.id, j.title, e.embedding::text as embedding
    FROM jobs j
    INNER JOIN job_embeddings e ON j.id = e.job_id
    WHERE j.blacklisted = 0
  `);
  return result.rows;
}
