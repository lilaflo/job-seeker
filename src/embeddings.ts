/**
 * Embeddings module - Generate and search vector embeddings using Ollama
 * PostgreSQL/pgvector version
 */

import {
  getJobs,
  markJobBlacklisted,
  resetAllJobsBlacklisted,
  getBlacklistedJobCount,
  getBlacklistKeywords,
  saveBlacklistKeywordWithoutEmbedding,
  updateBlacklistKeywordEmbedding,
  clearBlacklist,
  getBlacklistText,
  saveJobEmbedding,
  getJobEmbedding,
  hasJobEmbedding,
  getJobsWithoutEmbeddings,
  searchSimilarJobsPG,
  clearAllEmbeddings,
  getEmbeddingStats,
  type BlacklistKeyword
} from './database';
import { getOllamaClient, isModelAvailable } from './ollama-client';

// Embedding model configuration
const EMBEDDING_MODEL = process.env.OLLAMA_MODEL_EMBEDDING || 'hf.co/Mungert/all-MiniLM-L6-v2-GGUF';
const EMBEDDING_DIM = process.env.OLLAMA_EMBEDDING_DIM ? parseInt(process.env.OLLAMA_EMBEDDING_DIM, 10) : 384;

/**
 * Check if the embedding model is available in Ollama
 */
export async function checkEmbeddingModelAvailable(): Promise<boolean> {
  return isModelAvailable(EMBEDDING_MODEL);
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
 * Search for similar jobs using vector similarity (pgvector)
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

  // Use pgvector similarity search
  return searchSimilarJobsPG(queryEmbedding, limit, minSimilarity);
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
  await saveJobEmbedding(jobId, embedding, EMBEDDING_MODEL);
}

/**
 * Convert embedding to pgvector-compatible format
 */
function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Convert pgvector string back to embedding array
 */
function vectorToEmbedding(vectorString: string): number[] {
  return vectorString.slice(1, -1).split(',').map(parseFloat);
}

/**
 * For compatibility - convert Buffer to embedding (not used in PostgreSQL)
 */
export function bufferToEmbedding(buffer: Buffer | string): number[] {
  if (typeof buffer === 'string') {
    return vectorToEmbedding(buffer);
  }
  // SQLite buffer compatibility (shouldn't be used with PostgreSQL)
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i));
  }
  return embedding;
}

/**
 * For compatibility - convert embedding to Buffer (not used in PostgreSQL)
 */
export function embeddingToBuffer(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 4);
  embedding.forEach((val, i) => {
    buffer.writeFloatLE(val, i * 4);
  });
  return buffer;
}

// =============================================================================
// Blacklist Functions
// =============================================================================

export { type BlacklistKeyword };

/**
 * Get all blacklist keywords
 */
export { getBlacklistKeywords };

/**
 * Get blacklist keywords as text (one per line)
 */
export { getBlacklistText };

/**
 * Clear all blacklist keywords
 */
export { clearBlacklist };

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
  await clearBlacklist();

  // Reset all jobs to not blacklisted
  await resetAllJobsBlacklisted();

  // If no keywords, return early
  if (keywords.length === 0) {
    console.log('✓ Blacklist cleared');
    return { count: 0, jobsBlacklisted: 0 };
  }

  // Save keywords immediately WITHOUT embeddings
  console.log(`  → Saving ${keywords.length} keywords to database...`);
  const keywordIds: Array<{ keyword: string; id: number }> = [];
  for (const keyword of keywords) {
    const id = await saveBlacklistKeywordWithoutEmbedding(keyword);
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
 * Update blacklist keyword embedding
 */
export { updateBlacklistKeywordEmbedding };

/**
 * Export embedding statistics
 */
export { getEmbeddingStats };

/**
 * Export hasJobEmbedding
 */
export { hasJobEmbedding };

/**
 * Export getJobEmbedding
 */
export { getJobEmbedding };

/**
 * Export getJobsWithoutEmbeddings
 */
export { getJobsWithoutEmbeddings };

/**
 * Export clearAllEmbeddings
 */
export { clearAllEmbeddings };
