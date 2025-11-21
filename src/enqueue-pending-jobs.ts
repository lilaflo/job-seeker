/**
 * Enqueue all pending jobs for processing
 * This script finds all jobs with processing_status='pending' and enqueues them
 */

import { getJobs } from "./database";
import { enqueueJobProcessing } from "./queue";

async function enqueuePendingJobs() {
  try {
    console.debug("Fetching pending jobs...");

    // Get all jobs (including those with pending status)
    const allJobs = await getJobs({ includeBlacklisted: true, limit: 1000 });

    // Filter to only pending jobs
    const pendingJobs = allJobs.filter(
      (job) => job.processing_status === "pending"
    );

    console.debug(`Found ${pendingJobs.length} pending jobs`);

    if (pendingJobs.length === 0) {
      console.debug("No pending jobs to enqueue");
      return;
    }

    let enqueued = 0;
    for (const job of pendingJobs) {
      try {
        console.debug(`Enqueuing job ${job.id}: ${job.title}`);
        await enqueueJobProcessing(
          job.id,
          job.title,
          job.link,
          job.email_id || null
        );
        enqueued++;
      } catch (error) {
        console.error(`Failed to enqueue job ${job.id}:`, error);
      }
    }

    console.debug(
      `✓ Successfully enqueued ${enqueued}/${pendingJobs.length} jobs`
    );

    process.exit(0);
  } catch (error) {
    console.error("Error enqueuing pending jobs:", error);
    process.exit(1);
  }
}

enqueuePendingJobs();
