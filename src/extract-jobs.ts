/**
 * Job Extraction Script
 * Extracts job URLs from categorized emails and saves them to the jobs table
 * Optionally fetches and summarizes job descriptions using AI
 */

import {
  getHighConfidenceEmails,
  getJobs,
  saveJob,
  getJobStats,
  isJobScanned,
  closeDatabase,
  canCrawlUrl,
  getSkipReason,
  getPlatformByDomain,
} from "./database";
import {
  extractJobUrls,
  extractJobTitle,
  deduplicateUrls,
} from "./url-extractor";
import { scrapeJobPage } from "./job-scraper";
import { checkOllamaAvailability, getBestModel } from "./email-categorizer";
import { Ollama } from "ollama";
import cliProgress from "cli-progress";

// Configuration: Set to false to skip description fetching
const FETCH_DESCRIPTIONS = process.env.FETCH_DESCRIPTIONS !== "false";

// Ollama client singleton
let ollamaClient: Ollama | null = null;

function getOllamaClient(): Ollama {
  if (!ollamaClient) {
    const host = process.env.OLLAMA_HOST || "http://localhost:11434";
    ollamaClient = new Ollama({ host });
  }
  return ollamaClient;
}

/**
 * Summarizes a job description using Ollama LLM
 */
async function summarizeJobDescription(
  description: string,
  jobTitle: string,
  model: string
): Promise<string> {
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
    throw new Error(
      `Failed to summarize job description: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Creates a job description from email body using Ollama
 * Used for non-crawlable platforms like LinkedIn
 */
async function createDescriptionFromEmail(
  emailBody: string,
  jobTitle: string,
  jobUrl: string,
  model: string
): Promise<string | null> {
  try {
    const ollama = getOllamaClient();

    console.debug(`\n  → Creating description from email for: ${jobTitle}`);

    const prompt = `You are a job description writer. Based on the email content below, create a structured job description summary.

Email Content:
${emailBody.substring(0, 5000)}

Job Title: ${jobTitle}
Job URL: ${jobUrl}

Please extract and organize the available information into a structured job description. If information is missing, omit that section. Format as follows:

**Role Overview:**
[1-2 sentences describing the role based on email content]

**Key Responsibilities:**
[Bullet points of responsibilities if mentioned]

**Requirements:**
[Bullet points of required skills, experience, qualifications if mentioned]

**Nice to Have:**
[Bullet points of preferred qualifications if mentioned]

**Work Details:**
[Location, remote options, employment type if mentioned]

**Additional Information:**
[Any other relevant details from the email]

Note: This description was generated from the email notification as the job page could not be crawled.
Original job posting: ${jobUrl}

Keep the summary professional, clear, and under 500 words. Only include sections where information is available in the email.`;

    const response = await ollama.generate({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 1000,
      },
    });

    console.debug(`  ✓ Description created from email`);
    return response.response.trim();
  } catch (error) {
    console.debug(
      `  ✗ Failed to create description from email: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Fetches and summarizes job description from URL
 */
async function fetchJobDescription(
  url: string,
  title: string,
  model: string
): Promise<{ description: string | null; salary: any }> {
  try {
    console.debug(`\n  → Fetching description for: ${title}`);

    const scraped = await scrapeJobPage(url, model);

    if (
      scraped.error ||
      !scraped.description ||
      scraped.description.length < 100
    ) {
      console.debug(
        `  ✗ Failed to scrape: ${scraped.error || "Insufficient content"}`
      );
      return { description: null, salary: scraped.salary };
    }

    console.debug(`  → Summarizing with AI...`);
    const summary = await summarizeJobDescription(
      scraped.description,
      title,
      model
    );
    console.debug(`  ✓ Description saved`);

    return { description: summary, salary: scraped.salary };
  } catch (error) {
    console.debug(
      `  ✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return { description: null, salary: { min: null, max: null, currency: null, period: null } };
  }
}

async function main() {
  try {
    console.log("\n=== Job Extraction from Emails ===\n");

    // Check Ollama availability if descriptions are enabled
    let model: string | null = null;
    if (FETCH_DESCRIPTIONS) {
      console.log("Job description fetching: ENABLED (default)");
      const ollamaAvailable = await checkOllamaAvailability();

      if (!ollamaAvailable) {
        console.error(
          "✗ Ollama is not available. Disabling description fetching."
        );
        console.error(
          '  To enable: Start Ollama with "ollama serve"'
        );
      } else {
        model = await getBestModel();
        console.log(`Using Ollama model: ${model}`);
      }
      console.log();
    } else {
      console.log("Job description fetching: DISABLED");
      console.log(
        "  Note: Set FETCH_DESCRIPTIONS=false to explicitly disable\n"
      );
    }

    // Fetch high-confidence job-related emails from database
    const emails = getHighConfidenceEmails();

    if (emails.length === 0) {
      console.log("✓ No high-confidence job-related emails found in database.");
      console.log('  Run "pnpm scan:emails" first to scan for emails.');
      return;
    }

    console.log(
      `Found ${emails.length} high-confidence job-related emails in database.`
    );
    console.log("Extracting job URLs...\n");

    // Progress bar
    const progressBar = new cliProgress.SingleBar({
      format: "Extracting Jobs |{bar}| {percentage}% | {value}/{total} emails",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    progressBar.start(emails.length, 0);

    let extractedCount = 0;
    let skippedCount = 0;
    let newJobsCount = 0;
    let descriptionsCount = 0;
    let emailDescriptionsCount = 0; // Descriptions created from email content
    let webDescriptionsCount = 0; // Descriptions scraped from web
    let nonCrawlableSkipped = 0;
    const platformSkipReasons = new Map<string, string>(); // Track skip reasons by platform
    let currentEmailIndex = 0;

    // Process each email
    for (const email of emails) {
      currentEmailIndex++;
      progressBar.increment();

      // Skip if no body
      if (!email.body) {
        skippedCount++;
        continue;
      }

      // Extract job URLs from email body
      const jobUrls = extractJobUrls(email.body);

      if (jobUrls.length === 0) {
        skippedCount++;
        continue;
      }

      // Deduplicate URLs
      const uniqueUrls = deduplicateUrls(jobUrls);

      // Extract job title from subject
      const baseTitle = extractJobTitle(email.subject, email.body);

      // Save each job URL
      for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];

        // Check if job already scanned
        if (isJobScanned(url)) {
          continue;
        }

        // Create title (add suffix if multiple URLs from same email)
        const title =
          uniqueUrls.length > 1 ? `${baseTitle} (${i + 1})` : baseTitle;

        // Check if platform can be crawled
        const isCrawlable = canCrawlUrl(url);

        if (!isCrawlable) {
          // Non-crawlable platform - create description from email if enabled
          const platform = getPlatformByDomain(url);
          const skipReason = getSkipReason(url);

          if (platform && skipReason) {
            platformSkipReasons.set(platform.platform_name, skipReason);
          }

          let description: string | undefined = undefined;

          if (FETCH_DESCRIPTIONS && model && email.body) {
            progressBar.stop();
            description = await createDescriptionFromEmail(
              email.body,
              title,
              url,
              model
            ) || undefined;
            progressBar.start(emails.length, currentEmailIndex);

            if (description) {
              descriptionsCount++;
              emailDescriptionsCount++;
            }

            // Add delay to be respectful
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Save to database (with or without description)
          saveJob(title, url, email.id, undefined, description);
          newJobsCount++;
          nonCrawlableSkipped++;
          continue;
        }

        // Crawlable platform - fetch and summarize description if enabled
        let description: string | undefined = undefined;
        let salary: any = undefined;
        if (FETCH_DESCRIPTIONS && model) {
          progressBar.stop();
          const result = await fetchJobDescription(url, title, model);
          description = result.description || undefined;
          salary = result.salary;
          progressBar.start(emails.length, currentEmailIndex);

          if (description) {
            descriptionsCount++;
            webDescriptionsCount++;
          }

          // Add delay to be respectful
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Save job to database (with or without description)
        saveJob(title, url, email.id, salary, description);
        newJobsCount++;
      }

      extractedCount += uniqueUrls.length;
    }

    progressBar.stop();

    // Summary
    console.log("\n--- Extraction Summary ---");
    console.log(`Processed emails: ${emails.length}`);
    console.log(
      `Emails with job URLs: ${
        extractedCount > 0 ? emails.length - skippedCount : 0
      }`
    );
    console.log(`Total job URLs extracted: ${extractedCount}`);
    console.log(`New jobs saved: ${newJobsCount}`);
    console.log(`Already scanned (skipped): ${extractedCount - newJobsCount}`);

    if (nonCrawlableSkipped > 0) {
      console.log(`\nNon-crawlable jobs saved: ${nonCrawlableSkipped}`);
      if (emailDescriptionsCount > 0) {
        console.log(`  - With AI-generated descriptions from email: ${emailDescriptionsCount}`);
        console.log(`  - Without descriptions: ${nonCrawlableSkipped - emailDescriptionsCount}`);
      } else {
        console.log(`  - (No descriptions - enable FETCH_DESCRIPTIONS to generate from email)`);
      }
      platformSkipReasons.forEach((reason, platformName) => {
        console.log(`  - ${platformName}: ${reason}`);
      });
    }

    if (FETCH_DESCRIPTIONS) {
      console.log(
        `\nDescriptions generated: ${descriptionsCount}/${newJobsCount} total jobs`
      );
      if (webDescriptionsCount > 0) {
        console.log(`  - From web scraping: ${webDescriptionsCount}`);
      }
      if (emailDescriptionsCount > 0) {
        console.log(`  - From email content: ${emailDescriptionsCount}`);
      }
      if (descriptionsCount < newJobsCount) {
        console.log(`  - Failed to generate: ${newJobsCount - descriptionsCount}`);
      }
    }

    // Process existing jobs without descriptions
    if (FETCH_DESCRIPTIONS && model) {
      console.log("\n=== Processing Existing Jobs Without Descriptions ===\n");

      const allJobs = getJobs();
      // Filter to jobs without descriptions AND from crawlable platforms only
      const jobsToProcess = allJobs.filter(
        (job) => {
          const hasNoDescription = !job.description || job.description.length < 100;
          const isCrawlable = canCrawlUrl(job.link);
          return hasNoDescription && isCrawlable;
        }
      );

      // Count non-crawlable jobs without descriptions (for informational purposes)
      const nonCrawlableWithoutDesc = allJobs.filter(
        (job) => {
          const hasNoDescription = !job.description || job.description.length < 100;
          const isCrawlable = canCrawlUrl(job.link);
          return hasNoDescription && !isCrawlable;
        }
      ).length;

      if (jobsToProcess.length === 0 && nonCrawlableWithoutDesc === 0) {
        console.log("✓ All crawlable jobs already have descriptions.");
      } else if (jobsToProcess.length === 0) {
        console.log(`✓ All crawlable jobs already have descriptions.`);
        console.log(`  (${nonCrawlableWithoutDesc} non-crawlable jobs without descriptions - skipped)`);
      } else {
        console.log(
          `Found ${jobsToProcess.length} crawlable jobs without descriptions. Processing...\n`
        );
        if (nonCrawlableWithoutDesc > 0) {
          console.debug(`  (Skipping ${nonCrawlableWithoutDesc} non-crawlable jobs)\n`);
        }

        const processBar = new cliProgress.SingleBar({
          format:
            "Processing Jobs |{bar}| {percentage}% | {value}/{total} jobs",
          barCompleteChar: "\u2588",
          barIncompleteChar: "\u2591",
          hideCursor: true,
        });

        processBar.start(jobsToProcess.length, 0);

        let processSuccessCount = 0;
        let processFailureCount = 0;

        for (const job of jobsToProcess) {
          const result = await fetchJobDescription(job.link, job.title, model);

          if (result.description) {
            // Convert null to undefined for salary fields
            const salary = result.salary ? {
              min: result.salary.min ?? undefined,
              max: result.salary.max ?? undefined,
              currency: result.salary.currency ?? undefined,
              period: result.salary.period ?? undefined,
            } : undefined;
            saveJob(job.title, job.link, job.email_id ?? undefined, salary, result.description);
            processSuccessCount++;
          } else {
            processFailureCount++;
          }

          processBar.increment();

          // Add delay to be respectful
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        processBar.stop();

        console.log("\n--- Processing Summary ---");
        console.log(`Total jobs processed: ${jobsToProcess.length}`);
        console.log(`Successfully processed: ${processSuccessCount}`);
        console.log(`Failed: ${processFailureCount}`);
      }
    }

    // Database statistics
    const stats = getJobStats();
    console.log("\n--- Database Statistics ---");
    console.log(`Total jobs in database: ${stats.total}`);

    console.log("\n✓ Job processing complete!");

    // Close database connection
    closeDatabase();
  } catch (error) {
    console.error(
      "\n✗ Error:",
      error instanceof Error ? error.message : String(error)
    );
    closeDatabase();
    process.exit(1);
  }
}

main();
