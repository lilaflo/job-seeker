/**
 * Job Scraper Module
 * Fetches and extracts job description content from web pages
 */

import * as cheerio from "cheerio";
import { getOllamaClient } from "./ollama-client";

/**
 * User agent to use for web requests (appears as a legitimate browser)
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Abstract API key for web scraping
 */
const ABSTRACT_API_KEY = process.env.ABSTRACT_API_KEY_SCRAPE;

/**
 * Abstract API rate limiting (1 req/s)
 */
let lastAbstractApiCall = 0;
const ABSTRACT_API_RATE_LIMIT_MS = 1000; // 1 request per second

async function waitForAbstractApiRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastAbstractApiCall;

  if (timeSinceLastCall < ABSTRACT_API_RATE_LIMIT_MS) {
    const waitTime = ABSTRACT_API_RATE_LIMIT_MS - timeSinceLastCall;
    console.debug(`Rate limiting: waiting ${waitTime}ms before Abstract API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastAbstractApiCall = Date.now();
}

/**
 * Fetches HTML content from a URL using Abstract API scraper
 */
export async function fetchPageHtml(url: string): Promise<string> {
  // For Indeed tracking URLs, follow redirects first to get the actual job page
  let finalUrl = url;
  if (url.includes('indeed.com') && url.includes('/clk/') || url.includes('/rc/clk/')) {
    try {
      // Follow redirects manually to get the final destination
      const redirectResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          "User-Agent": USER_AGENT,
        },
        redirect: 'manual',
      });

      // Get the Location header if this is a redirect
      const location = redirectResponse.headers.get('Location');
      if (location) {
        finalUrl = location.startsWith('http') ? location : new URL(location, url).href;
        console.debug(`Following Indeed redirect: ${url.substring(0, 80)}... -> ${finalUrl.substring(0, 80)}...`);
      }
    } catch (error) {
      console.debug(`Could not follow Indeed redirect, using original URL:`, error instanceof Error ? error.message : String(error));
      // Continue with original URL
    }
  }

  // Use Abstract API if available
  if (ABSTRACT_API_KEY) {
    try {
      // Wait for rate limit (1 req/s)
      await waitForAbstractApiRateLimit();

      // Build Abstract API URL with parameters
      const params = new URLSearchParams({
        api_key: ABSTRACT_API_KEY,
        url: finalUrl,
      });
      const abstractUrl = `https://scrape.abstractapi.com/v1/?${params.toString()}`;

      const response = await fetch(abstractUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Abstract API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Abstract API returns HTML in the response
      if (data && data.content) {
        return data.content;
      } else {
        throw new Error('Abstract API returned no content');
      }
    } catch (error) {
      // Don't log the full error text (can be verbose HTML)
      const errorMsg = error instanceof Error ? error.message.split(' - ')[0] : String(error);
      console.debug(`Abstract API failed, falling back to direct fetch: ${errorMsg}`);
      // Fall through to direct fetch
    }
  }

  // Fallback to direct fetch if Abstract API is not available or failed
  try {
    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(
      `Failed to fetch ${finalUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Common selectors for job description content on various platforms
 */
const JOB_DESCRIPTION_SELECTORS = [
  // LinkedIn
  ".jobs-description__content",
  ".jobs-description-content__text",
  ".job-view-layout",
  // Indeed
  "#jobDescriptionText",
  ".jobsearch-jobDescriptionText",
  // Greenhouse
  "#content",
  ".application",
  ".job-post",
  // Lever
  ".posting-headline",
  ".posting-description",
  // Workday
  ".jobDescription",
  '[data-automation-id="jobPostingDescription"]',
  // Generic
  ".job-description",
  ".job-details",
  ".description",
  "article",
  '[role="main"]',
  "main",
];

/**
 * Elements to remove from job descriptions (noise)
 */
const NOISE_SELECTORS = [
  "script",
  "style",
  "nav",
  "header",
  "footer",
  ".navigation",
  ".header",
  ".footer",
  ".cookie-banner",
  ".advertisement",
  ".social-share",
  "iframe",
  "noscript",
];

/**
 * Extracts raw job description text from HTML (used as input for Ollama)
 */
export function extractRawJobDescription(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  NOISE_SELECTORS.forEach((selector) => {
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
  const bodyText = $("body").text();
  return cleanText(bodyText);
}

/**
 * Uses Ollama to generate a standardized Markdown-formatted job description
 */
async function generateFormattedDescription(
  rawText: string,
  jobTitle: string | null,
  model: string
): Promise<string | null> {
  try {
    const ollama = getOllamaClient();

    // Limit text to 20000 characters for processing
    const textToAnalyze = rawText.substring(0, 20000);

    const prompt = `You are a job description formatter and translator. Convert the following job posting into a clean, well-structured Markdown document IN ENGLISH.

Job Title: ${jobTitle || "Not specified"}

Raw job posting text:
${textToAnalyze}

IMPORTANT INSTRUCTIONS:
1. LANGUAGE HANDLING:
   - Detect the language of the job posting
   - If the posting is NOT in English, translate ALL content to English
   - If you translated the content, add a note at the very beginning: "*(Original language: [Language Name])*"
   - Keep the translation natural and professional

2. Extract and organize the information into the following Markdown sections (use ## for section headers):
   - **## Overview** - Brief summary of the role (2-3 sentences)
   - **## Key Responsibilities** - Bullet list of main duties
   - **## Required Qualifications** - Bullet list of must-have skills/experience
   - **## Nice to Have** - Bullet list of preferred/bonus qualifications (if mentioned)
   - **## Benefits** - Bullet list of perks/benefits (if mentioned)
   - **## About the Company** - Brief company description (if mentioned)

3. Format rules:
   - Use bullet points (- ) for lists
   - Keep it concise and professional
   - Remove fluff, marketing speak, and legal boilerplate
   - Condense to essential details only
   - If a section has no relevant information, omit it entirely
   - Do NOT include salary information (handled separately)
   - Do NOT include application instructions or "how to apply" sections
   - Do NOT add information that isn't in the original text

4. Output ONLY the formatted Markdown, no explanations or meta-commentary

Example output format for English posting:
## Overview
[Brief 2-3 sentence summary of the role and what the company is looking for]

## Key Responsibilities
- [Main responsibility 1]
- [Main responsibility 2]

## Required Qualifications
- [Required skill/experience 1]
- [Required skill/experience 2]

Example output format for non-English posting (e.g., German):
*(Original language: German)*

## Overview
[Brief 2-3 sentence summary of the role - TRANSLATED TO ENGLISH]

## Key Responsibilities
- [Main responsibility 1 - TRANSLATED TO ENGLISH]
- [Main responsibility 2 - TRANSLATED TO ENGLISH]

## Required Qualifications
- [Required skill/experience 1 - TRANSLATED TO ENGLISH]
- [Required skill/experience 2 - TRANSLATED TO ENGLISH]

Now format and translate (if needed) the job posting:`;

    console.debug(
      `  → Generating formatted description with Ollama (${textToAnalyze.length} chars)...`
    );

    const response = await ollama.generate({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 2000,
      },
    });

    const formattedDescription = response.response.trim();

    // Validate that we got a meaningful response
    if (formattedDescription.length < 100) {
      console.debug("  ✗ Ollama returned too short a description");
      return null;
    }

    // Check if it looks like Markdown with headers
    if (!formattedDescription.includes("##")) {
      console.debug("  ✗ Ollama response does not contain Markdown headers");
      return null;
    }

    console.debug(
      `  ✓ Generated formatted description (${formattedDescription.length} chars)`
    );
    return formattedDescription;
  } catch (error) {
    console.debug(
      `  ✗ Ollama description formatting error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

/**
 * Extracts job description text from HTML
 * If model is provided, uses Ollama to generate formatted Markdown
 */
export async function extractJobDescription(
  html: string,
  jobTitle: string | null = null,
  model?: string
): Promise<string> {
  // Extract raw text first
  const rawText = extractRawJobDescription(html);

  // If model is provided, try to generate formatted description
  if (model && rawText.length > 200) {
    console.debug(
      "  → Attempting to generate formatted Markdown description..."
    );
    const formatted = await generateFormattedDescription(
      rawText,
      jobTitle,
      model
    );
    if (formatted) {
      console.debug("  ✓ Using Ollama-formatted Markdown description");
      return formatted;
    }
    console.debug("  ✗ Falling back to raw text");
  }

  // Fallback to raw text
  return rawText;
}

/**
 * Cleans extracted text
 */
function cleanText(text: string): string {
  return (
    text
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Remove multiple spaces
      .replace(/  +/g, " ")
      // Remove leading/trailing whitespace
      .trim()
      // Limit length (for very long pages)
      .substring(0, 50000)
  ); // Max 50k characters for LLM processing
}

/**
 * Extracts job title from HTML (fallback if not in database)
 */
export function extractJobTitle(html: string): string | null {
  const $ = cheerio.load(html);

  // Try common title selectors
  const titleSelectors = [
    "h1",
    ".job-title",
    ".posting-headline",
    '[data-automation-id="jobPostingHeader"]',
    ".jobsearch-JobInfoHeader-title",
    "title",
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
 * Salary information extracted from job page
 */
export interface SalaryInfo {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: "yearly" | "monthly" | "weekly" | "daily" | "hourly" | null;
}

/**
 * Common salary selectors on job pages
 */
const SALARY_SELECTORS = [
  ".salary",
  ".compensation",
  ".pay",
  '[class*="salary"]',
  '[class*="compensation"]',
  '[data-automation-id="payRange"]',
  ".jobsearch-JobMetadataHeader-item",
];

/**
 * Validates salary information to filter out unrealistic values
 */
function validateSalary(salary: SalaryInfo): boolean {
  // If both min and max are null, it's valid (no salary found)
  if (salary.min === null && salary.max === null) {
    return true;
  }

  // If we have values, validate them
  if (salary.min !== null || salary.max !== null) {
    const min = salary.min || 0;
    const max = salary.max || 0;

    // Check for unrealistic values based on period
    if (salary.period === "yearly") {
      // Yearly salaries should be between 20k and 1M
      if (min < 20000 || max > 1000000) {
        console.debug(
          `  ✗ Salary validation failed: yearly salary ${min}-${max} out of range (20k-1M)`
        );
        return false;
      }
    } else if (salary.period === "monthly") {
      // Monthly salaries should be between 1.5k and 100k
      if (min < 1500 || max > 100000) {
        console.debug(
          `  ✗ Salary validation failed: monthly salary ${min}-${max} out of range (1.5k-100k)`
        );
        return false;
      }
    } else if (salary.period === "hourly") {
      // Hourly rates should be between 10 and 500
      if (min < 10 || max > 500) {
        console.debug(
          `  ✗ Salary validation failed: hourly rate ${min}-${max} out of range (10-500)`
        );
        return false;
      }
    } else {
      // No period specified - assume yearly if value is large enough
      if (min < 100 || max > 1000000) {
        console.debug(
          `  ✗ Salary validation failed: salary ${min}-${max} seems unrealistic (no period specified)`
        );
        return false;
      }
    }

    // Min should not be greater than max
    if (salary.min !== null && salary.max !== null && salary.min > salary.max) {
      console.debug(
        `  ✗ Salary validation failed: min (${min}) > max (${max})`
      );
      return false;
    }

    // Range should not be too extreme (max should not be more than 3x min)
    if (
      salary.min !== null &&
      salary.max !== null &&
      salary.max > salary.min * 3
    ) {
      console.debug(
        `  ✗ Salary validation failed: range too extreme (max > 3x min)`
      );
      return false;
    }
  }

  return true;
}

/**
 * Uses Ollama to extract salary information from text
 */
async function extractSalaryWithOllama(
  text: string,
  model: string
): Promise<SalaryInfo | null> {
  try {
    const ollama = getOllamaClient();

    // Limit text to 15000 characters for faster processing
    const textToAnalyze = text.substring(0, 15000);

    const prompt = `You are a salary extraction expert. Extract salary information from this job posting text.

Job posting text:
${textToAnalyze}

IMPORTANT RULES:
1. Look for salary, compensation, pay, or wage information
2. Convert all amounts to actual numbers (e.g., "80k" = 80000, "120K" = 120000, "100'000" = 100000)
3. If you find a range (e.g., "80-120k" or "CHF 100'000 - CHF 150'000"), extract both min and max
4. If you find only one amount, set BOTH min and max to that amount
5. Currency codes: Use 3-letter codes (USD, EUR, GBP, CHF, CAD, AUD)
6. Period: yearly, monthly, weekly, daily, or hourly (infer from context if not explicit)
7. Ignore small numbers that are clearly NOT salaries (like "2 years experience" or "5 days vacation")
8. If no salary is found, return all null values

Return ONLY a JSON object with this EXACT structure:
{
  "min": <number or null>,
  "max": <number or null>,
  "currency": "<3-letter code or null>",
  "period": "<yearly|monthly|weekly|daily|hourly or null>"
}

Examples:
Input: "Salary: CHF 100'000 - CHF 150'000 per year"
Output: {"min": 100000, "max": 150000, "currency": "CHF", "period": "yearly"}

Input: "€60k-€80k annually"
Output: {"min": 60000, "max": 80000, "currency": "EUR", "period": "yearly"}

Input: "Competitive salary based on experience"
Output: {"min": null, "max": null, "currency": null, "period": null}

Input: "$150/hour"
Output: {"min": 150, "max": 150, "currency": "USD", "period": "hourly"}

Now analyze the text and return ONLY the JSON object:`;

    console.debug(`  → Sending ${textToAnalyze.length} chars to Ollama...`);

    const response = await ollama.generate({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 300,
      },
    });

    console.debug(
      `  → Ollama response: ${response.response.substring(0, 200)}`
    );

    // Extract JSON from response
    const jsonMatch = response.response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.debug("  ✗ Ollama salary extraction: No JSON found in response");
      return null;
    }

    const salaryData = JSON.parse(jsonMatch[0]);
    console.debug(`  → Parsed salary data: ${JSON.stringify(salaryData)}`);

    // Validate the structure
    if (typeof salaryData !== "object") {
      console.debug("  ✗ Ollama salary extraction: Invalid data structure");
      return null;
    }

    const extractedSalary: SalaryInfo = {
      min: salaryData.min !== null ? Number(salaryData.min) : null,
      max: salaryData.max !== null ? Number(salaryData.max) : null,
      currency: salaryData.currency || null,
      period: salaryData.period || null,
    };

    // Validate the salary values
    if (!validateSalary(extractedSalary)) {
      console.debug("  ✗ Ollama extraction returned invalid salary values");
      return null;
    }

    return extractedSalary;
  } catch (error) {
    console.debug(
      `  ✗ Ollama salary extraction error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

/**
 * Extracts salary information from HTML using Ollama (with regex fallback)
 */
export async function extractSalary(
  html: string,
  model?: string
): Promise<SalaryInfo> {
  const $ = cheerio.load(html);

  // Combine text from salary selectors and general content
  let salaryText = "";

  // Try specific salary selectors first
  for (const selector of SALARY_SELECTORS) {
    const elements = $(selector);
    elements.each((_, el) => {
      salaryText += " " + $(el).text();
    });
  }

  // If no salary found in specific selectors, search full text
  if (!salaryText.trim()) {
    salaryText = $("body").text();
  }

  // Try Ollama extraction if model is provided
  if (model) {
    console.debug("  → Extracting salary with Ollama...");
    const ollamaSalary = await extractSalaryWithOllama(salaryText, model);
    if (
      ollamaSalary &&
      (ollamaSalary.min !== null || ollamaSalary.max !== null)
    ) {
      console.debug("  ✓ Salary extracted via Ollama");
      return ollamaSalary;
    }
    console.debug("  ✗ Ollama extraction failed, falling back to regex");
  }

  // Fallback to regex-based extraction
  console.debug("  → Trying regex-based extraction...");
  const regexSalary = parseSalaryFromText(salaryText);

  // Validate regex results
  if (validateSalary(regexSalary)) {
    if (regexSalary.min !== null || regexSalary.max !== null) {
      console.debug(
        `  ✓ Regex extracted: ${regexSalary.min}-${regexSalary.max} ${regexSalary.currency} (${regexSalary.period})`
      );
    }
    return regexSalary;
  } else {
    console.debug(
      "  ✗ Regex extraction returned invalid values, returning null"
    );
    return { min: null, max: null, currency: null, period: null };
  }
}

/**
 * Parses salary information from text
 * Handles formats like:
 * - "$80,000 - $120,000"
 * - "€60k-€80k per year"
 * - "CHF 100'000"
 * - "50-60k USD/year"
 * - "$100/hour"
 */
export function parseSalaryFromText(text: string): SalaryInfo {
  // Common currency symbols and codes
  const currencies = [
    "USD",
    "EUR",
    "CHF",
    "GBP",
    "CAD",
    "AUD",
    "$",
    "€",
    "£",
    "Fr.",
  ];

  // Period keywords
  const periods: Record<
    string,
    "yearly" | "monthly" | "weekly" | "daily" | "hourly"
  > = {
    year: "yearly",
    yearly: "yearly",
    annual: "yearly",
    pa: "yearly",
    "p.a.": "yearly",
    month: "monthly",
    monthly: "monthly",
    week: "weekly",
    weekly: "weekly",
    day: "daily",
    daily: "daily",
    hour: "hourly",
    hourly: "hourly",
    "/h": "hourly",
  };

  // Regex patterns for salary ranges
  // Matches: $80,000 - $120,000 or 80k-120k or €60.000-€80.000 or €80.000,50
  // Note: k/K suffix must come before general number pattern to match first
  // Decimal separator can be dot or comma (followed by 1-2 digits)
  const rangePattern =
    /(?:(\$|€|£|CHF|USD|EUR|GBP|Fr\.)\s*)?(\d+(?:k|K)|\d{1,3}(?:[',.\s]\d{3})*(?:[.,]\d{1,2})?)(?:\s*(?:-|to|bis)\s*)(?:(\$|€|£|CHF|USD|EUR|GBP|Fr\.)\s*)?(\d+(?:k|K)|\d{1,3}(?:[',.\s]\d{3})*(?:[.,]\d{1,2})?)/gi;

  // Single salary pattern
  // Note: k/K suffix must come before general number pattern to match first
  // Decimal separator can be dot or comma (followed by 1-2 digits)
  const singlePattern =
    /(?:(\$|€|£|CHF|USD|EUR|GBP|Fr\.)\s*)?(\d+(?:k|K)|\d{1,3}(?:[',.\s]\d{3})*(?:[.,]\d{1,2})?)(?!\s*(?:-|to|bis)\s*\d)/gi;

  let salary: SalaryInfo = {
    min: null,
    max: null,
    currency: null,
    period: null,
  };

  // Try to extract range first
  const rangeMatches = Array.from(text.matchAll(rangePattern));
  if (rangeMatches.length > 0) {
    const match = rangeMatches[0];
    const currency1 = match[1] || match[3];
    const minStr = match[2];
    const maxStr = match[4];
    let min = parseNumber(minStr);
    let max = parseNumber(maxStr);

    if (min !== null && max !== null) {
      // Handle case where k suffix applies to only one number in range
      // E.g., "50-60k" should be interpreted as "50k-60k"
      const minHasK = /k$/i.test(minStr);
      const maxHasK = /k$/i.test(maxStr);

      if (maxHasK && !minHasK && min < 1000) {
        // Max has k but min doesn't, and min is small enough to need k
        min = min * 1000;
      } else if (minHasK && !maxHasK && max < 1000) {
        // Min has k but max doesn't, and max is small enough to need k
        max = max * 1000;
      }

      salary.min = min;
      salary.max = max;
      salary.currency = normalizeCurrency(currency1);
    }
  } else {
    // Try single salary
    const singleMatches = Array.from(text.matchAll(singlePattern));
    if (singleMatches.length > 0) {
      const match = singleMatches[0];
      const currency = match[1];
      const amount = parseNumber(match[2]);

      if (amount !== null) {
        salary.min = amount;
        salary.max = amount;
        salary.currency = normalizeCurrency(currency);
      }
    }
  }

  // Detect period
  const lowerText = text.toLowerCase();
  for (const [keyword, period] of Object.entries(periods)) {
    if (lowerText.includes(keyword)) {
      salary.period = period;
      break;
    }
  }

  // Infer period from salary amount if not found
  if (!salary.period && salary.min) {
    if (salary.min < 500) {
      salary.period = "hourly";
    } else if (salary.min < 10000) {
      salary.period = "monthly";
    } else {
      salary.period = "yearly";
    }
  }

  // Try to extract currency from text if not found
  if (!salary.currency && (salary.min || salary.max)) {
    for (const curr of currencies) {
      if (text.includes(curr)) {
        salary.currency = normalizeCurrency(curr);
        break;
      }
    }
  }

  return salary;
}

/**
 * Parses a number string (handles k/K suffix and various formats)
 */
function parseNumber(str: string): number | null {
  if (!str) return null;

  // Remove spaces
  str = str.replace(/\s/g, "");

  // Handle k/K suffix (thousands)
  if (str.toLowerCase().endsWith("k")) {
    const num = parseFloat(str.slice(0, -1).replace(/[',]/g, ""));
    return isNaN(num) ? null : num * 1000;
  }

  // Remove thousand separators (', or .)
  // European format: 80.000,50 or Swiss: 80'000.50
  // US format: 80,000.50

  // Detect format based on the position of the last separator relative to string length
  // Decimal separators are followed by 1-2 digits, thousand separators by 3+ digits
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const lastApostrophe = str.lastIndexOf("'");

  // Find which separator comes last
  const lastSeparatorPos = Math.max(lastComma, lastDot, lastApostrophe);

  if (lastSeparatorPos === -1) {
    // No separators, just parse as is
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  // Check how many digits follow the last separator
  const digitsAfterSeparator = str.length - lastSeparatorPos - 1;

  let cleaned = str;

  if (digitsAfterSeparator <= 2 && digitsAfterSeparator > 0) {
    // Last separator is likely a decimal separator (1-2 digits after it)
    if (lastComma === lastSeparatorPos) {
      // European: comma is decimal, dots and apostrophes are thousands
      cleaned = str.replace(/['.]/g, "").replace(",", ".");
    } else {
      // US/Swiss: dot is decimal, commas and apostrophes are thousands
      cleaned = str.replace(/[',]/g, "");
    }
  } else {
    // Last separator has 3+ digits after it, so it's a thousand separator
    // This means there's no decimal part, remove all separators
    cleaned = str.replace(/[',.\s]/g, "");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalizes currency to standard 3-letter code
 */
function normalizeCurrency(currency: string | undefined): string | null {
  if (!currency) return null;

  const currencyMap: Record<string, string> = {
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    CHF: "CHF",
    "Fr.": "CHF",
    USD: "USD",
    EUR: "EUR",
    GBP: "GBP",
    CAD: "CAD",
    AUD: "AUD",
  };

  return currencyMap[currency.trim()] || currency.trim().toUpperCase();
}

/**
 * Checks if a URL is accessible
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Scrapes a job page and returns the description
 */
export async function scrapeJobPage(
  url: string,
  model?: string
): Promise<{
  description: string;
  title: string | null;
  salary: SalaryInfo;
  error: string | null;
}> {
  try {
    console.debug(`Fetching job page: ${url}`);

    const html = await fetchPageHtml(url);

    // Extract title first (needed for formatted description)
    const title = extractJobTitle(html);

    // Extract description with Ollama formatting if model is provided
    const description = await extractJobDescription(html, title, model);

    // Extract salary
    const salary = await extractSalary(html, model);

    if (!description || description.length < 100) {
      return {
        description: "",
        title,
        salary,
        error: "Could not extract meaningful job description",
      };
    }

    return {
      description,
      title,
      salary,
      error: null,
    };
  } catch (error) {
    return {
      description: "",
      title: null,
      salary: { min: null, max: null, currency: null, period: null },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
