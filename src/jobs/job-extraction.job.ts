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
import { saveJob, isJobScanned, getDatabase } from '../database';

export async function processJobExtractionJob(
  job: Bull.Job<JobExtractionJobData>
): Promise<JobExtractionJobResult> {
  const { emailId, gmailId, subject, body } = job.data;

  console.debug(`📋 Extracting jobs from email ${emailId}: ${subject.substring(0, 40)}...`);

  try {
    // Verify email exists in database first
    const db = getDatabase();
    const emailExists = db.prepare('SELECT id, gmail_id, subject FROM emails WHERE id = ?').get(emailId) as { id: number; gmail_id: string; subject: string } | undefined;

    if (!emailExists) {
      // Check if email exists by gmail_id instead
      const emailByGmailId = db.prepare('SELECT id, gmail_id, subject FROM emails WHERE gmail_id = ?').get(gmailId) as { id: number; gmail_id: string; subject: string } | undefined;

      if (emailByGmailId) {
        console.error(`  ✗ Email ID mismatch: Received emailId=${emailId}, but email exists with id=${emailByGmailId.id} (gmail_id=${gmailId})`);
        throw new Error(`Email ID mismatch: Expected ${emailId}, found ${emailByGmailId.id} for gmail_id ${gmailId}`);
      }

      throw new Error(`Email with ID ${emailId} not found in database (gmail_id: ${gmailId})`);
    }

    console.debug(`  → Email verified in database: ID=${emailExists.id}, Gmail ID=${emailExists.gmail_id}, Subject="${emailExists.subject}"`);


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

      // Check if job already scanned
      if (isJobScanned(url)) {
        console.debug(`  → Job already scanned, skipping: ${url}`);
        continue;
      }

      // Create title
      const title = uniqueUrls.length > 1 ? `${baseTitle} (${i + 1})` : baseTitle;

      console.debug(`  → Attempting to save job: ${title}`);
      console.debug(`    - URL: ${url}`);
      console.debug(`    - Email ID: ${emailId}`);

      // Save job to database
      try {
        saveJob(title, url, emailId);
        console.debug(`  ✓ Job saved successfully: ${title}`);
        extractedCount++;

        // Get the saved job ID
        const savedJob = db.prepare('SELECT id FROM jobs WHERE link = ?').get(url) as { id: number } | undefined;

        // Enqueue job processing
        if (savedJob) {
          console.debug(`  → Enqueuing job processing for job ID ${savedJob.id}`);
          await enqueueJobProcessing(savedJob.id, title, url, emailId);
        } else {
          console.debug(`  ✗ Job not found after save: ${url}`);
        }
      } catch (saveError) {
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
    console.error(`  ✗ Job extraction failed for email ${emailId}: ${errorMessage}`);

    return {
      emailId,
      success: false,
      jobsExtracted: 0,
      error: errorMessage,
    };
  }
}
