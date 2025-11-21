#!/usr/bin/env node
/**
 * Queue Pending Work - Enqueues all pending jobs and blacklist keywords
 * Run with: pnpm exec tsx src/queue-pending-work.ts
 */

import { query } from './database';
import { enqueueJobProcessing, enqueueBlacklistEmbeddings, checkRedisConnection } from './queue';

async function main() {
  console.log('\n=== Queue Pending Work ===\n');

  // Check Redis connection
  console.log('Checking Redis connection...');
  const redisAvailable = await checkRedisConnection();
  if (!redisAvailable) {
    console.error('✗ Redis not available - cannot queue jobs');
    console.error('  Please start Redis first');
    process.exit(1);
  }
  console.log('✓ Redis is available\n');

  // 1. Queue blacklist keywords without embeddings
  console.log('1. Checking blacklist keywords...');
  const blacklistResult = await query<{ id: number; keyword: string }>(`
    SELECT id, keyword FROM blacklist WHERE embedding IS NULL
  `);
  const blacklistKeywords = blacklistResult.rows;

  if (blacklistKeywords.length > 0) {
    console.log(`   Found ${blacklistKeywords.length} keywords without embeddings`);
    console.log('   Queueing blacklist embedding jobs...');
    await enqueueBlacklistEmbeddings(blacklistKeywords);
    console.log(`   ✓ Queued ${blacklistKeywords.length} blacklist embedding jobs\n`);
  } else {
    console.log('   ✓ All blacklist keywords have embeddings\n');
  }

  // 2. Queue pending jobs
  console.log('2. Checking pending jobs...');
  const pendingResult = await query<{ id: number; title: string; link: string; email_id: number | null }>(`
    SELECT id, title, link, email_id FROM jobs WHERE processing_status = 'pending'
  `);
  const pendingJobs = pendingResult.rows;

  if (pendingJobs.length > 0) {
    console.log(`   Found ${pendingJobs.length} pending jobs`);
    console.log('   Queueing job processing jobs...');
    let queued = 0;
    for (const job of pendingJobs) {
      await enqueueJobProcessing(job.id, job.title, job.link, job.email_id);
      queued++;
    }
    console.log(`   ✓ Queued ${queued} job processing jobs\n`);
  } else {
    console.log('   ✓ No pending jobs\n');
  }

  // 3. Check for jobs without embeddings (completed jobs that somehow lost their embeddings)
  console.log('3. Checking jobs without embeddings...');
  const embeddingResult = await query<{ id: number; title: string }>(`
    SELECT id, title
    FROM jobs
    WHERE embedding IS NULL AND processing_status = 'completed'
  `);
  const jobsWithoutEmbeddings = embeddingResult.rows;

  if (jobsWithoutEmbeddings.length > 0) {
    console.log(`   ⚠ Found ${jobsWithoutEmbeddings.length} completed jobs without embeddings`);
    console.log('   These jobs may need to be reprocessed\n');
  } else {
    console.log('   ✓ All completed jobs have embeddings\n');
  }

  console.log('=== Summary ===');
  console.log(`Blacklist embeddings queued: ${blacklistKeywords.length}`);
  console.log(`Job processing queued: ${pendingJobs.length}`);
  console.log(`\n✓ Done! The worker will process these jobs in the background.\n`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
