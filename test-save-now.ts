#!/usr/bin/env tsx
import { getDatabase, saveJob } from './src/database';

console.log('Testing saveJob() RIGHT NOW...\n');

const db = getDatabase();
const before = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
console.log(`Jobs before: ${before.count}`);

console.log('\nSaving test job...');
saveJob(
  'Real-time Test Job',
  `https://test.com/job/${Date.now()}`,
  undefined,
  { min: 50000, max: 80000, currency: 'CHF', period: 'yearly' },
  'Test job description to verify saveJob() is working'
);

const after = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
console.log(`Jobs after: ${after.count}`);

if (after.count > before.count) {
  console.log('\n✓ SUCCESS: Job was saved!');

  const latest = db.prepare('SELECT id, title, salary_min FROM jobs ORDER BY id DESC LIMIT 1').get() as any;
  console.log(`Latest job: ID=${latest.id}, Title="${latest.title}", Salary=${latest.salary_min}`);
} else {
  console.log('\n✗ FAILED: Job was NOT saved!');
}
