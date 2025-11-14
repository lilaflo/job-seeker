-- Migration: Create platforms table for crawl control
-- Purpose: Track job platforms and control which can be crawled based on technical limitations
-- Created: 2025-11-14
-- Updated: 2025-11-14 - Changed domain to hostname (TLD-agnostic)

CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_name TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  can_crawl INTEGER NOT NULL DEFAULT 1 CHECK(can_crawl IN (0, 1)),
  skip_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_platforms_hostname ON platforms(hostname);
CREATE INDEX IF NOT EXISTS idx_platforms_can_crawl ON platforms(can_crawl);

-- Add platform_id to emails table for tracking email source
ALTER TABLE emails ADD COLUMN platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_emails_platform_id ON emails(platform_id);

-- Seed platforms from known job boards and freelance platforms
-- Note: hostname is stored without TLD (e.g., 'linkedin' not 'linkedin.com')
-- This makes matching TLD-agnostic (linkedin.com, linkedin.de, linkedin.co.uk all match)

-- Freelance platforms
INSERT INTO platforms (platform_name, hostname, can_crawl) VALUES
('FreelancerMap', 'freelancermap', 1),
('Upwork', 'upwork', 1),
('Freelancer', 'freelancer', 1),
('Fiverr', 'fiverr', 1),
('Toptal', 'toptal', 1),
('Guru', 'guru', 1),
('PeoplePerHour', 'peopleperhour', 1),
('Twago', 'twago', 1),
('Malt', 'malt', 1),
('99designs', '99designs', 1);

-- German/Swiss job boards
INSERT INTO platforms (platform_name, hostname, can_crawl) VALUES
('Jobs.ch', 'jobs', 1),
('StepStone', 'stepstone', 1),
('XING', 'xing', 1),
('Kununu', 'kununu', 1),
('Jobware', 'jobware', 1),
('Stellenanzeigen', 'stellenanzeigen', 1),
('JobVector', 'jobvector', 1),
('MeineStadt', 'meinestadt', 1),
('Kalaydo', 'kalaydo', 1),
('Arbeitsagentur', 'arbeitsagentur', 1);

-- International job boards
INSERT INTO platforms (platform_name, hostname, can_crawl, skip_reason) VALUES
('Indeed', 'indeed', 1, NULL),
('LinkedIn', 'linkedin', 0, 'Requires multi-level authentication (username, password, mobile app)'),
('Glassdoor', 'glassdoor', 1, NULL),
('Monster', 'monster', 1, NULL),
('ZipRecruiter', 'ziprecruiter', 1, NULL),
('Dice', 'dice', 1, NULL),
('CareerBuilder', 'careerbuilder', 1, NULL),
('SimplyHired', 'simplyhired', 1, NULL),
('Hired', 'hired', 1, NULL),
('Wellfound', 'wellfound', 1, NULL),
('AngelList', 'angellist', 1, NULL),
('Experteer', 'experteer', 1, NULL);

-- Tech-specific job boards
INSERT INTO platforms (platform_name, hostname, can_crawl) VALUES
('Stack Overflow', 'stackoverflow', 1),
('GitHub Jobs', 'github', 1),
('We Work Remotely', 'weworkremotely', 1),
('Remote OK', 'remoteok', 1),
('Remote.co', 'remote', 1),
('FlexJobs', 'flexjobs', 1),
('Authentic Jobs', 'authenticjobs', 1),
('Hacker.io', 'hacker', 1),
('Angel.co', 'angel', 1);

-- Applicant tracking systems
INSERT INTO platforms (platform_name, hostname, can_crawl) VALUES
('Greenhouse', 'greenhouse', 1),
('Lever', 'lever', 1),
('Workday', 'workday', 1),
('SmartRecruiters', 'smartrecruiters', 1),
('Recruitee', 'recruitee', 1),
('Breezy HR', 'breezy', 1),
('Workable', 'workable', 1),
('Jobvite', 'jobvite', 1),
('iCIMS', 'icims', 1),
('Taleo', 'taleo', 1);

-- Recruitment agencies
INSERT INTO platforms (platform_name, hostname, can_crawl) VALUES
('Hays', 'hays', 1),
('Adecco', 'adecco', 1),
('Randstad', 'randstad', 1),
('Manpower', 'manpower', 1),
('Robert Walters', 'robertwalters', 1),
('Michael Page', 'michaelpage', 1);

-- Other platforms
INSERT INTO platforms (platform_name, hostname, can_crawl) VALUES
('Jobspotting', 'jobspotting', 1),
('Adzuna', 'adzuna', 1),
('Jooble', 'jooble', 1),
('Neuvoo', 'neuvoo', 1);
