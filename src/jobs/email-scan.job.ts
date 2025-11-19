/**
 * Email Scan Job Processor
 * Scans Gmail for job-related emails and enqueues job extraction
 */

import Bull from 'bull';
import {
  type EmailScanJobData,
  type EmailScanJobResult,
} from '../queue';
import { runScan } from '../scan-runner';

export async function processEmailScanJob(
  job: Bull.Job<EmailScanJobData>
): Promise<EmailScanJobResult> {
  const { query, maxResults } = job.data;

  console.log(`\n📧 Processing email scan: query="${query}", maxResults=${maxResults}`);

  try {
    const result = await runScan({
      query,
      maxResults,
      onProgress: (event) => {
        console.debug(`  [${event.type}] ${event.message}`);
        job.progress(event.current && event.total ? Math.round((event.current / event.total) * 100) : 0);
      },
      onEmailProcessed: (email) => {
        const icon = email.isJobRelated ? '✓' : '✗';
        console.debug(`  ${icon} ${email.subject?.substring(0, 50) || 'No subject'}... [${email.confidence}]`);
      },
    });

    console.log(`✓ Email scan completed: ${result.processed} emails, ${result.jobRelated} job-related`);

    return {
      success: true,
      message: result.message,
      processed: result.processed,
      jobRelated: result.jobRelated,
      skipped: result.skipped,
      embeddingsGenerated: result.embeddingsGenerated,
      jobsBlacklisted: result.jobsBlacklisted,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✗ Email scan failed: ${errorMessage}`);

    return {
      success: false,
      message: errorMessage,
      processed: 0,
      jobRelated: 0,
      skipped: 0,
      embeddingsGenerated: 0,
      jobsBlacklisted: 0,
      error: errorMessage,
    };
  }
}
