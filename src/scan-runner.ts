/**
 * Scan runner module - orchestrates email scanning and job extraction
 * Can be called from CLI or API endpoints
 */

import { authorize, testGmailConnection } from './gmail-auth';
import { fetchEmails, fetchEmailBodies, processEmailsWithProgress } from './email-scanner';
import { checkOllamaAvailability, getBestModel, categorizeEmail, type CategorizedEmail } from './email-categorizer';
import { getScannedEmailIds, saveEmail, markEmailAsProcessed, getEmailStats, getDatabase } from './database';
import { enqueueJobExtraction, checkRedisConnection } from './queue';
import { logger } from './logger';

export interface ScanResult {
  success: boolean;
  message: string;
  processed: number;
  jobRelated: number;
  skipped: number;
  jobsEnqueued: number;
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
  onEmailProcessed?: (email: ProcessedEmailEvent) => void;
  onProgress?: (event: ScanProgressEvent) => void;
}

export interface ProcessedEmailEvent {
  id: string;
  subject: string | null;
  from: string | null;
  isJobRelated: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  processedAt: string;
}

export interface ScanProgressEvent {
  type: 'start' | 'fetching' | 'categorizing' | 'enqueuing_jobs' | 'complete';
  total?: number;
  current?: number;
  message: string;
}

/**
 * Run the email scan workflow
 * Returns results instead of using process.exit
 */
export async function runScan(options: ScanOptions = {}): Promise<ScanResult> {
  const { query = 'newer_than:7d', maxResults = 20, onEmailProcessed, onProgress } = options;

  // Helper to emit progress
  const emitProgress = (event: ScanProgressEvent) => {
    if (onProgress) onProgress(event);
  };

  emitProgress({ type: 'start', message: 'Starting email scan...' });

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
  emitProgress({ type: 'fetching', message: 'Fetching emails from Gmail...' });

  const emails = await fetchEmails(auth, {
    query,
    maxResults,
    showProgress: false, // Disable progress bars for API calls
  });

  if (emails.length === 0) {
    const stats = getEmailStats();
    emitProgress({ type: 'complete', message: 'No emails found to process' });
    return {
      success: true,
      message: 'No emails found to process',
      processed: 0,
      jobRelated: 0,
      skipped: 0,
      jobsEnqueued: 0,
      stats,
    };
  }

  // Filter out already scanned emails
  const scannedIds = getScannedEmailIds();
  const newEmails = emails.filter(email => !scannedIds.includes(email.id));
  const skipped = emails.length - newEmails.length;

  if (newEmails.length === 0) {
    const stats = getEmailStats();
    emitProgress({ type: 'complete', message: 'All emails have already been scanned' });
    return {
      success: true,
      message: 'All emails have already been scanned',
      processed: 0,
      jobRelated: 0,
      skipped,
      jobsEnqueued: 0,
      stats,
    };
  }

  // Fetch email bodies
  emitProgress({ type: 'fetching', message: `Fetching ${newEmails.length} email bodies...` });
  const emailIds = newEmails.map(e => e.id);
  const bodies = await fetchEmailBodies(auth, emailIds, false); // Disable progress bars

  // Categorize and save emails
  emitProgress({
    type: 'categorizing',
    total: newEmails.length,
    current: 0,
    message: `Categorizing ${newEmails.length} emails...`
  });

  let processedCount = 0;
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

      // Emit event for this processed email
      processedCount++;
      if (onEmailProcessed) {
        onEmailProcessed({
          id: email.id,
          subject: email.subject || null,
          from: email.from || null,
          isJobRelated: category.isJobRelated,
          confidence: category.confidence,
          reason: category.reason,
          processedAt: new Date().toISOString(),
        });
      }

      emitProgress({
        type: 'categorizing',
        total: newEmails.length,
        current: processedCount,
        message: `Categorized ${processedCount}/${newEmails.length} emails`
      });

      return categorizedEmail;
    },
    { title: 'Categorizing & Saving Emails', showProgress: false }
  );

  // Calculate results
  const jobRelatedCount = categorizedEmails.filter(e => e.category.isJobRelated).length;

  // Enqueue job extraction for job-related emails
  let jobsEnqueued = 0;
  const jobRelatedEmails = categorizedEmails.filter(e => e.category.isJobRelated);

  if (jobRelatedEmails.length > 0) {
    // Check if Redis is available
    const redisAvailable = await checkRedisConnection();

    if (!redisAvailable) {
      logger.warning('Redis not available - job extraction will not be queued. Start Redis with: docker-compose up -d', { source: 'scan-runner' });
      console.warn('⚠ Redis not available - job extraction will not be queued');
      console.warn('  Start Redis with: docker-compose up -d');
    } else {
      emitProgress({
        type: 'enqueuing_jobs',
        total: jobRelatedEmails.length,
        current: 0,
        message: `Enqueuing ${jobRelatedEmails.length} job extraction jobs...`
      });

      // Enqueue job extraction for each job-related email
      const db = getDatabase();
      for (let i = 0; i < jobRelatedEmails.length; i++) {
        const email = jobRelatedEmails[i];
        const body = bodies.get(email.id) || '';

        try {
          // Get email database ID
          const savedEmail = db.prepare('SELECT id FROM emails WHERE gmail_id = ?').get(email.id) as { id: number } | undefined;

          if (!savedEmail) {
            logger.error(`Email ${email.id} not found in database`, { source: 'scan-runner', context: { gmailId: email.id } });
            console.error(`Email ${email.id} not found in database`);
            continue;
          }

          await enqueueJobExtraction(
            savedEmail.id,
            email.id,
            email.subject || 'No subject',
            body
          );
          jobsEnqueued++;

          emitProgress({
            type: 'enqueuing_jobs',
            total: jobRelatedEmails.length,
            current: i + 1,
            message: `Enqueued ${i + 1}/${jobRelatedEmails.length} job extraction jobs`
          });
        } catch (error) {
          logger.errorFromException(error, { source: 'scan-runner', context: { gmailId: email.id, subject: email.subject } });
          console.error(`Failed to enqueue job extraction for email ${email.id}:`, error);
        }
      }
    }
  }

  const stats = getEmailStats();

  emitProgress({
    type: 'complete',
    message: `Processed ${categorizedEmails.length} emails, ${jobRelatedCount} job-related, ${jobsEnqueued} jobs enqueued`
  });

  return {
    success: true,
    message: `Processed ${categorizedEmails.length} emails, ${jobRelatedCount} job-related`,
    processed: categorizedEmails.length,
    jobRelated: jobRelatedCount,
    skipped,
    jobsEnqueued,
    stats,
  };
}
