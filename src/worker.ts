#!/usr/bin/env node
/**
 * Queue Worker - Processes embedding generation jobs from Redis queue using Bull
 * Run with: pnpm worker
 */

import Bull from 'bull';
import {
  getEmbeddingQueue,
  getEmailScanQueue,
  getJobExtractionQueue,
  getJobProcessingQueue,
  type EmbeddingJobData,
  type EmailScanJobData,
  type JobExtractionJobData,
  type JobProcessingJobData,
} from './queue';
import { checkEmbeddingModelAvailable } from './embeddings';
import { closeDatabase } from './database';
import { checkOllamaAvailability, getBestModel } from './email-categorizer';
import { processEmbeddingJob } from './jobs/embedding.job';
import { processEmailScanJob } from './jobs/email-scan.job';
import { processJobExtractionJob } from './jobs/job-extraction.job';
import { processJobProcessingJob, setOllamaModel } from './jobs/job-processing.job';

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

  // Get email scan queue
  const emailScanQueue = getEmailScanQueue();
  await emailScanQueue.isReady();
  console.log('Email scan queue ready');

  // Get job extraction queue
  const jobExtractionQueue = getJobExtractionQueue();
  await jobExtractionQueue.isReady();
  console.log('Job extraction queue ready');

  // Get job processing queue
  const jobProcessingQueue = getJobProcessingQueue();
  await jobProcessingQueue.isReady();
  console.log('Job processing queue ready');

  // Get Ollama model for summarization
  const ollamaAvailable = await checkOllamaAvailability();
  if (ollamaAvailable) {
    const ollamaModel = await getBestModel();
    console.log(`Using Ollama model: ${ollamaModel}`);
    setOllamaModel(ollamaModel);
  } else {
    console.warn('Ollama not available - job descriptions will not be summarized');
    setOllamaModel(null);
  }

  console.log('Waiting for jobs...\n');

  // Track statistics
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let blacklisted = 0;
  let emailScansProcessed = 0;
  let jobsExtracted = 0;
  let jobsProcessed = 0;

  // Process embedding jobs
  queue.process(CONCURRENCY, async (job: Bull.Job<EmbeddingJobData>) => {
    const result = await processEmbeddingJob(job);

    processed++;
    if (result.success) {
      succeeded++;
      if (result.blacklisted) {
        blacklisted++;
      }
    } else {
      failed++;
    }

    return result;
  });

  // Handle queue events
  queue.on('completed', (job, result) => {
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

  // Process email scan jobs (only one at a time)
  emailScanQueue.process(1, async (job: Bull.Job<EmailScanJobData>) => {
    const result = await processEmailScanJob(job);

    if (result.success) {
      emailScansProcessed++;
    }

    return result;
  });

  // Handle email scan queue events
  emailScanQueue.on('completed', (job, result) => {
    console.debug(`Email scan job ${job.id} completed: ${result.success ? 'success' : 'failed'}`);
  });

  emailScanQueue.on('failed', (job, err) => {
    console.error(`Email scan job ${job.id} failed:`, err.message);
  });

  // Process job extraction jobs
  jobExtractionQueue.process(CONCURRENCY, async (job: Bull.Job<JobExtractionJobData>) => {
    const result = await processJobExtractionJob(job);

    if (result.success) {
      jobsExtracted += result.jobsExtracted;
    }

    return result;
  });

  // Process job processing jobs (fetch description, generate embedding)
  jobProcessingQueue.process(CONCURRENCY, async (job: Bull.Job<JobProcessingJobData>) => {
    const result = await processJobProcessingJob(job);

    if (result.success) {
      jobsProcessed++;
      if (result.blacklisted) {
        blacklisted++;
      }
    }

    return result;
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down worker...');

    await queue.close();
    await emailScanQueue.close();
    await jobExtractionQueue.close();
    await jobProcessingQueue.close();
    closeDatabase();

    console.log('\n--- Worker Statistics ---');
    console.log(`Email scans processed: ${emailScansProcessed}`);
    console.log(`Jobs extracted: ${jobsExtracted}`);
    console.log(`Jobs processed: ${jobsProcessed}`);
    console.log(`Embeddings generated: ${processed}`);
    console.log(`Embeddings succeeded: ${succeeded}`);
    console.log(`Embeddings failed: ${failed}`);
    console.log(`Jobs blacklisted: ${blacklisted}`);

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
