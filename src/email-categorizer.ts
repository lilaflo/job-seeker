import type { EmailMessage } from './email-scanner';
import { isFromJobPortal } from './job-portal-domains';
import {
  getOllamaClient,
  resetOllamaClient as resetClient,
  checkOllamaAvailability as checkAvailability,
  getBestModel as getBest,
} from './ollama-client';

// Re-export EmailMessage for external use
export type { EmailMessage };

export interface EmailCategory {
  isJobRelated: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
  reason: string;
}

export interface CategorizedEmail extends EmailMessage {
  category: EmailCategory;
  body?: string;
}

/**
 * Resets the Ollama client instance (for testing)
 */
export function resetOllamaClient(): void {
  resetClient();
}

/**
 * Checks if Ollama is available and running
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  return checkAvailability();
}

/**
 * Gets the best available model for email categorization
 */
export async function getBestModel(): Promise<string> {
  return getBest();
}


/**
 * Categorizes an email using domain checking and Ollama LLM
 */
export async function categorizeEmail(email: EmailMessage, body?: string, model?: string): Promise<EmailCategory> {
  // First check: Is this from a known job portal domain?
  if (email.from && isFromJobPortal(email.from)) {
    return {
      isJobRelated: true,
      confidence: 'high',
      matchedKeywords: [],
      reason: 'From known job board/freelance platform domain',
    };
  }

  // Second check: Use Ollama LLM for content analysis
  try {
    const ollama = getOllamaClient();
    const selectedModel = model || await getBestModel();

    // Prepare email content for analysis
    const emailContent = `
From: ${email.from || 'Unknown'}
Subject: ${email.subject || '(no subject)'}
Snippet: ${email.snippet || ''}
${body ? `Body: ${body.substring(0, 1500)}` : ''}
    `.trim();

    const prompt = `You are an expert email classifier that understands multiple languages (English, German, French, Spanish, etc.).

Analyze this email and determine if it is related to:
- Job offers or job postings
- Project offers or freelance opportunities
- Career opportunities or employment
- Contract work or consulting opportunities
- Recruitment or hiring

Consider these terms in ANY language as job-related:
- Job, Jobs, Stelle, Stellen, Trabajo, Emploi, Lavoro
- Project, Projekt, Projekte, Proyecto, Projet, Progetto
- Freelance, Freiberuflich, Autónomo, Indépendant
- Career, Karriere, Carrera, Carrière
- Opportunity, Gelegenheit, Oportunidad, Opportunité
- Position, Position, Puesto, Poste
- Remote, Remote-Arbeit, Trabajo remoto, Télétravail

Email to analyze:
${emailContent}

Respond with ONLY valid JSON, no other text:
{
  "isJobRelated": true or false,
  "confidence": "high" or "medium" or "low",
  "reason": "brief explanation of why this is or isn't job-related",
  "keywords": ["relevant", "terms", "found"]
}`;

    const response = await ollama.generate({
      model: selectedModel,
      prompt,
      stream: false,
      options: {
        temperature: 0.2, // Low temperature for consistent categorization
      },
    });

    // Parse the LLM response
    const responseText = response.response.trim();

    // Try to extract JSON from the response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        isJobRelated: false,
        confidence: 'low',
        matchedKeywords: [],
        reason: 'Ollama returned invalid format',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the response
    if (typeof parsed.isJobRelated !== 'boolean') {
      return {
        isJobRelated: false,
        confidence: 'low',
        matchedKeywords: [],
        reason: 'Ollama returned invalid data',
      };
    }

    return {
      isJobRelated: parsed.isJobRelated === true,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
      matchedKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      reason: parsed.reason || 'AI analysis',
    };
  } catch (error) {
    // If Ollama fails, return not job-related
    return {
      isJobRelated: false,
      confidence: 'low',
      matchedKeywords: [],
      reason: `Ollama error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Categorizes multiple emails with progress tracking
 */
export async function categorizeEmails(
  emails: EmailMessage[],
  bodies?: Map<string, string>,
  model?: string
): Promise<CategorizedEmail[]> {
  const categorized: CategorizedEmail[] = [];

  for (const email of emails) {
    const body = bodies?.get(email.id);
    const category = await categorizeEmail(email, body, model);

    categorized.push({
      ...email,
      body,
      category,
    });
  }

  return categorized;
}

/**
 * Formats email for terminal display with checkmark indicator
 */
export function formatEmailForDisplay(email: CategorizedEmail, index: number): string {
  const checkmark = email.category.isJobRelated ? '✓' : '✗';
  const color = email.category.isJobRelated ? '\x1b[32m' : '\x1b[31m'; // Green or Red
  const reset = '\x1b[0m';
  const confidence = email.category.confidence;

  const subject = email.subject || '(no subject)';
  const from = email.from ? ` from ${email.from.split('<')[0].trim()}` : '';

  return `${color}${checkmark}${reset} ${index + 1}. ${subject}${from} ${color}[${confidence}]${reset}`;
}
