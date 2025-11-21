#!/usr/bin/env tsx
import { enqueueJobExtraction, getJobExtractionQueue } from './src/queue';
import { getDatabase } from './src/database';

async function main() {
  const db = getDatabase();
  const email = db.prepare('SELECT id, gmail_id, subject, body FROM emails WHERE id = 12').get() as any;

  console.log(`Enqueueing test job for email ${email.id}: ${email.subject?.substring(0, 50)}...`);
  await enqueueJobExtraction(email.id, email.gmail_id, email.subject, email.body);

  const queue = getJobExtractionQueue();
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();

  console.log(`Queue status: ${waiting} waiting, ${active} active`);
  console.log('Waiting 5 seconds for processing...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
  console.log(`\nJobs in database: ${jobCount.count}`);

  const recentJobs = db.prepare('SELECT id, title FROM jobs ORDER BY id DESC LIMIT 5').all() as any[];
  if (recentJobs.length > 0) {
    console.log('\nRecent jobs:');
    recentJobs.forEach(job => console.log(`  ${job.id}. ${job.title}`));
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
