/**
 * Tests for pubsub module - Redis pub/sub for inter-process communication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  publishJobEvent,
  subscribeToJobEvents,
  checkPubSubConnection,
  closePubSub,
  type JobRemovedMessage,
} from '../pubsub';

// Mock functions shared across all Redis instances
const mockPublish = vi.fn().mockResolvedValue(1);
const mockSubscribe = vi.fn().mockResolvedValue(1);
const mockOn = vi.fn();
const mockQuit = vi.fn().mockResolvedValue('OK');
const mockPing = vi.fn().mockResolvedValue('PONG');

// Mock ioredis
vi.mock('ioredis', () => {
  class MockRedis {
    publish = mockPublish;
    subscribe = mockSubscribe;
    on = mockOn;
    quit = mockQuit;
    ping = mockPing;
  }

  return {
    default: MockRedis,
  };
});

describe('PubSub module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closePubSub();
  });

  describe('publishJobEvent', () => {
    it('should publish a job_removed event', async () => {
      const message: JobRemovedMessage = {
        type: 'job_removed',
        jobId: 123,
        reason: 'blacklisted',
      };

      await publishJobEvent(message);

      expect(mockPublish).toHaveBeenCalledWith(
        'job-events',
        JSON.stringify(message)
      );
    });

    it('should handle publish errors gracefully', async () => {
      mockPublish.mockRejectedValueOnce(new Error('Redis error'));

      const message: JobRemovedMessage = {
        type: 'job_removed',
        jobId: 456,
        reason: 'blacklisted',
      };

      // Should not throw
      await expect(publishJobEvent(message)).resolves.toBeUndefined();
    });
  });

  describe('subscribeToJobEvents', () => {
    it('should subscribe to job-events channel', async () => {
      const handler = vi.fn();

      await subscribeToJobEvents(handler);

      expect(mockSubscribe).toHaveBeenCalledWith('job-events');
    });

    it('should call handler when message is received', async () => {
      const handler = vi.fn();
      const message: JobRemovedMessage = {
        type: 'job_removed',
        jobId: 789,
        reason: 'blacklisted',
      };

      await subscribeToJobEvents(handler);

      // Get the message event handler
      const onCall = mockOn.mock.calls.find((call) => call[0] === 'message');
      expect(onCall).toBeDefined();

      if (onCall) {
        const messageHandler = onCall[1] as (channel: string, data: string) => void;
        messageHandler('job-events', JSON.stringify(message));

        expect(handler).toHaveBeenCalledWith(message);
      }
    });
  });

  describe('checkPubSubConnection', () => {
    it('should return true when Redis is available', async () => {
      const result = await checkPubSubConnection();
      expect(result).toBe(true);
      expect(mockPing).toHaveBeenCalled();
    });

    it('should return false when Redis is unavailable', async () => {
      mockPing.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await checkPubSubConnection();
      expect(result).toBe(false);
    });
  });

  describe('closePubSub', () => {
    it('should close all Redis connections', async () => {
      // Create connections by calling publish and subscribe
      await publishJobEvent({
        type: 'job_removed',
        jobId: 1,
        reason: 'test',
      });

      await subscribeToJobEvents(() => {});

      await closePubSub();

      expect(mockQuit).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      await publishJobEvent({
        type: 'job_removed',
        jobId: 1,
        reason: 'test',
      });

      mockQuit.mockRejectedValueOnce(new Error('Quit failed'));

      // Should not throw
      await expect(closePubSub()).resolves.toBeUndefined();
    });
  });
});
