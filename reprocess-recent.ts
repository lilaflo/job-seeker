#!/usr/bin/env tsx
/**
 * Reprocess recent job-related emails through job extraction queue
 * For emails scanned via CLI that didn't get enqueued
 */

import { getDatabase } from './src/database';
import { enqueueJobExtraction, checkRedisConnection } from './src/queue';
import { logger } from './src/logger';

async function main() {
  // Check Redis connection first
  const redisAvailable = await checkRedisConnection();
  if (!redisAvailable) {
    console.error('✗ Redis is not available. Please start Redis with: docker-compose up -d');
    process.exit(1);
  }

  const db = getDatabase();

  // Get all job-related emails from the most recent scan
  const emails = db.prepare(`
    SELECT id, gmail_id, subject, body, scanned_at
    FROM emails
    WHERE is_job_related = 1
      AND scanned_at >= '2025-11-20 11:48:00'
      AND scanned_at <= '2025-11-20 11:50:00'
    ORDER BY id ASC
  `).all() as Array<{id: number; gmail_id: string; subject: string; body: string | null; scanned_at: string}>;

  console.log(`Found ${emails.length} job-related emails from recent scan\n`);

  if (emails.length === 0) {
    console.log('No emails to reprocess');
    return;
  }

  let enqueued = 0;
  let skipped = 0;

  for (const email of emails) {
    if (!email.body) {
      console.log(`  ⊘ Skipped email ${email.id} (no body): ${email.subject?.substring(0, 50)}...`);
      skipped++;
      continue;
    }

    try {
      await enqueueJobExtraction(email.id, email.gmail_id, email.subject, email.body);
      enqueued++;
      console.log(`  ✓ Enqueued email ${email.id}: ${email.subject?.substring(0, 50)}...`);
    } catch (error) {
      logger.errorFromException(error, { source: 'reprocess-recent', context: { emailId: email.id, gmailId: email.gmail_id } });
      console.error(`  ✗ Failed to enqueue email ${email.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total emails: ${emails.length}`);
  console.log(`Enqueued: ${enqueued}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`\n✓ Job extraction jobs enqueued. Worker will process them shortly.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
