import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export interface GmailCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

/**
 * Reads credentials from the credentials.json file
 */
export async function loadCredentials(): Promise<GmailCredentials> {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(content) as GmailCredentials;
  } catch (error) {
    throw new Error(
      `Error loading credentials.json. Please download it from Google Cloud Console.\n` +
      `Place it in the project root as 'credentials.json'.\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Saves the OAuth token to disk for future use
 */
export async function saveToken(token: any): Promise<void> {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.debug(`Token saved to ${TOKEN_PATH}`);
}

/**
 * Loads the OAuth token from disk if it exists
 */
export async function loadToken(): Promise<any | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Creates an OAuth2 client with the given credentials
 * Uses http://localhost:3000 as the redirect URI
 */
export function createOAuth2Client(credentials: GmailCredentials): OAuth2Client {
  const { client_id, client_secret } = credentials.installed;
  // Always use localhost:3000 for consistency
  return new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000');
}

/**
 * Starts a local server to receive the OAuth callback
 */
async function getAuthCodeFromCallback(authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) {
          throw new Error('No URL in request');
        }

        const url = new URL(req.url, 'http://localhost:3000');
        const code = url.searchParams.get('code');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p>');

          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication failed!</h1><p>No authorization code received.</p>');
        }
      } catch (error) {
        reject(error);
      }
    });

    server.listen(3000, () => {
      console.debug('Local OAuth callback server started on http://localhost:3000');
      console.log('\nPlease visit this URL to authorize the application:\n');
      console.log(authUrl);
      console.log('\n');
    });

    server.on('error', reject);
  });
}

/**
 * Authorizes the application and returns an OAuth2 client
 */
export async function authorize(): Promise<OAuth2Client> {
  const credentials = await loadCredentials();
  const oAuth2Client = createOAuth2Client(credentials);

  // Check if we have a saved token
  const token = await loadToken();
  if (token) {
    oAuth2Client.setCredentials(token);
    console.debug('Using saved token');
    return oAuth2Client;
  }

  // Generate authorization URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  // Get authorization code from user
  const code = await getAuthCodeFromCallback(authUrl);

  // Exchange code for token
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Save token for future use
  await saveToken(tokens);

  return oAuth2Client;
}

/**
 * Deletes the saved token file
 */
async function deleteToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_PATH);
    console.debug('Deleted expired token file');
  } catch (error) {
    // Ignore error if file doesn't exist
    console.debug('No token file to delete');
  }
}

/**
 * Tests the Gmail connection by fetching the user's profile
 * Automatically re-authenticates if credentials are invalid
 */
export async function testGmailConnection(auth: OAuth2Client): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('\nGmail connection successful!');
    console.log(`Email address: ${profile.data.emailAddress}`);
    console.log(`Total messages: ${profile.data.messagesTotal}`);
    console.log(`Total threads: ${profile.data.threadsTotal}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this is an invalid_grant error (expired/invalid credentials)
    if (errorMessage.includes('invalid_grant')) {
      console.log('\n⚠ Google credentials have expired or are invalid');
      console.log('Deleting old token and re-triggering OAuth flow...\n');

      // Delete the expired token
      await deleteToken();

      // Re-authorize with a fresh OAuth flow
      throw new Error('CREDENTIALS_EXPIRED');
    }

    throw new Error(`Failed to connect to Gmail: ${errorMessage}`);
  }
}
