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
  can_crawl BOOLEAN NOT NULL DEFAULT TRUE,
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
  is_job_related BOOLEAN NOT NULL,
  reason TEXT,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
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
  blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
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

-- Insert default platforms (using BOOLEAN values)
INSERT INTO platforms (platform_name, hostname, can_crawl, skip_reason) VALUES
  ('LinkedIn', 'linkedin', FALSE, 'Requires authentication'),
  ('Indeed', 'indeed', TRUE, NULL),
  ('Glassdoor', 'glassdoor', TRUE, NULL),
  ('Monster', 'monster', TRUE, NULL),
  ('CareerBuilder', 'careerbuilder', TRUE, NULL),
  ('Dice', 'dice', TRUE, NULL),
  ('SimplyHired', 'simplyhired', TRUE, NULL),
  ('ZipRecruiter', 'ziprecruiter', TRUE, NULL),
  ('FlexJobs', 'flexjobs', TRUE, NULL),
  ('Remote.co', 'remote', TRUE, NULL),
  ('We Work Remotely', 'weworkremotely', TRUE, NULL),
  ('RemoteOK', 'remoteok', TRUE, NULL),
  ('Stack Overflow Jobs', 'stackoverflow', TRUE, NULL),
  ('GitHub Jobs', 'github', TRUE, NULL),
  ('AngelList', 'angel', TRUE, NULL),
  ('Wellfound', 'wellfound', TRUE, NULL),
  ('Upwork', 'upwork', TRUE, NULL),
  ('Freelancer', 'freelancer', TRUE, NULL),
  ('Toptal', 'toptal', TRUE, NULL),
  ('Guru', 'guru', TRUE, NULL),
  ('Fiverr', 'fiverr', TRUE, NULL),
  ('PeoplePerHour', 'peopleperhour', TRUE, NULL),
  ('99designs', '99designs', TRUE, NULL),
  ('Freelancermap', 'freelancermap', TRUE, NULL),
  ('Twago', 'twago', TRUE, NULL),
  ('Malt', 'malt', TRUE, NULL),
  ('Xing', 'xing', TRUE, NULL),
  ('StepStone', 'stepstone', TRUE, NULL),
  ('Jobware', 'jobware', TRUE, NULL),
  ('Jobscout24', 'jobscout24', TRUE, NULL),
  ('Jobs.ch', 'jobs', TRUE, NULL),
  ('JobCloud', 'jobcloud', TRUE, NULL),
  ('JobUp', 'jobup', TRUE, NULL),
  ('Greenhouse', 'greenhouse', TRUE, NULL),
  ('Lever', 'lever', TRUE, NULL),
  ('Workday', 'workday', TRUE, NULL),
  ('SmartRecruiters', 'smartrecruiters', TRUE, NULL),
  ('Recruitee', 'recruitee', TRUE, NULL),
  ('Breezy HR', 'breezy', TRUE, NULL),
  ('Workable', 'workable', TRUE, NULL),
  ('Jobvite', 'jobvite', TRUE, NULL),
  ('iCIMS', 'icims', TRUE, NULL),
  ('Taleo', 'taleo', TRUE, NULL),
  ('Hays', 'hays', TRUE, NULL),
  ('Adecco', 'adecco', TRUE, NULL),
  ('Randstad', 'randstad', TRUE, NULL),
  ('Manpower', 'manpower', TRUE, NULL),
  ('Robert Walters', 'robertwalters', TRUE, NULL),
  ('Michael Page', 'michaelpage', TRUE, NULL),
  ('Kelly Services', 'kellyservices', TRUE, NULL),
  ('TEKsystems', 'teksystems', TRUE, NULL),
  ('Robert Half', 'roberthalf', TRUE, NULL),
  ('Experis', 'experis', TRUE, NULL),
  ('Modis', 'modis', TRUE, NULL),
  ('Huxley', 'huxley', TRUE, NULL),
  ('ComputerFutures', 'computerfutures', TRUE, NULL),
  ('Progressive Recruitment', 'progressive-recruitment', TRUE, NULL),
  ('Austin Fraser', 'austinfraser', TRUE, NULL),
  ('Nigel Frank', 'nigelfrank', TRUE, NULL),
  ('Jefferson Frank', 'jeffersonfrank', TRUE, NULL),
  ('Frank Recruitment Group', 'frankgroup', TRUE, NULL),
  ('Conexus', 'conexus', TRUE, NULL),
  ('Spring Professional', 'spring', TRUE, NULL),
  ('Page Personnel', 'pagepersonnel', TRUE, NULL),
  ('Office Angels', 'officeangels', TRUE, NULL),
  ('Badenoch + Clark', 'badenochandclark', TRUE, NULL),
  ('Computer People', 'computerpeople', TRUE, NULL),
  ('Crimson', 'crimsonweb', TRUE, NULL),
  ('Harvey Nash', 'harveynash', TRUE, NULL)
ON CONFLICT (hostname) DO NOTHING;
