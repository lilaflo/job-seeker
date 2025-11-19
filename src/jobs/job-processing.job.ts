/**
 * Job Processing Job Processor
 * Fetches job descriptions, generates embeddings, and checks blacklist
 */

import Bull from 'bull';
import {
  type JobProcessingJobData,
  type JobProcessingJobResult,
} from '../queue';
import {
  generateAndSaveJobEmbedding,
  getBlacklistKeywords,
  bufferToEmbedding,
  cosineSimilarity,
  getJobEmbedding,
} from '../embeddings';
import {
  markJobBlacklisted,
  saveJob,
  canCrawlUrl,
} from '../database';
import { scrapeJobPage } from '../job-scraper';
import { logger } from '../logger';

// Pre-fetch blacklist embeddings for fast comparison
const blacklistKeywords = getBlacklistKeywords();
const blacklistEmbeddings = blacklistKeywords
  .filter(k => k.embedding)
  .map(k => bufferToEmbedding(k.embedding!));
const minSimilarity = 0.7;

let ollamaModel: string | null = null;

export function setOllamaModel(model: string | null): void {
  ollamaModel = model;
}

export async function processJobProcessingJob(
  job: Bull.Job<JobProcessingJobData>
): Promise<JobProcessingJobResult> {
  const { jobId, title, url, emailId } = job.data;

  console.debug(`🔍 Processing job ${jobId}: ${title.substring(0, 40)}...`);

  try {
    let hasDescription = false;
    let hasEmbedding = false;
    let isBlacklisted = false;

    // Check if platform can be crawled
    const isCrawlable = canCrawlUrl(url);

    if (isCrawlable && ollamaModel) {
      // Fetch and summarize job description
      const scraped = await scrapeJobPage(url, ollamaModel);

      if (!scraped.error && scraped.description && scraped.description.length >= 100) {
        // Save job with description and salary
        saveJob(title, url, emailId ?? undefined, scraped.salary, scraped.description);
        hasDescription = true;
      }
    }

    // Generate embedding
    const textToEmbed = hasDescription ? `${title}\n\n${title}` : title;
    await generateAndSaveJobEmbedding(jobId, title, hasDescription ? title : null);
    hasEmbedding = true;

    // Check against blacklist
    if (blacklistEmbeddings.length > 0) {
      const jobEmbedding = getJobEmbedding(jobId);

      if (jobEmbedding) {
        for (const blacklistEmb of blacklistEmbeddings) {
          const similarity = cosineSimilarity(jobEmbedding, blacklistEmb);
          if (similarity >= minSimilarity) {
            markJobBlacklisted(jobId, true);
            isBlacklisted = true;
            break;
          }
        }
      }
    }

    console.debug(`  ✓ Job ${jobId} processed (desc: ${hasDescription}, emb: ${hasEmbedding}, blacklist: ${isBlacklisted})`);

    return {
      jobId,
      success: true,
      hasDescription,
      hasEmbedding,
      blacklisted: isBlacklisted,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.errorFromException(error, { source: 'job-processing.job', context: { jobId, title, url } });
    console.error(`  ✗ Job processing failed for job ${jobId}: ${errorMessage}`);

    return {
      jobId,
      success: false,
      hasDescription: false,
      hasEmbedding: false,
      blacklisted: false,
      error: errorMessage,
    };
  }
}
