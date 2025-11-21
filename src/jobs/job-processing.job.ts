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
  cosineSimilarity,
  getJobEmbedding,
} from '../embeddings';
import {
  markJobBlacklisted,
  saveJobAsync,
  canCrawlUrl,
  updateJobProcessingStatus,
} from '../database';
import { scrapeJobPage } from '../job-scraper';
import { logger } from '../logger';

const minSimilarity = parseFloat(process.env.MIN_SIMILARITY || '0.6');

let ollamaModel: string | null = null;

export function setOllamaModel(model: string | null): void {
  ollamaModel = model;
}

export async function processJobProcessingJob(
  job: Bull.Job<JobProcessingJobData>
): Promise<JobProcessingJobResult> {
  const { jobId, title, url, emailId } = job.data;

  console.debug(`🔍 Processing job ${jobId}: ${title.substring(0, 40)}...`);

  // Mark job as processing
  await updateJobProcessingStatus(jobId, 'processing');

  try {
    let hasDescription = false;
    let hasEmbedding = false;
    let isBlacklisted = false;
    let scrapedDescription: string | null = null;

    // Check if platform can be crawled
    const isCrawlable = await canCrawlUrl(url);

    if (isCrawlable && ollamaModel) {
      // Fetch and summarize job description
      const scraped = await scrapeJobPage(url, ollamaModel);

      if (!scraped.error && scraped.description && scraped.description.length >= 100) {
        // Save job with description and salary
        await saveJobAsync(title, url, emailId ?? undefined, scraped.salary, scraped.description);
        scrapedDescription = scraped.description;
        hasDescription = true;
      }
    }

    // Generate embedding
    console.debug(`  → Generating embedding for job ${jobId}...`);
    await generateAndSaveJobEmbedding(jobId, title, scrapedDescription);
    hasEmbedding = true;
    console.debug(`  ✓ Embedding generated for job ${jobId}`);

    // Fetch blacklist embeddings (async)
    const blacklistKeywords = await getBlacklistKeywords();
    const blacklistEmbeddings = blacklistKeywords
      .filter(k => k.embedding)
      .map(k => {
        // Parse pgvector string format
        const embString = k.embedding!;
        return embString.slice(1, -1).split(',').map(parseFloat);
      });

    // Check against blacklist
    if (blacklistEmbeddings.length > 0) {
      console.debug(`  → Checking job ${jobId} against ${blacklistEmbeddings.length} blacklist keywords...`);
      const jobEmbedding = await getJobEmbedding(jobId);

      if (jobEmbedding) {
        for (const blacklistEmb of blacklistEmbeddings) {
          const similarity = cosineSimilarity(jobEmbedding, blacklistEmb);
          if (similarity >= minSimilarity) {
            await markJobBlacklisted(jobId, true);
            isBlacklisted = true;
            console.debug(`  ✗ Job ${jobId} matched blacklist (similarity: ${similarity.toFixed(2)})`);
            break;
          }
        }
        if (!isBlacklisted) {
          console.debug(`  ✓ Job ${jobId} passed blacklist check`);
        }
      }
    }

    console.debug(`  ✓ Job ${jobId} processed (desc: ${hasDescription}, emb: ${hasEmbedding}, blacklist: ${isBlacklisted})`);

    // Mark job as completed
    console.debug(`  → Setting job ${jobId} status to 'completed'...`);
    await updateJobProcessingStatus(jobId, 'completed');
    console.debug(`  ✓ Job ${jobId} status updated to 'completed'`);

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

    // Mark job as failed
    await updateJobProcessingStatus(jobId, 'failed');

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
