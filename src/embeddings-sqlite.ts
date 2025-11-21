/**
 * Embeddings module - Generate and search vector embeddings using Ollama
 * Uses sqlite-vec for vector similarity search in SQLite
 */

import { getDatabase, getJobs, markJobBlacklisted, resetAllJobsBlacklisted, getBlacklistedJobCount } from './database';
import * as sqliteVec from 'sqlite-vec';
import { getOllamaClient, isModelAvailable } from './ollama-client';

// Embedding model configuration
const EMBEDDING_MODEL = 'hf.co/Mungert/all-MiniLM-L6-v2-GGUF';
const EMBEDDING_DIM = 384;

// Queue configuration
const BLACKLIST_CONCURRENCY = 10; // Number of concurrent embedding operations for blacklist

/**
 * Process items in a queue with concurrency control
 */
async function processQueue<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<Array<R>> {
  const results: Array<R> = [];
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      results[index] = await processor(item);
    }
  }

  // Start concurrent workers
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
  return results;
}

/**
 * Check if the embedding model is available in Ollama
 */
export async function checkEmbeddingModelAvailable(): Promise<boolean> {
  return isModelAvailable(EMBEDDING_MODEL);
}

/**
 * Initialize sqlite-vec extension for the database
 */
export function initializeVectorExtension(): void {
  const db = getDatabase();
  sqliteVec.load(db);
}

/**
 * Generate embedding for text using Ollama with timeout
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOllamaClient();

  // Add timeout wrapper (20 seconds)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Ollama embedding timeout after 20 seconds')), 20000);
  });

  const embeddingPromise = client.embeddings({
    model: EMBEDDING_MODEL,
    prompt: text,
  });

  const response = await Promise.race([embeddingPromise, timeoutPromise]);

  return response.embedding;
}

/**
 * Convert embedding array to Buffer for SQLite storage
 */
export function embeddingToBuffer(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 4);
  embedding.forEach((val, i) => {
    buffer.writeFloatLE(val, i * 4);
  });
  return buffer;
}

/**
 * Convert Buffer back to embedding array
 */
export function bufferToEmbedding(buffer: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i));
  }
  return embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Save embedding for a job
 */
export function saveJobEmbedding(jobId: number, embedding: number[]): void {
  const db = getDatabase();
  const buffer = embeddingToBuffer(embedding);

  db.prepare(`
    INSERT OR REPLACE INTO job_embeddings (job_id, embedding, embedding_dim, model)
    VALUES (?, ?, ?, ?)
  `).run(jobId, buffer, embedding.length, EMBEDDING_MODEL);
}

/**
 * Get embedding for a job
 */
export function getJobEmbedding(jobId: number): number[] | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT embedding FROM job_embeddings WHERE job_id = ?
  `).get(jobId) as { embedding: Buffer } | undefined;

  if (!row) return null;
  return bufferToEmbedding(row.embedding);
}

/**
 * Check if job has an embedding
 */
export function hasJobEmbedding(jobId: number): boolean {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT 1 FROM job_embeddings WHERE job_id = ?
  `).get(jobId);

  return !!row;
}

/**
 * Get jobs without embeddings
 */
export function getJobsWithoutEmbeddings(): Array<{ id: number; title: string; description: string | null }> {
  const db = getDatabase();
  return db.prepare(`
    SELECT j.id, j.title, j.description
    FROM jobs j
    LEFT JOIN job_embeddings e ON j.id = e.job_id
    WHERE e.job_id IS NULL
  `).all() as Array<{ id: number; title: string; description: string | null }>;
}

/**
 * Search for similar jobs using vector similarity
 */
