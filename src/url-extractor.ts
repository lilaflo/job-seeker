/**
 * URL Extractor Module
 * Extracts job-related URLs from email content
 */

/**
 * Common job board URL patterns to detect job posting URLs
 */
const JOB_URL_PATTERNS = [
  // LinkedIn
  /https?:\/\/(www\.)?linkedin\.com\/jobs\/view\/\d+/gi,
  // Indeed (supports www., country codes like ch., and direct domain)
  /https?:\/\/(www\.|[a-z]{2}\.)?indeed\.[a-z]{2,3}\/.*?viewjob/gi,
  /https?:\/\/(www\.|[a-z]{2}\.)?indeed\.[a-z]{2,3}\/rc\/clk/gi,
  /https?:\/\/(www\.|[a-z]{2}\.)?indeed\.[a-z]{2,3}\/pagead\/clk/gi,
  /https?:\/\/(www\.|[a-z]{2}\.)?indeed\.[a-z]{2,3}\/jobs\?/gi,
  // Freelancermap
  /https?:\/\/(www\.)?freelancermap\.(de|com)\/projektboerse\/project\/\d+/gi,
  /https?:\/\/(www\.)?freelancermap\.(de|com)\/projekt\//gi,
  // Upwork
  /https?:\/\/(www\.)?upwork\.com\/jobs\//gi,
  // StepStone
  /https?:\/\/(www\.)?stepstone\.(de|com)\/.*?stellenangebote/gi,
  // Xing
  /https?:\/\/(www\.)?xing\.com\/jobs\//gi,
  // Monster
  /https?:\/\/(www\.)?monster\.(com|de|uk)\/.*?job-openings/gi,
  // Glassdoor
  /https?:\/\/(www\.)?glassdoor\.(com|de)\/job-listing\//gi,
  // Dice
  /https?:\/\/(www\.)?dice\.com\/jobs\//gi,
  // Stack Overflow
  /https?:\/\/stackoverflow\.com\/jobs\//gi,
  // WeWorkRemotely
  /https?:\/\/weworkremotely\.com\/remote-jobs\//gi,
  // RemoteOK
  /https?:\/\/remoteok\.com\/remote-jobs\//gi,
  // AngelList / Wellfound
  /https?:\/\/(www\.)?(angel\.co|wellfound\.com)\/.*?\/jobs\//gi,
  // Greenhouse
  /https?:\/\/boards\.greenhouse\.io\/.*?\/jobs\//gi,
  /https?:\/\/.*?\.greenhouse\.io\/.*?\/jobs\//gi,
  // Lever
  /https?:\/\/jobs\.lever\.co\//gi,
  // Workday
  /https?:\/\/.*?\.wd\d+\.myworkdayjobs\.com\//gi,
  // SmartRecruiters
  /https?:\/\/jobs\.smartrecruiters\.com\//gi,
  // Generic job URLs (company career pages)
  /https?:\/\/.*?\/(careers?|jobs?)\/.*?/gi,
  /https?:\/\/.*?\/apply\/.*?/gi,
];

/**
 * Extracts all URLs from text
 */
export function extractAllUrls(text: string): string[] {
  if (!text) return [];

  // Match all URLs (http/https)
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = text.match(urlRegex);

  if (!matches) return [];

  // Clean up URLs (remove trailing punctuation, markdown, etc.)
  return matches
    .map((url) => {
      // Remove trailing punctuation
      url = url.replace(/[.,;:!?)\]}>]+$/, "");
      // Remove markdown link syntax
      url = url.replace(/\)$/, "");
      return url;
    })
    .filter((url) => url.length > 0);
}

/**
 * Filters URLs to only include job-related URLs
 */
export function extractJobUrls(text: string): string[] {
  const allUrls = extractAllUrls(text);

  // First, check against known job board patterns
  const jobUrls = allUrls.filter((url) => {
    return JOB_URL_PATTERNS.some((pattern) => pattern.test(url));
  });

  // If no matches from patterns, look for URLs containing job-related keywords
  if (jobUrls.length === 0) {
    const jobKeywords = [
      "/job/",
      "/jobs/",
      "/career/",
      "/careers/",
      "/apply/",
      "/application/",
      "/position/",
      "/vacancy/",
      "/vacancies/",
      "/opening/",
      "/stellenangebot/",
      "/projekt/",
      "/project/",
    ];

    return allUrls.filter((url) => {
      const lowerUrl = url.toLowerCase();
      return jobKeywords.some((keyword) => lowerUrl.includes(keyword));
    });
  }

  return jobUrls;
}

/**
 * Extracts job title and URL pairs from email body
 * Looks for pattern: "Title - URL"
 */
