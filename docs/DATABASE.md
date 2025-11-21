# Database Guide

[← Back to README](../README.md)

Complete guide to the PostgreSQL database schema, queries, and migrations.

## Database Overview

Job Seeker uses **PostgreSQL 14+** with the **pgvector extension** for vector similarity search.

**Connection details:**
- Database: `jobseeker`
- Default port: `5432`
- Vector dimensions: 384 (nomic-embed-text model)

## Schema

### emails table

Stores scanned emails with sender tracking and platform association.

```sql
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  gmail_id TEXT NOT NULL UNIQUE,
  subject TEXT,
  from_address TEXT,                    -- Sender email for platform detection
  body TEXT,                             -- NULL for low/medium confidence
  confidence TEXT NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
  is_job_related BOOLEAN NOT NULL,
  reason TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL,
  scanned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX idx_emails_confidence ON emails(confidence);
CREATE INDEX idx_emails_is_job_related ON emails(is_job_related);
CREATE INDEX idx_emails_processed ON emails(processed);
CREATE INDEX idx_emails_from_address ON emails(from_address);
CREATE INDEX idx_emails_platform_id ON emails(platform_id);
CREATE INDEX idx_emails_created_at ON emails(created_at);
```

**Smart storage strategy:**
- **High confidence**: Stores full email body
- **Low/medium confidence**: Body is NULL (saves space)

### jobs table

Tracks job postings with salary, description, and status.

```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,           -- Prevents duplicates
  email_id INTEGER REFERENCES emails(id) ON DELETE SET NULL,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,                -- EUR, USD, GBP, CHF
  salary_period TEXT CHECK(salary_period IN ('yearly', 'monthly', 'weekly', 'daily', 'hourly')),
  description TEXT,                    -- AI-generated summary
  processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed')),
  is_blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  scanned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_link ON jobs(link);
CREATE INDEX idx_jobs_email_id ON jobs(email_id);
CREATE INDEX idx_jobs_salary_min ON jobs(salary_min);
CREATE INDEX idx_jobs_salary_max ON jobs(salary_max);
CREATE INDEX idx_jobs_currency ON jobs(salary_currency);
CREATE INDEX idx_jobs_period ON jobs(salary_period);
CREATE INDEX idx_jobs_description ON jobs(description);
CREATE INDEX idx_jobs_status ON jobs(processing_status);
CREATE INDEX idx_jobs_blacklisted ON jobs(is_blacklisted);
```

### platforms table

Manages job platforms and crawlability.

```sql
CREATE TABLE platforms (
  id SERIAL PRIMARY KEY,
  platform_name TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,       -- TLD-agnostic (e.g., 'linkedin')
  can_crawl BOOLEAN NOT NULL DEFAULT true,
  skip_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_platforms_hostname ON platforms(hostname);
CREATE INDEX idx_platforms_can_crawl ON platforms(can_crawl);
```

**Pre-populated platforms:** 70+ job boards including LinkedIn, Indeed, Greenhouse, etc.

**Hostname matching:** TLD-agnostic (e.g., 'linkedin' matches linkedin.com, linkedin.de, linkedin.co.uk)

### blacklist table

Semantic keyword filtering for job titles/descriptions.

```sql
CREATE TABLE blacklist (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blacklist_keyword ON blacklist(keyword);
```

### blacklist_embeddings table

Vector embeddings for blacklist keywords.

```sql
CREATE TABLE blacklist_embeddings (
  keyword_id INTEGER PRIMARY KEY REFERENCES blacklist(id) ON DELETE CASCADE,
  embedding vector(384),               -- pgvector extension
  model TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blacklist_embeddings_model ON blacklist_embeddings(model);
```

### job_embeddings table

Vector embeddings for semantic job search.

```sql
CREATE TABLE job_embeddings (
  job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  embedding vector(384),               -- pgvector extension
  model TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_embeddings_model ON job_embeddings(model);
```

### logs table

Centralized logging system.

```sql
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL CHECK(level IN ('error', 'warning', 'info', 'debug')),
  message TEXT NOT NULL,
  source TEXT,
  stack TEXT,
  context JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_source ON logs(source);
CREATE INDEX idx_logs_created_at ON logs(created_at);
```

### migrations table

Tracks applied migrations.

```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT NOW()
);
```

## Common Queries

### Email Queries

```sql
-- View all high-confidence emails
SELECT gmail_id, subject, from_address
FROM emails
WHERE confidence = 'high';

-- Count job-related emails
SELECT COUNT(*) FROM emails WHERE is_job_related = true;

-- View recent emails with platform info
SELECT e.gmail_id, e.subject, e.from_address, p.platform_name
FROM emails e
LEFT JOIN platforms p ON e.platform_id = p.id
ORDER BY e.created_at DESC
LIMIT 10;

-- Find emails from LinkedIn
SELECT e.gmail_id, e.subject
FROM emails e
JOIN platforms p ON e.platform_id = p.id
WHERE p.platform_name = 'LinkedIn';

-- Count emails by platform
SELECT p.platform_name, COUNT(*) as email_count
FROM emails e
LEFT JOIN platforms p ON e.platform_id = p.id
GROUP BY p.platform_name
ORDER BY email_count DESC;
```

### Job Queries

