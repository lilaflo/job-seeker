/**
 * Job Processing Script
 * Visits job URLs, fetches content, summarizes using AI, and saves to database
 */

import { getJobs, saveJob, closeDatabase } from './database';
import { scrapeJobPage } from './job-scraper';
import { checkOllamaAvailability, getBestModel } from './email-categorizer';
import { Ollama } from 'ollama';
import cliProgress from 'cli-progress';

// Ollama client singleton
let ollamaClient: Ollama | null = null;

function getOllamaClient(): Ollama {
  if (!ollamaClient) {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    ollamaClient = new Ollama({ host });
  }
  return ollamaClient;
}

/**
 * Summarizes a job description using Ollama LLM
 */
async function summarizeJobDescription(description: string, jobTitle: string, model: string): Promise<string> {
  const ollama = getOllamaClient();

  const prompt = `You are a job description summarizer. Summarize the following job posting in a clear, concise format.

Job Title: ${jobTitle}

Job Description:
${description}

Please provide a structured summary covering:
1. Role Overview: A brief 1-2 sentence description of the role
2. Key Responsibilities: Main duties and tasks (bullet points)
3. Requirements: Required skills, experience, and qualifications (bullet points)
4. Nice to Have: Preferred/optional qualifications (if mentioned)
5. Work Details: Location, remote options, employment type (if mentioned)

Keep the summary professional, clear, and under 500 words. Focus on the most important information.`;

  try {
    const response = await ollama.generate({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3, // Lower temperature for more consistent summaries
        num_predict: 1000, // Max tokens for summary
      },
    });

    return response.response.trim();
  } catch (error) {
    throw new Error(`Failed to summarize job description: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Processes a single job: scrapes page, summarizes, and updates database
 */
async function processJob(
  job: { id: number; title: string; link: string; description: string | null },
  model: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Skip if already has description
    if (job.description && job.description.length > 100) {
      console.debug(`Job ${job.id} already has description, skipping...`);
      return { success: true, error: null };
    }

    // Scrape job page
    const scraped = await scrapeJobPage(job.link);

    if (scraped.error) {
      return { success: false, error: scraped.error };
    }

    if (!scraped.description || scraped.description.length < 100) {
      return { success: false, error: 'Insufficient content extracted from page' };
    }

    // Summarize using AI
    const summary = await summarizeJobDescription(scraped.description, job.title, model);

    // Update job in database (keeping existing title, email_id, salary)
    // We only update the description field
    saveJob(job.title, job.link, undefined, undefined, summary);

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  try {
    console.log('\n=== Job Description Processing ===\n');

    // Check Ollama availability
    const ollamaAvailable = await checkOllamaAvailability();

    if (!ollamaAvailable) {
      console.error('✗ Ollama is not available. Please ensure Ollama is running.');
      console.error('Run: ollama serve');
      process.exit(1);
    }

    const model = await getBestModel();
    console.log(`Using Ollama model: ${model}`);

    // Fetch all jobs from database
    const jobs = getJobs();

    if (jobs.length === 0) {
      console.log('✓ No jobs found in database.');
      console.log('  Run "pnpm scan:jobs" first to extract jobs from emails.');
      return;
    }

    // Filter jobs without descriptions
    const jobsToProcess = jobs.filter(job => !job.description || job.description.length < 100);

    if (jobsToProcess.length === 0) {
      console.log(`✓ All ${jobs.length} jobs already have descriptions.`);
      return;
    }

    console.log(`Found ${jobs.length} total jobs in database.`);
    console.log(`Processing ${jobsToProcess.length} jobs without descriptions...\n`);

    // Progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'Processing Jobs |{bar}| {percentage}% | {value}/{total} jobs',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(jobsToProcess.length, 0);

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ job: string; error: string }> = [];

    // Process jobs with delay to avoid rate limiting
    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];

      const result = await processJob(job, model);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        errors.push({ job: job.title, error: result.error || 'Unknown error' });
      }

      progressBar.increment();

      // Add small delay between requests to be respectful
      if (i < jobsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    progressBar.stop();

    // Summary
    console.log('\n--- Processing Summary ---');
    console.log(`Total jobs processed: ${jobsToProcess.length}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Failed: ${failureCount}`);

    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n--- Errors ---');
      errors.forEach(({ job, error }) => {
        console.log(`✗ ${job}: ${error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n--- Errors (showing first 10 of ${errors.length}) ---`);
      errors.slice(0, 10).forEach(({ job, error }) => {
        console.log(`✗ ${job}: ${error}`);
      });
    }

    console.log('\n✓ Job processing complete!');

    // Close database connection
    closeDatabase();
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : String(error));
    closeDatabase();
    process.exit(1);
  }
}

main();
