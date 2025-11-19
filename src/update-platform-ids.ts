#!/usr/bin/env node
/**
 * Utility script to update platform_id for existing emails with NULL platform_id
 * Uses the from_address column to extract platform information
 */

import { getPlatformIdFromEmail } from './database';
import Database from 'better-sqlite3';
import path from 'path';

async function updatePlatformIds() {
  console.log('Starting platform_id update for existing emails...\n');

  // Get emails with NULL platform_id
  const db = new Database(path.join(process.cwd(), 'job-seeker.db'));
  const emailsToUpdate = db
    .prepare('SELECT id, gmail_id, subject, from_address FROM emails WHERE platform_id IS NULL')
    .all() as Array<{ id: number; gmail_id: string; subject: string | null; from_address: string | null }>;

  console.log(`Found ${emailsToUpdate.length} emails with NULL platform_id\n`);

  if (emailsToUpdate.length === 0) {
    console.log('No emails to update!');
    db.close();
    return;
  }

  let updated = 0;
  let noFromAddress = 0;
  let noMatchingPlatform = 0;

  for (const email of emailsToUpdate) {
    if (!email.from_address) {
      console.log(`✗ No from_address stored for email ${email.id}: "${email.subject?.substring(0, 50)}..."`);
      noFromAddress++;
      continue;
    }

    // Extract platform ID from email address
    const platformId = getPlatformIdFromEmail(email.from_address);

    if (platformId) {
      // Update database
      db.prepare('UPDATE emails SET platform_id = ? WHERE id = ?').run(platformId, email.id);

      // Get platform name for display
      const platform = db.prepare('SELECT platform_name FROM platforms WHERE id = ?').get(platformId) as { platform_name: string } | undefined;

      console.log(`✓ Updated email ${email.id}: "${email.subject?.substring(0, 50)}..." → ${platform?.platform_name || `Platform ID ${platformId}`}`);
      console.log(`  From: ${email.from_address}`);
      updated++;
    } else {
      console.log(`✗ No matching platform for: ${email.from_address}`);
      console.log(`  Subject: "${email.subject?.substring(0, 50)}..."`);
      noMatchingPlatform++;
    }
  }

  db.close();

  console.log(`\n✅ Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   No from_address: ${noFromAddress}`);
  console.log(`   No matching platform: ${noMatchingPlatform}`);
}

// Run the script
updatePlatformIds().catch(console.error);
