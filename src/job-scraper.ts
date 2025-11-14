/**
 * Job Scraper Module
 * Fetches and extracts job description content from web pages
 */

import * as cheerio from 'cheerio';

/**
 * User agent to use for web requests (appears as a legitimate browser)
 */
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetches HTML content from a URL
 */
export async function fetchPageHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Common selectors for job description content on various platforms
 */
const JOB_DESCRIPTION_SELECTORS = [
  // LinkedIn
  '.jobs-description__content',
  '.jobs-description-content__text',
  '.job-view-layout',
  // Indeed
  '#jobDescriptionText',
  '.jobsearch-jobDescriptionText',
  // Greenhouse
  '#content',
  '.application',
  '.job-post',
  // Lever
  '.posting-headline',
  '.posting-description',
  // Workday
  '.jobDescription',
  '[data-automation-id="jobPostingDescription"]',
  // Generic
  '.job-description',
  '.job-details',
  '.description',
  'article',
  '[role="main"]',
  'main',
];

/**
 * Elements to remove from job descriptions (noise)
 */
const NOISE_SELECTORS = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  '.navigation',
  '.header',
  '.footer',
  '.cookie-banner',
  '.advertisement',
  '.social-share',
  'iframe',
  'noscript',
];

/**
 * Extracts job description text from HTML
 */
export function extractJobDescription(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  NOISE_SELECTORS.forEach(selector => {
    $(selector).remove();
  });

  // Try each selector to find job description
  for (const selector of JOB_DESCRIPTION_SELECTORS) {
    const element = $(selector);
    if (element.length > 0) {
      const text = element.text();

      // If we found substantial content, return it
      if (text.length > 200) {
        return cleanText(text);
      }
    }
  }

  // Fallback: get all text from body
  const bodyText = $('body').text();
  return cleanText(bodyText);
}

/**
 * Cleans extracted text
 */
function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple spaces
    .replace(/  +/g, ' ')
    // Remove leading/trailing whitespace
    .trim()
    // Limit length (for very long pages)
    .substring(0, 50000); // Max 50k characters for LLM processing
}

/**
 * Extracts job title from HTML (fallback if not in database)
 */
export function extractJobTitle(html: string): string | null {
  const $ = cheerio.load(html);

  // Try common title selectors
  const titleSelectors = [
    'h1',
    '.job-title',
    '.posting-headline',
    '[data-automation-id="jobPostingHeader"]',
    '.jobsearch-JobInfoHeader-title',
    'title',
  ];

  for (const selector of titleSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 0 && text.length < 200) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Checks if a URL is accessible
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Scrapes a job page and returns the description
 */
export async function scrapeJobPage(url: string): Promise<{
  description: string;
  title: string | null;
  error: string | null;
}> {
  try {
    console.debug(`Fetching job page: ${url}`);

    const html = await fetchPageHtml(url);
    const description = extractJobDescription(html);
    const title = extractJobTitle(html);

    if (!description || description.length < 100) {
      return {
        description: '',
        title,
        error: 'Could not extract meaningful job description',
      };
    }

    return {
      description,
      title,
      error: null,
    };
  } catch (error) {
    return {
      description: '',
      title: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
