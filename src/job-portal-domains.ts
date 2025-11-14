/**
 * List of known job board and freelance platform domains
 * Emails from these domains are 100% job/project-related
 */
export const JOB_PORTAL_DOMAINS = [
  // Freelance platforms
  'freelancermap.de',
  'freelancermap.com',
  'upwork.com',
  'freelancer.com',
  'fiverr.com',
  'toptal.com',
  'guru.com',
  'peopleperhour.com',
  'twago.de',
  'twago.com',
  'malt.com',
  'malt.de',
  '99designs.com',

  // German job boards
  'indeed.de',
  'stepstone.de',
  'monster.de',
  'xing.com',
  'kununu.com',
  'jobware.de',
  'stellenanzeigen.de',
  'jobvector.de',
  'meinestadt.de',
  'kalaydo.de',
  'jobboerse.arbeitsagentur.de',

  // International job boards
  'indeed.com',
  'linkedin.com',
  'glassdoor.com',
  'monster.com',
  'ziprecruiter.com',
  'dice.com',
  'careerbuilder.com',
  'simplyhired.com',
  'hired.com',
  'wellfound.com',
  'angellist.com',

  // Tech-specific job boards
  'stackoverflow.com',
  'github.jobs',
  'weworkremotely.com',
  'remoteok.com',
  'remote.co',
  'flexjobs.com',
  'authenticjobs.com',
  'hacker.io',
  'angel.co',

  // Applicant tracking systems
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'smartrecruiters.com',
  'recruitee.com',
  'breezy.hr',
  'workable.com',
  'jobvite.com',
  'icims.com',
  'taleo.net',

  // Recruitment agencies (common ones)
  'hays.de',
  'hays.com',
  'adecco.de',
  'adecco.com',
  'randstad.de',
  'randstad.com',
  'manpower.de',
  'manpower.com',
  'robertwalters.com',
  'michaelpage.de',
  'michaelpage.com',

  // Other platforms
  'jobspotting.com',
  'adzuna.de',
  'adzuna.com',
  'jooble.org',
  'neuvoo.de',
  'neuvoo.com',
];

/**
 * Extracts domain from email address
 */
export function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)/);
  if (!match) return '';

  // Clean up the domain (remove whitespace, convert to lowercase)
  let domain = match[1].toLowerCase().trim();

  // Remove any trailing characters like ) or >
  domain = domain.replace(/[>\)\]]+$/, '');

  return domain;
}

/**
 * Checks if email is from a known job portal domain
 */
export function isFromJobPortal(email: string): boolean {
  if (!email) return false;

  const domain = extractDomain(email);
  if (!domain) return false;

  // Check if domain matches exactly or is a subdomain of a job portal
  return JOB_PORTAL_DOMAINS.some(jobDomain => {
    return domain === jobDomain || domain.endsWith('.' + jobDomain);
  });
}
