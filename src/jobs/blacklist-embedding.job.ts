/**
 * Blacklist Embedding Job Processor
 * Generates embeddings for blacklist keywords and checks jobs against them
 */

import Bull from 'bull';
import {
  type BlacklistEmbeddingJobData,
  type BlacklistEmbeddingJobResult,
} from '../queue';
import {
  generateEmbedding,
  updateBlacklistKeywordEmbedding,
  getJobEmbedding,
  cosineSimilarity,
} from '../embeddings';
import {
  markJobBlacklisted,
  getJobsWithEmbeddings,
} from '../database';
import { logger } from '../logger';
import { publishJobEvent } from '../pubsub';

const MIN_SIMILARITY = parseFloat(process.env.MIN_SIMILARITY || '0.6');

export async function processBlacklistEmbeddingJob(
  job: Bull.Job<BlacklistEmbeddingJobData>
): Promise<BlacklistEmbeddingJobResult> {
  const { keyword, blacklistId } = job.data;

  console.debug(`🔍 Processing blacklist keyword: "${keyword}" (id: ${blacklistId})`);

  try {
    // Generate embedding for the keyword
    console.debug(`  → Generating embedding for "${keyword}"...`);
    let embedding: number[];
    try {
      embedding = await generateEmbedding(keyword);
      console.debug(`  ✓ Embedding generated for "${keyword}"`);
    } catch (error) {
      logger.errorFromException(error, {
        source: 'blacklist-embedding.job',
        context: { keyword, blacklistId, step: 'generate-embedding' }
      });
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Save embedding to database
    try {
      await updateBlacklistKeywordEmbedding(blacklistId, embedding);
      console.debug(`  ✓ Embedding saved for "${keyword}"`);
    } catch (error) {
      logger.errorFromException(error, {
        source: 'blacklist-embedding.job',
        context: { keyword, blacklistId, step: 'save-embedding' }
      });
      throw new Error(`Failed to save embedding: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Get all jobs with embeddings
    let jobsWithEmbeddings: Array<{ id: number; title: string; embedding: string }>;
    try {
      jobsWithEmbeddings = await getJobsWithEmbeddings();

      console.debug(`  → Checking ${jobsWithEmbeddings.length} jobs against "${keyword}"...`);
    } catch (error) {
      logger.errorFromException(error, {
        source: 'blacklist-embedding.job',
        context: { keyword, blacklistId, step: 'fetch-jobs' }
      });
      throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check each job against this blacklist keyword
    let jobsBlacklisted = 0;

    for (const jobRow of jobsWithEmbeddings) {
      try {
        // Parse pgvector string format: "[0.1,0.2,0.3,...]"
        const embeddingString = jobRow.embedding;
        const jobEmbedding = embeddingString.slice(1, -1).split(',').map(parseFloat);
        const similarity = cosineSimilarity(jobEmbedding, embedding);

        if (similarity >= MIN_SIMILARITY) {
          await markJobBlacklisted(jobRow.id, true);
          jobsBlacklisted++;
          console.debug(`    ✗ Job ${jobRow.id} blacklisted: "${jobRow.title}" (similarity: ${similarity.toFixed(2)})`);

          // Broadcast job removal via WebSocket
          await publishJobEvent({
            type: 'job_removed',
            jobId: jobRow.id,
            reason: 'blacklisted',
          });
        }
      } catch (error) {
        logger.errorFromException(error, {
          source: 'blacklist-embedding.job',
          context: { keyword, blacklistId, jobId: jobRow.id, step: 'check-job' }
        });
        // Continue checking other jobs even if one fails
        console.error(`    ✗ Error checking job ${jobRow.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.debug(`  ✓ Blacklist keyword "${keyword}" processed: ${jobsBlacklisted} jobs hidden`);

    return {
      blacklistId,
      keyword,
      success: true,
      jobsBlacklisted,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.errorFromException(error, {
      source: 'blacklist-embedding.job',
      context: { keyword, blacklistId, step: 'overall' }
    });
    console.error(`  ✗ Failed to process blacklist keyword "${keyword}": ${errorMessage}`);

    return {
      blacklistId,
      keyword,
      success: false,
      jobsBlacklisted: 0,
      error: errorMessage,
    };
  }
}
