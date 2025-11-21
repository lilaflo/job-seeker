import { authorize, testGmailConnection } from './gmail-auth';
import { fetchEmails, fetchEmailBodies, processEmailsWithProgress } from './email-scanner';
import { checkOllamaAvailability, getBestModel, categorizeEmail, formatEmailForDisplay, type CategorizedEmail } from './email-categorizer';
import { getScannedEmailIds, saveEmail, markEmailAsProcessed, getEmailStats, closeDatabase } from './database';
import { logger } from './logger';

async function main() {
  try {
    const auth = await authorize();
    await testGmailConnection(auth);

    // Check Ollama availability
    const ollamaAvailable = await checkOllamaAvailability();

    if (!ollamaAvailable) {
      logger.error('Ollama is not available', { source: 'index' });
      console.error('\n✗ Ollama is not available. Please ensure Ollama is running.');
      console.error('Run: ollama serve');
      process.exit(1);
    }

    const model = await getBestModel();

    // Fetch emails from the last 7 days
    const emails = await fetchEmails(auth, {
      query: 'newer_than:7d',
      maxResults: 20,
      showProgress: true,
    });

    if (emails.length === 0) {
      console.log('\n✓ No emails found to process.');
      return;
    }

    // Filter out already scanned emails
    const scannedIds = await getScannedEmailIds();
    const newEmails = emails.filter(email => !scannedIds.includes(email.id));

    if (newEmails.length === 0) {
      console.log('\n✓ All emails have already been scanned.');
      console.log(`Total emails in database: ${scannedIds.length}`);
      return;
    }

    console.log(`\nSkipped ${emails.length - newEmails.length} already scanned emails.`);
    console.log(`Processing ${newEmails.length} new emails...`);

    // Fetch email bodies
    const emailIds = newEmails.map(e => e.id);
    const bodies = await fetchEmailBodies(auth, emailIds, true);

    // Categorize and save emails row-by-row with progress bar
    const categorizedEmails = await processEmailsWithProgress<CategorizedEmail>(
      newEmails,
      async (email) => {
        const body = bodies.get(email.id);
        const category = await categorizeEmail(email, body, model);

        const categorizedEmail = {
          ...email,
          body,
          category,
        };

        // Persist to database immediately after categorization
        await saveEmail(categorizedEmail, category, body);

        // Mark email as processed to prevent reprocessing
        await markEmailAsProcessed(categorizedEmail.id);

        return categorizedEmail;
      },
      { title: 'Categorizing & Saving Emails', showProgress: true }
    );

    // Display results with checkmarks
    console.log('\n--- Categorization Results ---\n');
    categorizedEmails.forEach((email, index) => {
      console.log(formatEmailForDisplay(email, index));
      if (email.category.isJobRelated) {
        console.log(`   → ${email.category.reason}`);
      }
    });

    // Summary
    const jobRelatedCount = categorizedEmails.filter(e => e.category.isJobRelated).length;
    const stats = await getEmailStats();

    console.log(`\n--- Summary ---`);
    console.log(`Processed this run: ${categorizedEmails.length}`);
    console.log(`Job-related this run: ${jobRelatedCount}`);
    console.log(`\n--- Database Statistics ---`);
    console.log(`Total emails in database: ${stats.total}`);
    console.log(`Job-related emails: ${stats.jobRelated}`);
    console.log(`High confidence: ${stats.highConfidence}`);
    console.log(`Medium confidence: ${stats.mediumConfidence}`);
    console.log(`Low confidence: ${stats.lowConfidence}`);

    console.log('\n✓ Email scanning complete!');

    // Close database connection
    closeDatabase();
  } catch (error) {
    logger.errorFromException(error, { source: 'index' });
    console.error('\n✗ Error:', error instanceof Error ? error.message : String(error));
    closeDatabase();
    process.exit(1);
  }
}

main();
