/**
 * Scan runner module - orchestrates email scanning and job extraction
 * Can be called from CLI or API endpoints
 */

import { authorize, testGmailConnection } from './gmail-auth';
import { fetchEmails, fetchEmailBodies, processEmailsWithProgress } from './email-scanner';
import { checkOllamaAvailability, getBestModel, categorizeEmail, type CategorizedEmail } from './email-categorizer';
import { getScannedEmailIds, saveEmail, markEmailAsProcessed, getEmailStats, getEmailByGmailId, saveJobAsync, isJobScanned } from './database';
import { enqueueJobExtraction, enqueueJobProcessing, checkRedisConnection } from './queue';
import { logger } from './logger';
import { extractJobUrls, deduplicateUrls, extractJobTitle, extractJobsWithTitles } from './url-extractor';

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
    const stats = await getEmailStats();
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
  const scannedIds = await getScannedEmailIds();
  const newEmails = emails.filter(email => !scannedIds.includes(email.id));
  const skipped = emails.length - newEmails.length;

  if (newEmails.length === 0) {
    const stats = await getEmailStats();
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
      await saveEmail(
        email.id,
        email.subject || null,
        email.from || null,
        body,
        category.confidence,
        category.isJobRelated,
        category.reason
      );

      // Mark email as processed to prevent reprocessing
      await markEmailAsProcessed(categorizedEmail.id);

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

  // Create placeholder jobs immediately for job-related emails (for debugging)
  let jobsCreated = 0;
  const jobRelatedEmails = categorizedEmails.filter(e => e.category.isJobRelated);

  if (jobRelatedEmails.length > 0) {
    emitProgress({
      type: 'enqueuing_jobs',
      total: jobRelatedEmails.length,
      current: 0,
      message: `Creating ${jobRelatedEmails.length} placeholder jobs...`
    });

    for (let i = 0; i < jobRelatedEmails.length; i++) {
      const email = jobRelatedEmails[i];
      const body = bodies.get(email.id) || '';

      try {
        // Get email database ID
        const savedEmail = await getEmailByGmailId(email.id);

        if (!savedEmail) {
          logger.error(`Email ${email.id} not found in database`, { source: 'scan-runner', context: { gmailId: email.id } });
          console.error(`Email ${email.id} not found in database`);
          continue;
        }

        // Extract job titles and URLs from email body
        const jobsWithTitles = extractJobsWithTitles(body);

        // Fallback to old method if no jobs found with titles
        if (jobsWithTitles.length === 0) {
          console.debug(`  → No jobs with titles found, trying URL extraction...`);
          const jobUrls = extractJobUrls(body);

          if (jobUrls.length === 0) {
            console.debug(`  → No job URLs found in email ${savedEmail.id}`);
            continue;
          }

          const uniqueUrls = deduplicateUrls(jobUrls);
          const baseTitle = extractJobTitle(email.subject || 'No subject', body);

          for (let j = 0; j < uniqueUrls.length; j++) {
            const url = uniqueUrls[j];
            if (await isJobScanned(url)) {
              console.debug(`  → Job already exists, skipping: ${url}`);
              continue;
            }

            // Try AI extraction for individual job titles
            let title = '';
            try {
              const { extractJobTitleWithAI } = await import('./ai-title-extractor');
              const aiTitle = await extractJobTitleWithAI(body, url, model);
              if (aiTitle) {
                title = aiTitle;
                console.debug(`  → Using AI-extracted title: ${title}`);
              }
            } catch (error) {
              console.error(`  ✗ AI title extraction failed:`, error);
            }

            // Fall back to baseTitle if AI extraction failed
            if (!title) {
              title = uniqueUrls.length > 1 ? `${baseTitle} (${j + 1})` : baseTitle;
              console.debug(`  → Using fallback title: ${title}`);
            }

            const result = await saveJobAsync(title, url, savedEmail.id);
            if (result.isNew) {
              jobsCreated++;
              console.debug(`  ✓ New job created: ${title}`);

              // Enqueue job for processing
              console.debug(`  → Enqueuing job ${result.id} for processing`);
              await enqueueJobProcessing(result.id, title, url, savedEmail.id);
            } else {
              console.debug(`  ↻ Job updated (not enqueued): ${title}`);
            }
          }
        } else {
          // Use extracted titles
          console.debug(`  → Found ${jobsWithTitles.length} jobs with titles`);

          for (const job of jobsWithTitles) {
            // Skip if already scanned
            if (await isJobScanned(job.url)) {
              console.debug(`  → Job already scanned, skipping: ${job.title}`);
              continue;
            }

            // Save job with actual title from email
            console.debug(`  → Creating job: ${job.title}`);
            const result = await saveJobAsync(job.title, job.url, savedEmail.id);

            // Only increment counter and enqueue for NEW jobs
            if (result.isNew) {
              jobsCreated++;
              console.debug(`  ✓ New job created: ${job.title}`);

              // Enqueue job for processing
              console.debug(`  → Enqueuing job ${result.id} for processing`);
              await enqueueJobProcessing(result.id, job.title, job.url, savedEmail.id);
            } else {
              console.debug(`  ↻ Job updated (not enqueued): ${job.title}`);
            }
          }
        }

        emitProgress({
          type: 'enqueuing_jobs',
          total: jobRelatedEmails.length,
          current: i + 1,
          message: `Created jobs for ${i + 1}/${jobRelatedEmails.length} emails`
        });
      } catch (error) {
        logger.errorFromException(error, { source: 'scan-runner', context: { gmailId: email.id, subject: email.subject } });
        console.error(`Failed to create jobs for email ${email.id}:`, error);
      }
    }
  }

  let jobsEnqueued = jobsCreated; // For backwards compatibility with UI

  const stats = await getEmailStats();

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
