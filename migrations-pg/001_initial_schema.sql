-- Initial PostgreSQL Schema with pgvector support
-- Migration: 001_initial_schema.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Platforms table
CREATE TABLE IF NOT EXISTS platforms (
  id SERIAL PRIMARY KEY,
  platform_name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255) NOT NULL UNIQUE,
  can_crawl SMALLINT NOT NULL DEFAULT 1 CHECK(can_crawl IN (0, 1)),
  skip_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  gmail_id VARCHAR(255) NOT NULL UNIQUE,
  subject TEXT,
  from_address VARCHAR(255),
  body TEXT,
  confidence VARCHAR(10) NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
  is_job_related SMALLINT NOT NULL CHECK(is_job_related IN (0, 1)),
  reason TEXT,
  processed SMALLINT NOT NULL DEFAULT 0 CHECK(processed IN (0, 1)),
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL,
  scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_confidence ON emails(confidence);
CREATE INDEX IF NOT EXISTS idx_emails_is_job_related ON emails(is_job_related);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  email_id INTEGER REFERENCES emails(id) ON DELETE SET NULL,
  salary_min NUMERIC(10, 2),
  salary_max NUMERIC(10, 2),
  salary_currency VARCHAR(10),
  salary_period VARCHAR(20) CHECK(salary_period IN ('yearly', 'monthly', 'weekly', 'daily', 'hourly')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  blacklisted SMALLINT NOT NULL DEFAULT 0 CHECK(blacklisted IN (0, 1)),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_link ON jobs(link);
CREATE INDEX IF NOT EXISTS idx_jobs_email_id ON jobs(email_id);
CREATE INDEX IF NOT EXISTS idx_jobs_blacklisted ON jobs(blacklisted);
CREATE INDEX IF NOT EXISTS idx_jobs_processing_status ON jobs(processing_status);

-- Job embeddings table (with pgvector)
CREATE TABLE IF NOT EXISTS job_embeddings (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  model VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_embeddings_job_id ON job_embeddings(job_id);
-- Note: For large datasets, consider using ivfflat or hnsw index
-- CREATE INDEX ON job_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Blacklist keywords table
CREATE TABLE IF NOT EXISTS blacklist (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL UNIQUE,
  embedding vector(384),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blacklist_keyword ON blacklist(keyword);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  skill_name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- Job-skill matches table
CREATE TABLE IF NOT EXISTS job_skill_matches (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  relevance NUMERIC(3, 2) CHECK(relevance >= 0 AND relevance <= 1),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_job_skill_matches_job_id ON job_skill_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skill_matches_skill_id ON job_skill_matches(skill_id);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20) NOT NULL CHECK(level IN ('error', 'warning', 'info', 'debug')),
  message TEXT NOT NULL,
  source VARCHAR(255),
  context TEXT,
  stack_trace TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Insert default platforms (same as SQLite version)
INSERT INTO platforms (platform_name, hostname, can_crawl, skip_reason) VALUES
  ('LinkedIn', 'linkedin', 0, 'Requires authentication'),
  ('Indeed', 'indeed', 1, NULL),
  ('Glassdoor', 'glassdoor', 1, NULL),
  ('Monster', 'monster', 1, NULL),
  ('CareerBuilder', 'careerbuilder', 1, NULL),
  ('Dice', 'dice', 1, NULL),
  ('SimplyHired', 'simplyhired', 1, NULL),
  ('ZipRecruiter', 'ziprecruiter', 1, NULL),
  ('FlexJobs', 'flexjobs', 1, NULL),
  ('Remote.co', 'remote', 1, NULL),
  ('We Work Remotely', 'weworkremotely', 1, NULL),
  ('RemoteOK', 'remoteok', 1, NULL),
  ('Stack Overflow Jobs', 'stackoverflow', 1, NULL),
  ('GitHub Jobs', 'github', 1, NULL),
  ('AngelList', 'angel', 1, NULL),
  ('Wellfound', 'wellfound', 1, NULL),
  ('Upwork', 'upwork', 1, NULL),
  ('Freelancer', 'freelancer', 1, NULL),
  ('Toptal', 'toptal', 1, NULL),
  ('Guru', 'guru', 1, NULL),
  ('Fiverr', 'fiverr', 1, NULL),
  ('PeoplePerHour', 'peopleperhour', 1, NULL),
  ('99designs', '99designs', 1, NULL),
  ('Freelancermap', 'freelancermap', 1, NULL),
  ('Twago', 'twago', 1, NULL),
  ('Malt', 'malt', 1, NULL),
  ('Xing', 'xing', 1, NULL),
  ('StepStone', 'stepstone', 1, NULL),
  ('Jobware', 'jobware', 1, NULL),
  ('Jobscout24', 'jobscout24', 1, NULL),
  ('Jobs.ch', 'jobs', 1, NULL),
  ('JobCloud', 'jobcloud', 1, NULL),
  ('JobUp', 'jobup', 1, NULL),
  ('Greenhouse', 'greenhouse', 1, NULL),
  ('Lever', 'lever', 1, NULL),
  ('Workday', 'workday', 1, NULL),
  ('SmartRecruiters', 'smartrecruiters', 1, NULL),
  ('Recruitee', 'recruitee', 1, NULL),
  ('Breezy HR', 'breezy', 1, NULL),
  ('Workable', 'workable', 1, NULL),
  ('Jobvite', 'jobvite', 1, NULL),
  ('iCIMS', 'icims', 1, NULL),
  ('Taleo', 'taleo', 1, NULL),
  ('Hays', 'hays', 1, NULL),
  ('Adecco', 'adecco', 1, NULL),
  ('Randstad', 'randstad', 1, NULL),
  ('Manpower', 'manpower', 1, NULL),
  ('Robert Walters', 'robertwalters', 1, NULL),
  ('Michael Page', 'michaelpage', 1, NULL),
  ('Kelly Services', 'kellyservices', 1, NULL),
  ('TEKsystems', 'teksystems', 1, NULL),
  ('Robert Half', 'roberthalf', 1, NULL),
  ('Experis', 'experis', 1, NULL),
  ('Modis', 'modis', 1, NULL),
  ('Huxley', 'huxley', 1, NULL),
  ('ComputerFutures', 'computerfutures', 1, NULL),
  ('Progressive Recruitment', 'progressive-recruitment', 1, NULL),
  ('Austin Fraser', 'austinfraser', 1, NULL),
  ('Nigel Frank', 'nigelfrank', 1, NULL),
  ('Jefferson Frank', 'jeffersonfrank', 1, NULL),
  ('Frank Recruitment Group', 'frankgroup', 1, NULL),
  ('Conexus', 'conexus', 1, NULL),
  ('Spring Professional', 'spring', 1, NULL),
  ('Page Personnel', 'pagepersonnel', 1, NULL),
  ('Office Angels', 'officeangels', 1, NULL),
  ('Badenoch + Clark', 'badenochandclark', 1, NULL),
  ('Computer People', 'computerpeople', 1, NULL),
  ('Crimson', 'crimsonweb', 1, NULL),
  ('Harvey Nash', 'harveynash', 1, NULL)
ON CONFLICT (hostname) DO NOTHING;