```sql
-- View all jobs with salary
SELECT title, link, salary_min, salary_max, salary_currency, salary_period
FROM jobs
WHERE salary_min IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Find yearly EUR jobs in range (€60k - €100k)
SELECT title, link, salary_min, salary_max
FROM jobs
WHERE salary_currency = 'EUR'
  AND salary_period = 'yearly'
  AND salary_min >= 60000
  AND salary_max <= 100000;

-- Find hourly jobs above rate
SELECT title, link, salary_min, salary_max, salary_currency
FROM jobs
WHERE salary_period = 'hourly'
  AND salary_min >= 80;

-- Jobs with descriptions
SELECT title, link, LEFT(description, 100) as summary
FROM jobs
WHERE description IS NOT NULL
LIMIT 10;

-- Count jobs by status
SELECT processing_status, COUNT(*)
FROM jobs
GROUP BY processing_status;

-- Blacklisted jobs
SELECT title, link, blacklist_reason
FROM jobs
WHERE is_blacklisted = true;
```

### Platform Queries

```sql
-- View all platforms
SELECT platform_name, hostname, can_crawl, skip_reason
FROM platforms
ORDER BY platform_name;

-- Crawlable platforms only
SELECT platform_name, hostname
FROM platforms
WHERE can_crawl = true
ORDER BY platform_name;

-- Non-crawlable platforms
SELECT platform_name, hostname, skip_reason
FROM platforms
WHERE can_crawl = false;

-- Platform statistics
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE can_crawl = true) as crawlable,
  COUNT(*) FILTER (WHERE can_crawl = false) as non_crawlable
FROM platforms;
```

### Vector Search Queries

```sql
-- Jobs with embeddings
SELECT j.title, je.model
FROM jobs j
JOIN job_embeddings je ON j.id = je.job_id
LIMIT 10;

-- Jobs without embeddings
SELECT j.id, j.title
FROM jobs j
LEFT JOIN job_embeddings je ON j.id = je.job_id
WHERE je.job_id IS NULL;

-- Embedding coverage
SELECT
  COUNT(*) as total_jobs,
  COUNT(je.job_id) as with_embeddings,
  COUNT(*) - COUNT(je.job_id) as without_embeddings
FROM jobs j
LEFT JOIN job_embeddings je ON j.id = je.job_id;

-- Semantic similarity search (example)
SELECT j.title, j.link,
       1 - (je.embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM jobs j
JOIN job_embeddings je ON j.id = je.job_id
ORDER BY similarity DESC
LIMIT 10;
```

### Log Queries

```sql
-- Recent errors
SELECT level, message, source, created_at
FROM logs
WHERE level = 'error'
ORDER BY created_at DESC
LIMIT 10;

-- Logs by source
SELECT source, COUNT(*)
FROM logs
GROUP BY source
ORDER BY COUNT(*) DESC;

-- Recent logs with context
SELECT level, message, context
FROM logs
WHERE context IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

## Migrations

### Migration System

The project uses a migration system to track schema changes:

**Migration files:** `migrations-pg/*.sql`

**Migration script:** `./migrations-pg/migrate.sh`

**Migration table:** Tracks applied migrations

### Running Migrations

```bash
# Run all pending migrations
./migrations-pg/migrate.sh

# View applied migrations
psql -d jobseeker -c "SELECT * FROM migrations ORDER BY applied_at;"
```

### Creating Migrations

1. **Create a new migration file** with sequential numbering:
   ```bash
   touch migrations-pg/012_add_new_column.sql
   ```

2. **Write the SQL:**
   ```sql
   -- Migration: Add new column
   -- Created: 2024-01-14

   ALTER TABLE jobs ADD COLUMN IF NOT EXISTS new_field TEXT;
   CREATE INDEX IF NOT EXISTS idx_jobs_new_field ON jobs(new_field);
   ```

3. **Run the migration:**
   ```bash
   ./migrations-pg/migrate.sh
   ```

4. **Commit the migration file:**
   ```bash
   git add migrations-pg/012_add_new_column.sql
   git commit -m "Migration: Add new field to jobs table"
   ```

### Migration Guidelines

- ✅ Always use `IF NOT EXISTS` for idempotency
- ✅ Test on a copy of the database first
- ✅ Commit migration files to version control
- ✅ Never modify existing migration files
- ✅ Use sequential numbering
- ❌ Never delete migration files
- ❌ No rollback support - plan carefully

## Database Maintenance

### Backup

```bash
# Full backup
pg_dump -U jobseeker jobseeker > backup.sql

# Schema only
pg_dump -U jobseeker --schema-only jobseeker > schema.sql

# Data only
pg_dump -U jobseeker --data-only jobseeker > data.sql
```

### Restore

```bash
# Restore from backup
psql -U jobseeker jobseeker < backup.sql
```

### Vacuum

```bash
# Analyze and vacuum
psql -d jobseeker -c "VACUUM ANALYZE;"
```

### Index Maintenance

```sql
-- Reindex all tables
REINDEX DATABASE jobseeker;

-- Reindex specific table
REINDEX TABLE jobs;
```

## Performance Tips

1. **Use indexes** - All foreign keys and frequently queried columns are indexed
2. **Analyze queries** - Use `EXPLAIN ANALYZE` to understand query plans
3. **Vacuum regularly** - Prevents table bloat
4. **Monitor connections** - Use connection pooling (already configured)
5. **pgvector optimization** - Embeddings use efficient binary storage

## See Also

- [Setup Guide →](SETUP.md) - Database installation
- [Architecture →](ARCHITECTURE.md) - Database design decisions
- [API Reference →](API.md) - Database API endpoints
