#!/usr/bin/env node
/**
 * Queue Worker - Processes embedding generation jobs from Redis queue using Bull
 * Run with: pnpm worker
 */

import Bull from 'bull';
import { getEmbeddingQueue, type EmbeddingJobData, type EmbeddingJobResult } from './queue';
import {
  generateAndSaveJobEmbedding,
  getBlacklistKeywords,
  bufferToEmbedding,
  cosineSimilarity,
  getJobEmbedding,
  checkEmbeddingModelAvailable,
} from './embeddings';
import { markJobBlacklisted, closeDatabase } from './database';

// Configuration
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

async function main() {
  console.log('\n=== Job Seeker Queue Worker (Bull) ===\n');
  console.log(`Concurrency: ${CONCURRENCY}`);

  // Check if embedding model is available
  console.log('Checking embedding model availability...');
  const modelAvailable = await checkEmbeddingModelAvailable();
  if (!modelAvailable) {
    console.error('✗ Embedding model "nomic-embed-text" is not available in Ollama.');
    console.error('  Install it with: ollama pull nomic-embed-text');
    process.exit(1);
  }
  console.log('✓ Embedding model is available');

  console.log('Connecting to Redis...\n');

  // Get queue
  const queue = getEmbeddingQueue();

  // Wait for queue to be ready
  await queue.isReady();
  console.log('Connected to Redis');

  // Pre-fetch blacklist embeddings for fast comparison
  const blacklistKeywords = getBlacklistKeywords();
  const blacklistEmbeddings = blacklistKeywords
    .filter(k => k.embedding)
    .map(k => bufferToEmbedding(k.embedding!));
  const minSimilarity = 0.7;

  console.log(`Loaded ${blacklistEmbeddings.length} blacklist embeddings`);
  console.log('Waiting for jobs...\n');

  // Track statistics
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let blacklisted = 0;

  // Process jobs
  queue.process(CONCURRENCY, async (job: Bull.Job<EmbeddingJobData>): Promise<EmbeddingJobResult> => {
    const { jobId, title, description } = job.data;

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
              blacklisted++;
              break;
            }
          }
        }
      }

      processed++;
      succeeded++;

      console.debug(`  ✓ Job ${jobId} completed${isBlacklisted ? ' (blacklisted)' : ''}`);

      return {
        jobId,
        success: true,
        blacklisted: isBlacklisted,
      };
    } catch (error) {
      processed++;
      failed++;

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Job ${jobId} failed: ${errorMessage}`);

      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  });

  // Handle queue events
  queue.on('completed', (job, result: EmbeddingJobResult) => {
    console.debug(`Job ${job.id} completed: ${result.success ? 'success' : 'failed'}`);
  });

  queue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
  });

  queue.on('stalled', (job) => {
    console.warn(`Job ${job.id} stalled`);
  });

  queue.on('progress', (job, progress) => {
    console.debug(`Job ${job.id} progress: ${progress}%`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down worker...');

    await queue.close();
    closeDatabase();

    console.log('\n--- Worker Statistics ---');
    console.log(`Total processed: ${processed}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Blacklisted: ${blacklisted}`);

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process running
  console.log('Worker is running. Press Ctrl+C to stop.\n');
}

main().catch((error) => {
  console.error('Worker error:', error);
  closeDatabase();
  process.exit(1);
});
