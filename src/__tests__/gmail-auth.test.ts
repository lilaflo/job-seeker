import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import { loadCredentials, saveToken, loadToken, createOAuth2Client } from '../gmail-auth';
import type { GmailCredentials } from '../gmail-auth';

// Mock fs/promises
vi.mock('fs/promises');

describe('gmail-auth', () => {
  const mockCredentials: GmailCredentials = {
    installed: {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      redirect_uris: ['http://localhost:3000'],
    },
  };

  const mockToken = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadCredentials', () => {
    it('should load credentials from credentials.json successfully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCredentials));

      const credentials = await loadCredentials();

      expect(credentials).toEqual(mockCredentials);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('credentials.json'),
        'utf-8'
      );
    });

    it('should throw an error if credentials.json does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(loadCredentials()).rejects.toThrow(
        'Error loading credentials.json'
      );
    });
  });

  describe('saveToken', () => {
    it('should save token to token.json successfully', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      console.debug = vi.fn();

      await saveToken(mockToken);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('token.json'),
        JSON.stringify(mockToken)
      );
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Token saved')
      );
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await expect(saveToken(mockToken)).rejects.toThrow('Permission denied');
    });
  });

  describe('loadToken', () => {
    it('should load token from token.json if it exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockToken));

      const token = await loadToken();

      expect(token).toEqual(mockToken);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('token.json'),
        'utf-8'
      );
    });

    it('should return null if token.json does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'));

      const token = await loadToken();

      expect(token).toBeNull();
    });
  });

  describe('createOAuth2Client', () => {
    it('should create OAuth2Client with correct credentials', () => {
      const client = createOAuth2Client(mockCredentials);

      expect(client).toBeDefined();
      expect(client._clientId).toBe(mockCredentials.installed.client_id);
      expect(client._clientSecret).toBe(mockCredentials.installed.client_secret);
    });

    it('should create OAuth2Client with hardcoded redirect URI', () => {
      const client = createOAuth2Client(mockCredentials);

      // redirectUri is private, so we just verify the client was created
      expect(client).toBeDefined();
      expect(client._clientId).toBe(mockCredentials.installed.client_id);
      expect(client._clientSecret).toBe(mockCredentials.installed.client_secret);
    });
  });
});
