/**
 * Redis Pub/Sub module - Inter-process communication between worker and server
 * Allows worker processes to send messages to the web server for WebSocket broadcasting
 */

import Redis from 'ioredis';
import { logger } from './logger';

// Redis configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Channel names
const CHANNELS = {
  JOB_EVENTS: 'job-events',
} as const;

// Publisher client (singleton)
let publisherClient: Redis | null = null;

// Subscriber client (singleton)
let subscriberClient: Redis | null = null;

/**
 * Message types that can be published
 */
export interface JobRemovedMessage {
  type: 'job_removed';
  jobId: number;
  reason: string;
}

export interface JobUpdatedMessage {
  type: 'job_updated';
  jobId: number;
  job: any;
}

export type PubSubMessage = JobRemovedMessage | JobUpdatedMessage;

/**
 * Get or create the publisher client
 */
function getPublisherClient(): Redis {
  if (!publisherClient) {
    publisherClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    publisherClient.on('error', (error) => {
      logger.error('Redis publisher error', {
        source: 'pubsub',
        context: { error: error.message },
      });
    });

    publisherClient.on('connect', () => {
      console.debug('Redis publisher connected');
    });
  }

  return publisherClient;
}

/**
 * Get or create the subscriber client
 */
function getSubscriberClient(): Redis {
  if (!subscriberClient) {
    subscriberClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    subscriberClient.on('error', (error) => {
      logger.error('Redis subscriber error', {
        source: 'pubsub',
        context: { error: error.message },
      });
    });

    subscriberClient.on('connect', () => {
      console.debug('Redis subscriber connected');
    });
  }

  return subscriberClient;
}

/**
 * Publish a message to the job events channel
 * This is called by worker processes to notify the server of job changes
 */
export async function publishJobEvent(message: PubSubMessage): Promise<void> {
  try {
    const client = getPublisherClient();
    const channel = CHANNELS.JOB_EVENTS;
    const data = JSON.stringify(message);

    await client.publish(channel, data);
    console.debug(`Published ${message.type} to ${channel}`, { jobId: (message as any).jobId });
  } catch (error) {
    logger.errorFromException(error, {
      source: 'pubsub',
      context: { action: 'publish', message },
    });
    console.error('Failed to publish job event:', error);
  }
}

/**
 * Subscribe to job events and call the handler for each message
 * This is called by the server to listen for job changes from workers
 */
export async function subscribeToJobEvents(
  handler: (message: PubSubMessage) => void
): Promise<void> {
  try {
    const client = getSubscriberClient();
    const channel = CHANNELS.JOB_EVENTS;

    await client.subscribe(channel);
    console.debug(`Subscribed to ${channel}`);

    client.on('message', (receivedChannel, data) => {
      if (receivedChannel === channel) {
        try {
          const message = JSON.parse(data) as PubSubMessage;
          console.debug(`Received ${message.type} from ${channel}`, { jobId: (message as any).jobId });
          handler(message);
        } catch (error) {
          logger.errorFromException(error, {
            source: 'pubsub',
            context: { action: 'parse-message', channel, data },
          });
          console.error('Failed to parse pub/sub message:', error);
        }
      }
    });
  } catch (error) {
    logger.errorFromException(error, {
      source: 'pubsub',
      context: { action: 'subscribe' },
    });
    console.error('Failed to subscribe to job events:', error);
  }
}

/**
 * Close all Redis connections
 */
export async function closePubSub(): Promise<void> {
  try {
    if (publisherClient) {
      await publisherClient.quit();
      publisherClient = null;
      console.debug('Redis publisher disconnected');
    }

    if (subscriberClient) {
      await subscriberClient.quit();
      subscriberClient = null;
      console.debug('Redis subscriber disconnected');
    }
  } catch (error) {
    logger.errorFromException(error, {
      source: 'pubsub',
      context: { action: 'close' },
    });
    console.error('Failed to close pub/sub connections:', error);
  }
}

/**
 * Check if Redis is available for pub/sub
 */
export async function checkPubSubConnection(): Promise<boolean> {
  try {
    const client = getPublisherClient();
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}
