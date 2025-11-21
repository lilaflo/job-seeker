/**
 * Embedding Generation Job Processor
 * Generates embeddings for job postings and checks against blacklist
 */

import Bull from 'bull';
import {
  type EmbeddingJobData,
  type EmbeddingJobResult,
} from '../queue';
import {
  generateAndSaveJobEmbedding,
  getBlacklistKeywords,
  bufferToEmbedding,
  cosineSimilarity,
  getJobEmbedding,
} from '../embeddings';
import { markJobBlacklisted } from '../database';
import { logger } from '../logger';

const minSimilarity = 0.7;

export async function processEmbeddingJob(
  job: Bull.Job<EmbeddingJobData>
): Promise<EmbeddingJobResult> {
  const { jobId, title, description } = job.data;

  // Fetch blacklist embeddings (async)
  const blacklistKeywords = await getBlacklistKeywords();
  const blacklistEmbeddings = blacklistKeywords
    .filter(k => k.embedding)
    .map(k => {
      // Parse pgvector string format
      const embString = k.embedding!;
      return embString.slice(1, -1).split(',').map(parseFloat);
    });

  console.debug(`Processing job ${jobId}: ${title.substring(0, 50)}...`);

  try {
    // Generate embedding
    await generateAndSaveJobEmbedding(jobId, title, description);

    // Check against blacklist
    let isBlacklisted = false;
    if (blacklistEmbeddings.length > 0) {
      const jobEmbedding = getJobEmbedding(jobId);

      if (jobEmbedding) {
        for (const blacklistEmb of blacklistEmbeddings) {
          const similarity = cosineSimilarity(jobEmbedding, blacklistEmb);
          if (similarity >= minSimilarity) {
            markJobBlacklisted(jobId, true);
            isBlacklisted = true;
            break;
          }
        }
      }
    }

    console.debug(`  ✓ Job ${jobId} completed${isBlacklisted ? ' (blacklisted)' : ''}`);

    return {
      jobId,
      success: true,
      blacklisted: isBlacklisted,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.errorFromException(error, { source: 'embedding.job', context: { jobId, title } });
    console.error(`  ✗ Job ${jobId} failed: ${errorMessage}`);
    throw error; // Re-throw to trigger Bull's retry mechanism
  }
}
