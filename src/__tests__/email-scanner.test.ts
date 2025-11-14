import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { google } from 'googleapis';
import { fetchEmails, markEmailAsImportant, processEmailsWithProgress, EmailMessage } from '../email-scanner';
import type { OAuth2Client } from 'google-auth-library';

// Mock googleapis
vi.mock('googleapis');

describe('email-scanner', () => {
  let mockAuth: OAuth2Client;
  let mockGmail: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = {} as OAuth2Client;

    mockGmail = {
      users: {
        messages: {
          list: vi.fn(),
          get: vi.fn(),
          modify: vi.fn(),
        },
      },
    };

    vi.mocked(google.gmail).mockReturnValue(mockGmail as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchEmails', () => {
    it('should fetch emails successfully with progress bar disabled', async () => {
      const mockMessages = [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: 'msg1',
            threadId: 'thread1',
            snippet: 'Test email 1',
            internalDate: '1234567890',
            payload: {
              headers: [
                { name: 'Subject', value: 'Job Opening' },
                { name: 'From', value: 'hr@example.com' },
                { name: 'To', value: 'user@example.com' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'msg2',
            threadId: 'thread2',
            snippet: 'Test email 2',
            internalDate: '1234567891',
            payload: {
              headers: [
                { name: 'Subject', value: 'Software Engineer Position' },
                { name: 'From', value: 'recruiter@company.com' },
                { name: 'To', value: 'user@example.com' },
              ],
            },
          },
        });

      const emails = await fetchEmails(mockAuth, { showProgress: false });

      expect(emails).toHaveLength(2);
      expect(emails[0].subject).toBe('Job Opening');
      expect(emails[1].subject).toBe('Software Engineer Position');
      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: 'newer_than:7d',
        maxResults: 100,
      });
    });

    it('should return empty array when no emails found', async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      const emails = await fetchEmails(mockAuth, { showProgress: false });

      expect(emails).toHaveLength(0);
    });

    it('should handle custom query and maxResults', async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      await fetchEmails(mockAuth, {
        query: 'subject:job',
        maxResults: 10,
        showProgress: false,
      });

      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: 'subject:job',
        maxResults: 10,
      });
    });
  });

  describe('markEmailAsImportant', () => {
    it('should mark email as important and starred', async () => {
      mockGmail.users.messages.modify.mockResolvedValue({ data: {} });

      await markEmailAsImportant(mockAuth, 'msg123');

      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg123',
        requestBody: {
          addLabelIds: ['STARRED', 'IMPORTANT'],
        },
      });
    });

    it('should throw error if marking fails', async () => {
      mockGmail.users.messages.modify.mockRejectedValue(new Error('API error'));

      await expect(markEmailAsImportant(mockAuth, 'msg123')).rejects.toThrow(
        'Failed to mark email as important'
      );
    });
  });

  describe('processEmailsWithProgress', () => {
    const mockEmails: EmailMessage[] = [
      {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'Email 1',
        internalDate: '1234567890',
        subject: 'Test 1',
      },
      {
        id: 'msg2',
        threadId: 'thread2',
        snippet: 'Email 2',
        internalDate: '1234567891',
        subject: 'Test 2',
      },
    ];

    it('should process all emails successfully', async () => {
      const processor = vi.fn().mockResolvedValue({ result: 'processed' });

      const results = await processEmailsWithProgress(mockEmails, processor, {
        showProgress: false,
      });

      expect(results).toHaveLength(2);
      expect(processor).toHaveBeenCalledTimes(2);
      expect(processor).toHaveBeenCalledWith(mockEmails[0]);
      expect(processor).toHaveBeenCalledWith(mockEmails[1]);
    });

    it('should return empty array for empty input', async () => {
      const processor = vi.fn();

      const results = await processEmailsWithProgress([], processor, {
        showProgress: false,
      });

      expect(results).toHaveLength(0);
      expect(processor).not.toHaveBeenCalled();
    });

    it('should continue processing even if one email fails', async () => {
      const processor = vi
        .fn()
        .mockResolvedValueOnce({ result: 'success' })
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({ result: 'success' });

      const mockEmailsThree: EmailMessage[] = [
        ...mockEmails,
        {
          id: 'msg3',
          threadId: 'thread3',
          snippet: 'Email 3',
          internalDate: '1234567892',
        },
      ];

      const results = await processEmailsWithProgress(mockEmailsThree, processor, {
        showProgress: false,
      });

      expect(results).toHaveLength(2); // Only successful ones
      expect(processor).toHaveBeenCalledTimes(3);
    });
  });

  describe('fetchEmailBody', () => {
    it('should fetch and decode email body from plain text', async () => {
      const mockBody = Buffer.from('This is the email body').toString('base64url');

      mockGmail.users.messages.get.mockResolvedValue({
        data: {
          id: 'msg1',
          payload: {
            mimeType: 'text/plain',
            body: {
              data: mockBody,
            },
          },
        },
      });

      const { fetchEmailBody } = await import('../email-scanner');
      const body = await fetchEmailBody(mockAuth, 'msg1');

      expect(body).toBe('This is the email body');
      expect(mockGmail.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
        format: 'full',
      });
    });

    it('should fetch and decode email body from multipart message', async () => {
      const mockBody = Buffer.from('Plain text body').toString('base64url');

      mockGmail.users.messages.get.mockResolvedValue({
        data: {
          id: 'msg1',
          payload: {
            parts: [
              {
                mimeType: 'text/plain',
                body: {
                  data: mockBody,
                },
              },
            ],
          },
        },
      });

      const { fetchEmailBody } = await import('../email-scanner');
      const body = await fetchEmailBody(mockAuth, 'msg1');

      expect(body).toContain('Plain text body');
    });

    it('should return empty string when no body data available', async () => {
      mockGmail.users.messages.get.mockResolvedValue({
        data: {
          id: 'msg1',
          payload: {},
        },
      });

      const { fetchEmailBody } = await import('../email-scanner');
      const body = await fetchEmailBody(mockAuth, 'msg1');

      expect(body).toBe('');
    });

    it('should handle errors gracefully', async () => {
      mockGmail.users.messages.get.mockRejectedValue(new Error('API error'));

      const { fetchEmailBody } = await import('../email-scanner');
      const body = await fetchEmailBody(mockAuth, 'msg1');

      expect(body).toBe('');
    });
  });

  describe('fetchEmailBodies', () => {
    it('should fetch bodies for multiple emails', async () => {
      const mockBody1 = Buffer.from('Body 1').toString('base64url');
      const mockBody2 = Buffer.from('Body 2').toString('base64url');

      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: 'msg1',
            payload: { body: { data: mockBody1 } },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'msg2',
            payload: { body: { data: mockBody2 } },
          },
        });

      const { fetchEmailBodies } = await import('../email-scanner');
      const bodies = await fetchEmailBodies(mockAuth, ['msg1', 'msg2'], false);

      expect(bodies.size).toBe(2);
      expect(bodies.get('msg1')).toBe('Body 1');
      expect(bodies.get('msg2')).toBe('Body 2');
    });

    it('should return empty map for empty input', async () => {
      const { fetchEmailBodies } = await import('../email-scanner');
      const bodies = await fetchEmailBodies(mockAuth, [], false);

      expect(bodies.size).toBe(0);
    });
  });
});