export function extractJobsWithTitles(body: string): Array<{ title: string; url: string }> {
  if (!body) return [];

  const results: Array<{ title: string; url: string }> = [];
  const lines = body.split('\n');

  // Words/phrases that indicate a line is NOT a job title
  const skipPatterns = [
    /easily apply/i,
    /days? ago/i,
    /hours? ago/i,
    /^(new|indeed|job alert|jobs? \d+)/i,
    /^see matching/i,
    /^https?:\/\//,
    /^$/,  // empty lines
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Pattern 1: Look for lines with " - https://" pattern (title - URL)
    const inlineMatch = line.match(/^(.+?)\s+-\s+(https?:\/\/[^\s]+)/);
    if (inlineMatch) {
      let title = inlineMatch[1].trim();
      const url = inlineMatch[2].trim();

      const cleanUrl = url
        .replace(/&amp;/g, '&')
        .replace(/[.,;:!?)\]}>]+$/, '');

      if (JOB_URL_PATTERNS.some((pattern) => pattern.test(cleanUrl)) ||
          cleanUrl.toLowerCase().includes('/job') ||
          cleanUrl.toLowerCase().includes('/vacanc')) {
        results.push({ title, url: cleanUrl });
      }
      continue;
    }

    // Pattern 2: Look for standalone URLs (Indeed format)
    const urlMatch = line.match(/^(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      const cleanUrl = url
        .replace(/&amp;/g, '&')
        .replace(/[.,;:!?)\]}>]+$/, '');

      // Only process job URLs
      if (!(JOB_URL_PATTERNS.some((pattern) => pattern.test(cleanUrl)) ||
            cleanUrl.toLowerCase().includes('/job') ||
            cleanUrl.toLowerCase().includes('/vacanc'))) {
        continue;
      }

      // Look backwards up to 10 lines to find the job title
      let title = '';
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const candidateLine = lines[j].trim();

        // Skip lines that are clearly not titles
        if (skipPatterns.some(pattern => pattern.test(candidateLine))) {
          continue;
        }

        // A good job title is typically 10-100 characters
        if (candidateLine.length >= 10 && candidateLine.length <= 100) {
          // Reject suspicious "titles" that are likely not job titles
          const suspiciousPatterns = [
            /^just posted$/i,
            /^new$/i,
            /^today$/i,
            /^yesterday$/i,
            /^\d+\s+(day|hour|minute)s?\s+ago$/i,
          ];

          if (!suspiciousPatterns.some(pattern => pattern.test(candidateLine))) {
            title = candidateLine;
            break;
          }
        }
      }

      if (title) {
        results.push({ title, url: cleanUrl });
      }
    }
  }

  return results;
}

/**
 * Extracts a job title from email subject or body
 * Tries to intelligently parse the subject line
 */
export function extractJobTitle(subject: string | null, body?: string): string {
  if (!subject) {
    return "Job Opportunity";
  }

  // Remove common email prefixes
  let title = subject
    .replace(/^(Re:|Fwd?:|AW:)\s*/gi, "")
    .replace(/^\[.*?\]\s*/g, "")
    .trim();

  // Remove common job email subject patterns to extract actual job title
  const jobPatterns = [
    /^complete your application for\s+/i,
    /^apply for\s+/i,
    /^new job:?\s+/i,
    /^job alert:?\s+/i,
    /^job opportunity:?\s+/i,
    /^hiring:?\s+/i,
    /^we're hiring:?\s+/i,
    /^\d+\s+new jobs?:?\s+/i,
    /^\d+\s+new job offers? found:?\s*/i,
    /^„([^"]+)":\s+/,  // German pattern: „Job Title": ...
  ];

  for (const pattern of jobPatterns) {
    title = title.replace(pattern, '');
  }

  title = title.trim();

  // Remove trailing promotional phrases and metadata
  const trailingPatterns = [
    /\s*-\s+and \d+ more .* jobs? in .*/i,  // " - and 23 more it jobs in Location"
    /\s*-\s+\d+ more .* jobs? in .*/i,       // " - 23 more jobs in Location"
    /\s*\+\s+\d+ neue Jobs in .*/i,          // " + 30 neue Jobs in Location" (German)
    /\s*und weitere$/i,                       // " und weitere" (German)
    /\s*and more$/i,                          // " and more"
    /\s*for you!?$/i,                        // " for you!"
    /\s*[\[\(].*?[\]\)]$/g,                  // "[Company Name]" or "(Location)"
  ];

  for (const pattern of trailingPatterns) {
    title = title.replace(pattern, '');
  }

  title = title.trim();

  // If title is too short or generic, try to extract from body
  if (title.length < 10 && body) {
    // Look for common job title patterns in body
    const titlePatterns = [
      /position:\s*([^\n]+)/i,
      /role:\s*([^\n]+)/i,
      /job title:\s*([^\n]+)/i,
      /hiring for:\s*([^\n]+)/i,
    ];

    for (const pattern of titlePatterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }
  }

  // Limit length
  if (title.length > 200) {
    title = title.substring(0, 197) + "...";
  }

  return title || "Job Opportunity";
}

/**
 * Deduplicates URLs (removes tracking parameters, normalizes)
 */
export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduplicated: string[] = [];

  for (const url of urls) {
    try {
      const urlObj = new URL(url);

      // Create a normalized version without tracking parameters
      const commonTrackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
        "referer",
        "source",
        "trk",
        "tracking",
        "track",
        "email",
        "eid",
        "cid",
        "sid",
      ];

      commonTrackingParams.forEach((param) => {
        urlObj.searchParams.delete(param);
      });

      const normalized = urlObj.toString();

      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(url); // Keep original URL
      }
    } catch {
      // If URL parsing fails, just check for exact duplicates
      if (!seen.has(url)) {
        seen.add(url);
        deduplicated.push(url);
      }
    }
  }

  return deduplicated;
}
