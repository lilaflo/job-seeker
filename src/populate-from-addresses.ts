#!/usr/bin/env node
/**
 * One-time utility script to populate from_address for existing emails
 * Fetches email metadata from Gmail and stores the From address
 */

import { google } from 'googleapis';
import { authorize } from './gmail-auth';
import Database from 'better-sqlite3';
import path from 'path';
import { logger } from './logger';

async function populateFromAddresses() {
  console.log('Starting from_address population for existing emails...\n');

  // Get authenticated Gmail client
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  // Get emails without from_address
  const db = new Database(path.join(process.cwd(), 'job-seeker.db'));
  const emailsToUpdate = db
    .prepare('SELECT id, gmail_id, subject FROM emails WHERE from_address IS NULL')
    .all() as Array<{ id: number; gmail_id: string; subject: string | null }>;

  console.log(`Found ${emailsToUpdate.length} emails without from_address\n`);

  if (emailsToUpdate.length === 0) {
    console.log('No emails to update!');
    db.close();
    return;
  }

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const email of emailsToUpdate) {
    try {
      // Fetch email metadata from Gmail
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: email.gmail_id,
        format: 'metadata',
        metadataHeaders: ['From'],
      });

      const headers = response.data.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from');
      const fromAddress = fromHeader?.value || null;

      if (fromAddress) {
        // Update database
        db.prepare('UPDATE emails SET from_address = ? WHERE id = ?').run(fromAddress, email.id);

        console.log(`✓ Updated email ${email.id}: "${email.subject?.substring(0, 40)}..."`);
        console.log(`  From: ${fromAddress}`);
        updated++;
      } else {
        console.log(`✗ No From header in email ${email.id}`);
        errors++;
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`✗ Email not found in Gmail: ${email.gmail_id} (may have been deleted)`);
        notFound++;
      } else {
        logger.error(`Error processing email ${email.gmail_id}: ${error.message}`, { source: 'populate-from-addresses', context: { gmailId: email.gmail_id, emailId: email.id } });
        console.error(`✗ Error processing email ${email.gmail_id}:`, error.message);
        errors++;
      }
    }
  }

  db.close();

  console.log(`\n✅ Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Errors: ${errors}`);
}

// Run the script
populateFromAddresses().catch((error) => {
  logger.errorFromException(error, { source: 'populate-from-addresses' });
  console.error(error);
});
