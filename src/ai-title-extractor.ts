/**
 * AI-powered job title extraction using Ollama
 * Used as fallback when pattern matching fails
 */

import { getOllamaClient } from './ollama-client';

/**
 * Extract job title from email context using Ollama
 * @param emailBody The email body or relevant section
 * @param url The job URL (for context)
 * @param model Ollama model to use
 * @returns Extracted job title or null if failed
 */
export async function extractJobTitleWithAI(
  emailBody: string,
  url: string,
  model: string
): Promise<string | null> {
  try {
    // Get the context around the URL (500 chars before and after)
    const urlIndex = emailBody.indexOf(url);
    const start = Math.max(0, urlIndex - 500);
    const end = Math.min(emailBody.length, urlIndex + url.length + 500);
    const context = emailBody.substring(start, end);

    const prompt = `Extract the job title from this email excerpt. The excerpt contains information about a job posting.

Email excerpt:
${context}

Instructions:
- Return ONLY the job title, nothing else
- Do not include company name, location, or other details
- Keep it concise (typically 2-6 words)
- If you cannot find a clear job title, return "Job Opening"

Job title:`;

    const ollama = getOllamaClient();
    const response = await ollama.generate({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,  // Low temperature for consistency
        num_predict: 50,   // Short response expected
      },
    });

    let title = response.response?.trim() || '';

    // Clean up the response
    title = title
      .replace(/^["']|["']$/g, '')  // Remove quotes
      .replace(/^job title:?\s*/i, '')  // Remove "Job title:" prefix
      .trim();

    // Validate the result
    if (title.length < 3 || title.length > 100) {
      return null;
    }

    // Reject if it's just generic text
    const genericPatterns = [
      /^(job|position|role|opening|opportunity)$/i,
      /^not found$/i,
      /^unknown$/i,
    ];

    if (genericPatterns.some(pattern => pattern.test(title))) {
      return null;
    }

    console.debug(`  AI extracted job title: "${title}"`);
    return title;
  } catch (error) {
    console.error('Error extracting job title with AI:', error);
    return null;
  }
}
