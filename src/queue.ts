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

// Queue instance (lazy initialized)
let embeddingQueue: Bull.Queue<EmbeddingJobData> | null = null;

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