export async function searchSimilarJobs(
  query: string,
  options: {
    limit?: number;
    minSimilarity?: number;
  } = {}
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
  const { limit = 20, minSimilarity = 0.3 } = options;

  // Generate embedding for search query
  const queryEmbedding = await generateEmbedding(query);

  const db = getDatabase();

  // Get all jobs with embeddings
  const jobsWithEmbeddings = db.prepare(`
    SELECT
      j.id, j.title, j.link, j.description,
      j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
      j.created_at, e.embedding
    FROM jobs j
    INNER JOIN job_embeddings e ON j.id = e.job_id
  `).all() as Array<{
    id: number;
    title: string;
    link: string;
    description: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    created_at: string;
    embedding: Buffer;
  }>;

  // Calculate similarity for each job
  const results = jobsWithEmbeddings
    .map(job => {
      const jobEmbedding = bufferToEmbedding(job.embedding);
      const similarity = cosineSimilarity(queryEmbedding, jobEmbedding);

      return {
        id: job.id,
        title: job.title,
        link: job.link,
        description: job.description,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        salary_currency: job.salary_currency,
        salary_period: job.salary_period,
        created_at: job.created_at,
        similarity,
      };
    })
    .filter(job => job.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Generate and save embedding for a job
 */
export async function generateAndSaveJobEmbedding(
  jobId: number,
  title: string,
  description: string | null
): Promise<void> {
  // Create text to embed - combine title and description
  const textToEmbed = description
    ? `${title}\n\n${description}`
    : title;

  const embedding = await generateEmbedding(textToEmbed);
  saveJobEmbedding(jobId, embedding);
}

/**
 * Get embedding statistics
 */
export function getEmbeddingStats(): {
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
} {
  const db = getDatabase();

  const total = (db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }).count;
  const withEmbeddings = (db.prepare('SELECT COUNT(*) as count FROM job_embeddings').get() as { count: number }).count;

  return {
    total,
    withEmbeddings,
    withoutEmbeddings: total - withEmbeddings,
  };
}

/**
 * Clear all embeddings (for testing)
 */
export function clearAllEmbeddings(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM job_embeddings').run();
}

// ============================================================================
// Blacklist Functions
// ============================================================================

export interface BlacklistKeyword {
  id: number;
  keyword: string;
  embedding: Buffer | null;
  embedding_dim: number | null;
  model: string | null;
  created_at: string;
}

/**
 * Get all blacklist keywords
 */
export function getBlacklistKeywords(): BlacklistKeyword[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM blacklist ORDER BY keyword ASC').all() as BlacklistKeyword[];
}

/**
 * Get blacklist keywords as text (one per line)
 */
export function getBlacklistText(): string {
  const keywords = getBlacklistKeywords();
  return keywords.map(k => k.keyword).join('\n');
}

/**
 * Clear all blacklist keywords
 */
export function clearBlacklist(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM blacklist').run();
}

/**
 * Save a blacklist keyword with its embedding
 */
export function saveBlacklistKeyword(keyword: string, embedding: number[]): void {
  const db = getDatabase();
  const buffer = embeddingToBuffer(embedding);

  db.prepare(`
    INSERT OR REPLACE INTO blacklist (keyword, embedding, embedding_dim, model)
    VALUES (?, ?, ?, ?)
  `).run(keyword, buffer, embedding.length, EMBEDDING_MODEL);
}

/**
 * Save a blacklist keyword without embedding (embedding will be generated later)
 * Returns the ID of the saved keyword
 */
export function saveBlacklistKeywordWithoutEmbedding(keyword: string): number {
  const db = getDatabase();

  const result = db.prepare(`
    INSERT INTO blacklist (keyword, embedding, embedding_dim, model)
    VALUES (?, NULL, NULL, NULL)
  `).run(keyword);

  return result.lastInsertRowid as number;
}

/**
 * Update embedding for an existing blacklist keyword
 */
export function updateBlacklistKeywordEmbedding(blacklistId: number, embedding: number[]): void {
  const db = getDatabase();
  const buffer = embeddingToBuffer(embedding);

  console.debug(`  → Updating blacklist ${blacklistId}: buffer size=${buffer.length}, dim=${embedding.length}, model=${EMBEDDING_MODEL}`);

  const result = db.prepare(`
    UPDATE blacklist
    SET embedding = ?, embedding_dim = ?, model = ?
    WHERE id = ?
  `).run(buffer, embedding.length, EMBEDDING_MODEL, blacklistId);

  console.debug(`  → Update result: changes=${result.changes}`);

  if (result.changes === 0) {
    console.error(`  ✗ WARNING: No rows updated for blacklist ID ${blacklistId}`);
  }
}

/**
 * Update blacklist from text (one keyword per line)
 * Saves keywords immediately and queues embedding generation jobs
 */
export async function updateBlacklistFromText(text: string): Promise<{ count: number; jobsBlacklisted: number }> {
  // Parse keywords (one per line, trim whitespace, remove empty lines)
  const keywords = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`🔄 Updating blacklist with ${keywords.length} keywords...`);

  // Clear existing blacklist
  clearBlacklist();

  // Reset all jobs to not blacklisted
  resetAllJobsBlacklisted();

  // If no keywords, return early
  if (keywords.length === 0) {
    console.log('✓ Blacklist cleared');
    return { count: 0, jobsBlacklisted: 0 };
  }

  // Save keywords immediately WITHOUT embeddings
  console.log(`  → Saving ${keywords.length} keywords to database...`);
  const keywordIds: Array<{ keyword: string; id: number }> = [];
  for (const keyword of keywords) {
    const id = saveBlacklistKeywordWithoutEmbedding(keyword);
    keywordIds.push({ keyword, id });
  }
  console.log(`  ✓ Saved ${keywords.length} keywords`);

  // Queue embedding generation jobs (async processing)
  console.log(`  → Queueing ${keywords.length} embedding jobs...`);
  const { enqueueBlacklistEmbeddings, checkRedisConnection } = await import('./queue');

  const redisAvailable = await checkRedisConnection();
  if (!redisAvailable) {
    console.error('  ✗ Redis not available - embeddings will not be generated');
    console.error('    Please start Redis to enable blacklist filtering');
    return { count: keywords.length, jobsBlacklisted: 0 };
  }

  await enqueueBlacklistEmbeddings(keywordIds);
  console.log(`  ✓ Queued ${keywords.length} embedding jobs`);
  console.log(`✓ Blacklist updated: ${keywords.length} keywords saved (embeddings processing in background)`);

  // Return immediately - embeddings and job checking happen asynchronously
  return { count: keywords.length, jobsBlacklisted: 0 };
}

