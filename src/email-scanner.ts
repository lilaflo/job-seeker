import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import cliProgress from "cli-progress";
import { logger } from "./logger";

export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  subject?: string;
  from?: string;
  to?: string;
}

export interface ScanOptions {
  query?: string;
  maxResults?: number;
  showProgress?: boolean;
}

/**
 * Fetches emails from Gmail with optional progress bar
 */
export async function fetchEmails(
  auth: OAuth2Client,
  options: ScanOptions = {}
): Promise<EmailMessage[]> {
  const {
    query = "newer_than:7d",
    maxResults = 100,
    showProgress = true,
  } = options;

  const gmail = google.gmail({ version: "v1", auth });
  const emails: EmailMessage[] = [];

  // First, get the list of message IDs
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = listResponse.data.messages || [];
  const totalMessages = messages.length;

  if (totalMessages === 0) {
    return emails;
  }

  // Create progress bar
  let progressBar: cliProgress.SingleBar | null = null;
  if (showProgress) {
    progressBar = new cliProgress.SingleBar({
      format:
        "Processing Emails |{bar}| {percentage}% | {value}/{total} emails",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });
    progressBar.start(totalMessages, 0);
  }

  // Fetch full email details
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    try {
      const emailData = await gmail.users.messages.get({
        userId: "me",
        id: message.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });

      const headers = emailData.data.payload?.headers || [];
      const subject =
        headers.find((h) => h.name === "Subject")?.value ?? undefined;
      const from = headers.find((h) => h.name === "From")?.value ?? undefined;
      const to = headers.find((h) => h.name === "To")?.value ?? undefined;

      emails.push({
        id: emailData.data.id!,
        threadId: emailData.data.threadId!,
        snippet: emailData.data.snippet || "",
        internalDate: emailData.data.internalDate || "",
        subject,
        from,
        to,
      });

      if (progressBar) {
        progressBar.update(i + 1);
      }
    } catch (error) {
      logger.errorFromException(error, {
        source: "email-scanner",
        context: { emailId: message.id! },
      });
      if (progressBar) {
        progressBar.update(i + 1);
      }
    }
  }

  if (progressBar) {
    progressBar.stop();
  }

  return emails;
}

/**
 * Fetches the full body of an email
 */
export async function fetchEmailBody(
  auth: OAuth2Client,
  emailId: string
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const emailData = await gmail.users.messages.get({
      userId: "me",
      id: emailId,
      format: "full",
    });

    const payload = emailData.data.payload;
    if (!payload) {
      return "";
    }

    // Extract text from email parts
    const extractText = (parts: any[]): string => {
      let text = "";

      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          // Decode base64url encoded data
          const decoded = Buffer.from(part.body.data, "base64url").toString(
            "utf-8"
          );
          text += decoded + "\n";
        } else if (part.mimeType === "text/html" && part.body?.data && !text) {
          // Use HTML as fallback if no plain text
          const decoded = Buffer.from(part.body.data, "base64url").toString(
            "utf-8"
          );
          // Simple HTML tag removal
          text += decoded.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") + "\n";
        } else if (part.parts) {
          // Recursively extract from nested parts
          text += extractText(part.parts);
        }
      }

      return text;
    };

    // Handle single-part or multi-part messages
    if (payload.parts) {
      return extractText(payload.parts);
    } else if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, "base64url").toString(
        "utf-8"
      );
      return decoded;
    }

    return "";
  } catch (error) {
    logger.errorFromException(error, {
      source: "email-scanner",
      context: { emailId },
    });
    return "";
  }
}

/**
 * Fetches email bodies for multiple emails with progress tracking
 */
export async function fetchEmailBodies(
  auth: OAuth2Client,
  emailIds: string[],
  showProgress = true
): Promise<Map<string, string>> {
  const bodies = new Map<string, string>();

  if (emailIds.length === 0) {
    return bodies;
  }

  let progressBar: cliProgress.SingleBar | null = null;
  if (showProgress) {
    progressBar = new cliProgress.SingleBar({
      format: "Fetching Email Bodies |{bar}| {percentage}% | {value}/{total}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });
    progressBar.start(emailIds.length, 0);
  }

  for (let i = 0; i < emailIds.length; i++) {
    const emailId = emailIds[i];
    const body = await fetchEmailBody(auth, emailId);
    bodies.set(emailId, body);

    if (progressBar) {
      progressBar.update(i + 1);
    }
  }

  if (progressBar) {
    progressBar.stop();
  }

  return bodies;
}

/**
 * Marks an email as important/starred
 */
export async function markEmailAsImportant(
  auth: OAuth2Client,
  emailId: string
): Promise<void> {
  const gmail = google.gmail({ version: "v1", auth });

  try {
    await gmail.users.messages.modify({
      userId: "me",
      id: emailId,
      requestBody: {
        addLabelIds: ["STARRED", "IMPORTANT"],
      },
    });
  } catch (error) {
    logger.errorFromException(error, {
      source: "email-scanner",
      context: { emailId },
    });
    throw new Error(
      `Failed to mark email as important: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Processes multiple emails with progress tracking
 */
export async function processEmailsWithProgress<T>(
  emails: EmailMessage[],
  processor: (email: EmailMessage) => Promise<T>,
  options: { title?: string; showProgress?: boolean } = {}
): Promise<T[]> {
  const { title = "Processing", showProgress = true } = options;
  const results: T[] = [];

  if (emails.length === 0) {
    return results;
  }

  let progressBar: cliProgress.SingleBar | null = null;
  if (showProgress) {
    progressBar = new cliProgress.SingleBar({
      format: `${title} |{bar}| {percentage}% | {value}/{total}`,
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });
    progressBar.start(emails.length, 0);
  }

  for (let i = 0; i < emails.length; i++) {
    try {
      const result = await processor(emails[i]);
      results.push(result);
    } catch (error) {
      // Silently skip failed emails
      logger.errorFromException(error, {
        source: "email-scanner",
        context: { emailId: emails[i].id },
      });
    }

    if (progressBar) {
      progressBar.update(i + 1);
    }
  }

  if (progressBar) {
    progressBar.stop();
  }

  return results;
}
