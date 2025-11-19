/**
 * Queue module - Job queue for background processing using Bull
 * Uses Redis for job storage and processing
 */

import Bull from 'bull';

// Queue configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Job types
export interface EmbeddingJobData {
  jobId: number;
  title: string;
  description: string | null;
}

export interface EmbeddingJobResult {
  jobId: number;
  success: boolean;
  blacklisted: boolean;
  error?: string;
}

export interface JobExtractionJobData {
  emailId: number;
  gmailId: string;
  subject: string;
  body: string;
}

export interface JobExtractionJobResult {
  emailId: number;
  success: boolean;
  jobsExtracted: number;
  error?: string;
}

export interface JobProcessingJobData {
  jobId: number;
  title: string;
  url: string;
  emailId: number | null;
}

export interface JobProcessingJobResult {
  jobId: number;
  success: boolean;
  hasDescription: boolean;
  hasEmbedding: boolean;
  blacklisted: boolean;
  error?: string;
}

// Queue instances (lazy initialized)
let embeddingQueue: Bull.Queue<EmbeddingJobData> | null = null;
let jobExtractionQueue: Bull.Queue<JobExtractionJobData> | null = null;
let jobProcessingQueue: Bull.Queue<JobProcessingJobData> | null = null;

/**
 * Get or create the embedding queue
 */
export function getEmbeddingQueue(): Bull.Queue<EmbeddingJobData> {
  if (!embeddingQueue) {
    embeddingQueue = new Bull<EmbeddingJobData>('embedding-generation', {
      redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        timeout: 60000, // 60 second timeout
      },
    });

    embeddingQueue.on('error', (err) => {
      console.error('Embedding queue error:', err);
    });

    embeddingQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });
  }

  return embeddingQueue;
}

/**
 * Add a job to the embedding queue
 */
export async function enqueueEmbeddingJob(
  jobId: number,
  title: string,
  description: string | null
): Promise<Bull.Job<EmbeddingJobData>> {
  const queue = getEmbeddingQueue();

  return queue.add({
    jobId,
    title,
    description,
  });
}

/**
 * Add multiple jobs to the embedding queue
 */
export async function enqueueEmbeddingJobs(
  jobs: Array<{ id: number; title: string; description: string | null }>
): Promise<number> {
  const queue = getEmbeddingQueue();

  const bulkJobs = jobs.map(job => ({
    data: {
      jobId: job.id,
      title: job.title,
      description: job.description,
    },
  }));

  await queue.addBulk(bulkJobs);
  return bulkJobs.length;
}

/**
 * Get or create the job extraction queue
 */
export function getJobExtractionQueue(): Bull.Queue<JobExtractionJobData> {
  if (!jobExtractionQueue) {
    jobExtractionQueue = new Bull<JobExtractionJobData>('job-extraction', {
      redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        timeout: 60000,
      },
    });

    jobExtractionQueue.on('error', (err) => {
      console.error('Job extraction queue error:', err);
    });
  }

  return jobExtractionQueue;
}

/**
 * Add a job extraction job to the queue
 */
export async function enqueueJobExtraction(
  emailId: number,
  gmailId: string,
  subject: string,
  body: string
): Promise<Bull.Job<JobExtractionJobData>> {
  const queue = getJobExtractionQueue();

  return queue.add({
    emailId,
    gmailId,
    subject,
    body,
  });
}

/**
 * Get or create the job processing queue
 */
export function getJobProcessingQueue(): Bull.Queue<JobProcessingJobData> {
  if (!jobProcessingQueue) {
    jobProcessingQueue = new Bull<JobProcessingJobData>('job-processing', {
      redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        timeout: 120000, // 2 minute timeout for web scraping
      },
    });

    jobProcessingQueue.on('error', (err) => {
      console.error('Job processing queue error:', err);
    });
  }

  return jobProcessingQueue;
}

/**
 * Add a job processing job to the queue
 */
export async function enqueueJobProcessing(
  jobId: number,
  title: string,
  url: string,
  emailId: number | null
): Promise<Bull.Job<JobProcessingJobData>> {
  const queue = getJobProcessingQueue();

  return queue.add({
    jobId,
    title,
    url,
    emailId,
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getEmbeddingQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

/**
 * Close all queue connections
 */
export async function closeQueues(): Promise<void> {
  if (embeddingQueue) {
    await embeddingQueue.close();
    embeddingQueue = null;
  }
  if (jobExtractionQueue) {
    await jobExtractionQueue.close();
    jobExtractionQueue = null;
  }
  if (jobProcessingQueue) {
    await jobProcessingQueue.close();
    jobProcessingQueue = null;
  }
}

/**
 * Check if Redis is available
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const queue = getEmbeddingQueue();
    await queue.isReady();
    return true;
  } catch (error) {
    console.debug(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Clean old jobs from the queue
 */
export async function cleanQueue(grace: number = 1000): Promise<void> {
  const queue = getEmbeddingQueue();
  await queue.clean(grace, 'completed');
  await queue.clean(grace, 'failed');
}
