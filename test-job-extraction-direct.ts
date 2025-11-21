#!/usr/bin/env tsx
import { getDatabase } from './src/database';
import { processJobExtractionJob } from './src/jobs/job-extraction.job';

async function main() {
  const db = getDatabase();

  // Get email 48 which has 6 job URLs
  const email = db.prepare('SELECT id, gmail_id, subject, body FROM emails WHERE id = 48').get() as any;

  console.log(`Testing job extraction for email ${email.id}: ${email.subject}\n`);

  const jobsBefore = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
  console.log(`Jobs before: ${jobsBefore.count}\n`);

  // Create a mock Bull job object
  const mockJob = {
    data: {
      emailId: email.id,
      gmailId: email.gmail_id,
      subject: email.subject,
      body: email.body
    },
    id: 'test-job-1'
  } as any;

  console.log('Calling processJobExtractionJob()...\n');

  try {
    const result = await processJobExtractionJob(mockJob);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }

  const jobsAfter = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
  console.log(`\nJobs after: ${jobsAfter.count}`);

  if (jobsAfter.count > jobsBefore.count) {
    console.log(`✓ SUCCESS: ${jobsAfter.count - jobsBefore.count} jobs created`);
    const jobs = db.prepare('SELECT id, title FROM jobs ORDER BY id DESC LIMIT 10').all() as any[];
    jobs.forEach(job => console.log(`  ${job.id}. ${job.title}`));
  } else {
    console.log('✗ FAILED: No jobs created');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
