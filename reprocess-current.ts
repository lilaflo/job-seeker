#!/usr/bin/env tsx
import { getDatabase } from './src/database';
import { enqueueJobExtraction } from './src/queue';

async function main() {
  const db = getDatabase();

  // Get job-related emails that have bodies
  const emails = db.prepare(`
    SELECT id, gmail_id, subject, body
    FROM emails
    WHERE is_job_related = 1
      AND body IS NOT NULL
      AND processed = 1
    ORDER BY id DESC
    LIMIT 5
  `).all() as Array<{id: number; gmail_id: string; subject: string; body: string}>;

  console.log(`Found ${emails.length} job-related emails\n`);

  // Show current job count
  const jobsBefore = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
  console.log(`Jobs in DB before: ${jobsBefore.count}\n`);

  // Enqueue each email
  for (const email of emails) {
    console.log(`Enqueueing email ${email.id}: ${email.subject.substring(0, 50)}...`);
    await enqueueJobExtraction(email.id, email.gmail_id, email.subject, email.body);
  }

  console.log(`\n✓ Enqueued ${emails.length} job extraction jobs`);
  console.log('Waiting 10 seconds for processing...\n');

  await new Promise(resolve => setTimeout(resolve, 10000));

  const jobsAfter = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
  console.log(`Jobs in DB after: ${jobsAfter.count}`);

  if (jobsAfter.count > jobsBefore.count) {
    console.log(`\n✓ SUCCESS: ${jobsAfter.count - jobsBefore.count} jobs were created!`);

    const recentJobs = db.prepare('SELECT id, title FROM jobs ORDER BY id DESC LIMIT 5').all() as any[];
    console.log('\nRecent jobs:');
    recentJobs.forEach(job => console.log(`  ${job.id}. ${job.title}`));
  } else {
    console.log('\n✗ FAILED: No jobs were created');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
