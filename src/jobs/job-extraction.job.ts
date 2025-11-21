/**
 * Job Extraction Job Processor
 * Extracts job URLs from emails and enqueues job processing
 */

import Bull from 'bull';
import {
  type JobExtractionJobData,
  type JobExtractionJobResult,
  enqueueJobProcessing,
} from '../queue';
import { extractJobUrls, extractJobTitle, deduplicateUrls } from '../url-extractor';
import { saveJobAsync, isJobScanned } from '../database';
import { logger } from '../logger';

export async function processJobExtractionJob(
  job: Bull.Job<JobExtractionJobData>
): Promise<JobExtractionJobResult> {
  const { emailId, gmailId, subject, body } = job.data;

  console.debug(`📋 Extracting jobs from email ${emailId}: ${subject.substring(0, 40)}...`);

  try {
    // Note: Email existence is verified by the caller
    // No need to verify again here

    // Extract job URLs from email body
    const jobUrls = extractJobUrls(body);

    if (jobUrls.length === 0) {
      return {
        emailId,
        success: true,
        jobsExtracted: 0,
      };
    }

    // Deduplicate URLs
    const uniqueUrls = deduplicateUrls(jobUrls);

    // Extract job title from subject
    const baseTitle = extractJobTitle(subject, body);

    let extractedCount = 0;

    // Save each job URL
    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i];

      // Check if job already scanned (async)
      if (await isJobScanned(url)) {
        console.debug(`  → Job already scanned, skipping: ${url}`);
        continue;
      }

      // Create title
      const title = uniqueUrls.length > 1 ? `${baseTitle} (${i + 1})` : baseTitle;

      console.debug(`  → Attempting to save job: ${title}`);
      console.debug(`    - URL: ${url}`);
      console.debug(`    - Email ID: ${emailId}`);

      // Save job to database (async)
      try {
        const result = await saveJobAsync(title, url, emailId);
        if (result.isNew) {
          console.debug(`  ✓ New job created: ${title} (ID: ${result.id})`);
          extractedCount++;

          // Enqueue job processing for NEW jobs only
          console.debug(`  → Enqueuing job processing for job ID ${result.id}`);
          await enqueueJobProcessing(result.id, title, url, emailId);
        } else {
          console.debug(`  ↻ Job already exists (not enqueued): ${title} (ID: ${result.id})`);
        }
      } catch (saveError) {
        logger.errorFromException(saveError, { source: 'job-extraction.job', context: { title, url, emailId } });
        console.error(`  ✗ Failed to save job ${title}: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
        console.error(`    - Full error:`, saveError);
        // Continue with next job instead of failing entire batch
      }
    }

    console.debug(`  ✓ Extracted ${extractedCount} jobs from email ${emailId}`);

    return {
      emailId,
      success: true,
      jobsExtracted: extractedCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.errorFromException(error, { source: 'job-extraction.job', context: { emailId, gmailId, subject } });
    console.error(`  ✗ Job extraction failed for email ${emailId}: ${errorMessage}`);

    return {
      emailId,
      success: false,
      jobsExtracted: 0,
      error: errorMessage,
    };
  }
}