/**
 * Check if text matches any blacklisted keyword using semantic similarity
 */
export async function isBlacklisted(
  text: string,
  options: { minSimilarity?: number } = {}
): Promise<{ blacklisted: boolean; matchedKeyword?: string; similarity?: number }> {
  const { minSimilarity = 0.7 } = options;

  const keywords = getBlacklistKeywords();
  if (keywords.length === 0) {
    return { blacklisted: false };
  }

  // Generate embedding for the text
  const textEmbedding = await generateEmbedding(text);

  // Check similarity with each blacklisted keyword
  for (const keyword of keywords) {
    if (!keyword.embedding) continue;

    const keywordEmbedding = bufferToEmbedding(keyword.embedding);
    const similarity = cosineSimilarity(textEmbedding, keywordEmbedding);

    if (similarity >= minSimilarity) {
      return {
        blacklisted: true,
        matchedKeyword: keyword.keyword,
        similarity,
      };
    }
  }

  return { blacklisted: false };
}

/**
 * Check if a job title/description matches blacklist
 */
export async function isJobBlacklisted(
  title: string,
  description: string | null,
  options: { minSimilarity?: number } = {}
): Promise<{ blacklisted: boolean; matchedKeyword?: string; similarity?: number }> {
  // Check title first
  const titleResult = await isBlacklisted(title, options);
  if (titleResult.blacklisted) {
    return titleResult;
  }

  // Check description if available
  if (description) {
    return isBlacklisted(description, options);
  }

  return { blacklisted: false };
}

export { EMBEDDING_MODEL, EMBEDDING_DIM };
