-- Migration: Create platforms table for crawl control
-- Purpose: Track job platforms and control which can be crawled based on technical limitations
-- Created: 2025-11-14

CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  can_crawl INTEGER NOT NULL DEFAULT 1 CHECK(can_crawl IN (0, 1)),
  skip_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_platforms_domain ON platforms(domain);
CREATE INDEX IF NOT EXISTS idx_platforms_can_crawl ON platforms(can_crawl);

-- Seed platforms from known job boards and freelance platforms
-- Freelance platforms
INSERT INTO platforms (platform_name, domain, can_crawl) VALUES
('FreelancerMap DE', 'freelancermap.de', 1),
('FreelancerMap', 'freelancermap.com', 1),
('Upwork', 'upwork.com', 1),
('Freelancer', 'freelancer.com', 1),
('Fiverr', 'fiverr.com', 1),
('Toptal', 'toptal.com', 1),
('Guru', 'guru.com', 1),
('PeoplePerHour', 'peopleperhour.com', 1),
('Twago DE', 'twago.de', 1),
('Twago', 'twago.com', 1),
('Malt', 'malt.com', 1),
('Malt DE', 'malt.de', 1),
('99designs', '99designs.com', 1);

-- German job boards
INSERT INTO platforms (platform_name, domain, can_crawl) VALUES
('Indeed DE', 'indeed.de', 1),
('StepStone', 'stepstone.de', 1),
('Monster DE', 'monster.de', 1),
('XING', 'xing.com', 1),
('Kununu', 'kununu.com', 1),
('Jobware', 'jobware.de', 1),
('Stellenanzeigen', 'stellenanzeigen.de', 1),
('JobVector', 'jobvector.de', 1),
('MeineStadt', 'meinestadt.de', 1),
('Kalaydo', 'kalaydo.de', 1),
('Arbeitsagentur', 'jobboerse.arbeitsagentur.de', 1);

-- International job boards
INSERT INTO platforms (platform_name, domain, can_crawl, skip_reason) VALUES
('Indeed', 'indeed.com', 1, NULL),
('LinkedIn', 'linkedin.com', 0, 'Requires multi-level authentication (username, password, mobile app)'),
('Glassdoor', 'glassdoor.com', 1, NULL),
('Monster', 'monster.com', 1, NULL),
('ZipRecruiter', 'ziprecruiter.com', 1, NULL),
('Dice', 'dice.com', 1, NULL),
('CareerBuilder', 'careerbuilder.com', 1, NULL),
('SimplyHired', 'simplyhired.com', 1, NULL),
('Hired', 'hired.com', 1, NULL),
('Wellfound', 'wellfound.com', 1, NULL),
('AngelList', 'angellist.com', 1, NULL);

-- Tech-specific job boards
INSERT INTO platforms (platform_name, domain, can_crawl) VALUES
('Stack Overflow', 'stackoverflow.com', 1),
('GitHub Jobs', 'github.jobs', 1),
('We Work Remotely', 'weworkremotely.com', 1),
('Remote OK', 'remoteok.com', 1),
('Remote.co', 'remote.co', 1),
('FlexJobs', 'flexjobs.com', 1),
('Authentic Jobs', 'authenticjobs.com', 1),
('Hacker.io', 'hacker.io', 1),
('Angel.co', 'angel.co', 1);

-- Applicant tracking systems
INSERT INTO platforms (platform_name, domain, can_crawl) VALUES
('Greenhouse', 'greenhouse.io', 1),
('Lever', 'lever.co', 1),
('Workday', 'workday.com', 1),
('SmartRecruiters', 'smartrecruiters.com', 1),
('Recruitee', 'recruitee.com', 1),
('Breezy HR', 'breezy.hr', 1),
('Workable', 'workable.com', 1),
('Jobvite', 'jobvite.com', 1),
('iCIMS', 'icims.com', 1),
('Taleo', 'taleo.net', 1);

-- Recruitment agencies
INSERT INTO platforms (platform_name, domain, can_crawl) VALUES
('Hays DE', 'hays.de', 1),
('Hays', 'hays.com', 1),
('Adecco DE', 'adecco.de', 1),
('Adecco', 'adecco.com', 1),
('Randstad DE', 'randstad.de', 1),
('Randstad', 'randstad.com', 1),
('Manpower DE', 'manpower.de', 1),
('Manpower', 'manpower.com', 1),
('Robert Walters', 'robertwalters.com', 1),
('Michael Page DE', 'michaelpage.de', 1),
('Michael Page', 'michaelpage.com', 1);

-- Other platforms
INSERT INTO platforms (platform_name, domain, can_crawl) VALUES
('Jobspotting', 'jobspotting.com', 1),
('Adzuna DE', 'adzuna.de', 1),
('Adzuna', 'adzuna.com', 1),
('Jooble', 'jooble.org', 1),
('Neuvoo DE', 'neuvoo.de', 1),
('Neuvoo', 'neuvoo.com', 1);
