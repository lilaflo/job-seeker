/**
 * Scan runner module - orchestrates email scanning and job extraction
 * Can be called from CLI or API endpoints
 */

import { authorize, testGmailConnection } from './gmail-auth';
import { fetchEmails, fetchEmailBodies, processEmailsWithProgress } from './email-scanner';
import { checkOllamaAvailability, getBestModel, categorizeEmail, type CategorizedEmail } from './email-categorizer';
import { getScannedEmailIds, saveEmail, markEmailAsProcessed, getEmailStats } from './database';

export interface ScanResult {
  success: boolean;
  message: string;
  processed: number;
  jobRelated: number;
  skipped: number;
  stats: {
    total: number;
    jobRelated: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
}

export interface ScanOptions {
  query?: string;
  maxResults?: number;
}

/**
 * Run the email scan workflow
 * Returns results instead of using process.exit
 */
export async function runScan(options: ScanOptions = {}): Promise<ScanResult> {
  const { query = 'newer_than:7d', maxResults = 20 } = options;

  // Authorize with Gmail
  const auth = await authorize();
  await testGmailConnection(auth);

  // Check Ollama availability
  const ollamaAvailable = await checkOllamaAvailability();

  if (!ollamaAvailable) {
    throw new Error('Ollama is not available. Please ensure Ollama is running with: ollama serve');
  }

  const model = await getBestModel();

  // Fetch emails
  const emails = await fetchEmails(auth, {
    query,
    maxResults,
    showProgress: false, // Disable progress bars for API calls
  });

  if (emails.length === 0) {
    const stats = getEmailStats();
    return {
      success: true,
      message: 'No emails found to process',
      processed: 0,
      jobRelated: 0,
      skipped: 0,
      stats,
    };
  }

  // Filter out already scanned emails
  const scannedIds = getScannedEmailIds();
  const newEmails = emails.filter(email => !scannedIds.includes(email.id));
  const skipped = emails.length - newEmails.length;

  if (newEmails.length === 0) {
    const stats = getEmailStats();
    return {
      success: true,
      message: 'All emails have already been scanned',
      processed: 0,
      jobRelated: 0,
      skipped,
      stats,
    };
  }

  // Fetch email bodies
  const emailIds = newEmails.map(e => e.id);
  const bodies = await fetchEmailBodies(auth, emailIds, false); // Disable progress bars

  // Categorize and save emails
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
      saveEmail(categorizedEmail, category, body);

      // Mark email as processed to prevent reprocessing
      markEmailAsProcessed(categorizedEmail.id);

      return categorizedEmail;
    },
    { title: 'Categorizing & Saving Emails', showProgress: false }
  );

  // Calculate results
  const jobRelatedCount = categorizedEmails.filter(e => e.category.isJobRelated).length;
  const stats = getEmailStats();

  return {
    success: true,
    message: `Processed ${categorizedEmails.length} emails, ${jobRelatedCount} job-related`,
    processed: categorizedEmails.length,
    jobRelated: jobRelatedCount,
    skipped,
    stats,
  };
}
