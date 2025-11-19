# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Job Seeker is an automation tool that:
- Scans a Gmail inbox for job-related emails
- Uses AI (Ollama) to intelligently categorize emails as job/project-related
- Extracts and visits job description URLs from those emails (coming soon)
- Analyzes job descriptions to match against a predefined skill set (coming soon)
- Marks matching emails as important for follow-up (coming soon)

## Current Implementation Status

### ✅ Completed
- Gmail OAuth 2.0 authentication with token persistence
- Email scanning with customizable queries and date ranges
- Full email body extraction (multipart MIME support)
- Domain-based categorization with 70+ known job board whitelists (100% accuracy)
- AI-powered email categorization using local Ollama LLM (for unknown senders)
- Multilingual support without keyword dependency (English, German, French, Spanish, etc.)
- Automatic Ollama model selection (prefers llama3.2, llama3.1, mistral, phi3)
- SQLite database with smart storage (full body for high-confidence, metadata only for low-confidence)
- Email processed tracking (marks emails as processed to prevent reprocessing)
- Job tracking table to prevent duplicate job scans (stores title, link, email reference, description)
- URL extraction from email bodies with intelligent pattern matching
- Web scraping with platform-specific selectors (cheerio-based)
- AI job summarization using Ollama (structured summaries with role, responsibilities, requirements)
- Skills database with 70+ skills across 11 categories
- Job-skill matching with relevance scoring
- **Salary extraction and tracking** - Automatically extracts salary from job pages:
  - Multiple formats: US ($80,000), European (€80.000,50), Swiss (CHF 80'000)
  - Ranges and single values with k-suffix handling ("50-60k" → 50k-60k)
  - Currency detection (USD, EUR, GBP, CHF) and normalization
  - Period detection (yearly, monthly, weekly, daily, hourly)
  - Stores structured data (min/max/currency/period) for filtering
- **Platform crawl control** - Database table managing 70+ platforms with configurable crawlability flags
- **Smart platform filtering** - Saves ALL jobs (including LinkedIn) but only fetches descriptions for crawlable platforms
- Migration system with automatic tracking (migrations folder with individual .sql files)
- Duplicate detection to skip already-processed emails
- Visual progress bars for all operations (cli-progress)
- Color-coded terminal output (green ✓ for job-related, red ✗ for others)
- Confidence scoring (high/medium/low) for categorizations
- Database statistics (total, job-related, confidence breakdown, platform stats)
- **Web interface** - Single-page application to view job listings:
  - Sortable table with all job data (title, link, salary, description, date)
  - Real-time search/filter functionality
  - Salary formatting with currency and period
  - Description preview with hover for full text
  - Statistics display (total jobs, with salary, with descriptions)
  - API endpoints for jobs and platforms data
- Comprehensive unit test coverage: **310 tests passing** (vitest)
- Git pre-commit hooks with automated test enforcement
- TypeScript-only codebase with strict type checking

### 🔜 To Be Implemented
- Skills matching workflow (match job requirements against user skills)
- Gmail marking (starring/important labels for matching jobs)

## Package Manager & Language

This project uses **pnpm** (version 10.22.0). Always use `pnpm` commands instead of npm or yarn:
- `pnpm install` - Install dependencies
- `pnpm add <package>` - Add a new dependency
- `pnpm test` - Run tests (once implemented)

**Language**: TypeScript only - no JavaScript files. All code must be written in TypeScript.

**Environment Variables**: Use **dotenvx** to execute scripts with environment variables loaded.

## Development Commands

All scripts must be executed using **dotenvx**. Common commands will include:
- `pnpm test` - Run unit tests
- `dotenvx run -- pnpm start` - Run the job seeker scanner with environment variables
- `dotenvx run -- pnpm dev` - Development mode with hot reload and environment variables
- Scripts in package.json should use `dotenvx run --` prefix for execution

## Architecture Guidelines

### Module: gmail-auth.ts (Completed)
**Purpose**: Gmail OAuth 2.0 authentication and token management

**Key Functions**:
- `loadCredentials()` - Loads OAuth credentials from credentials.json
- `authorize()` - Handles full OAuth flow with local callback server on port 3000
- `saveToken()` / `loadToken()` - Persist tokens to token.json
- `createOAuth2Client()` - Creates authenticated Gmail API client
- `testGmailConnection()` - Validates Gmail API access

**Implementation Notes**:
- Uses http server on localhost:3000 for OAuth callback
- Tokens are cached locally for subsequent runs
- Redirect URI must be http://localhost:3000 in Google Cloud Console

### Module: email-scanner.ts (Completed)
**Purpose**: Email fetching and body extraction with progress tracking

**Key Functions**:
- `fetchEmails()` - Fetches email metadata with progress bar
- `fetchEmailBody()` - Extracts full text from single email (handles multipart MIME)
- `fetchEmailBodies()` - Batch body fetching with progress bar
- `markEmailAsImportant()` - Adds STARRED and IMPORTANT labels
- `processEmailsWithProgress()` - Generic progress-tracked processor

**Implementation Notes**:
- Supports Gmail query syntax (newer_than, subject, from, etc.)
- Handles multipart MIME: text/plain preferred, text/html fallback
- Base64url decoding for email body data
- Recursive extraction for nested MIME parts
- cli-progress for visual progress bars

### Module: job-portal-domains.ts (Completed)
**Purpose**: Whitelist of known job board and freelance platform domains

**Key Exports**:
- `JOB_PORTAL_DOMAINS` - Array of 70+ known job board domains (freelancermap, LinkedIn, Indeed, Upwork, etc.)
- `extractDomain()` - Extracts domain from email address (handles display names, trailing chars)
- `isFromJobPortal()` - Checks if email is from known job portal (supports subdomains)

**Implementation Notes**:
- Includes freelance platforms, job boards, ATS systems, recruitment agencies
- Case-insensitive matching
- Subdomain support (e.g., jobs.linkedin.com matches linkedin.com)
- 100% accuracy for whitelisted domains (no false positives/negatives)
- Provides HIGH confidence immediately without AI analysis

**Domain Categories**:
- Freelance: freelancermap, upwork, freelancer, fiverr, toptal, guru, peopleperhour, twago, malt
- Job Boards: LinkedIn, Indeed, StepStone, Monster, Xing, Glassdoor, ZipRecruiter, Dice, CareerBuilder
- Tech-specific: Stack Overflow, WeWorkRemotely, RemoteOK, AngelList, Wellfound
- ATS: Greenhouse, Lever, Workday, SmartRecruiters, Recruitee, Breezy, Workable, Jobvite, iCIMS, Taleo
- Agencies: Hays, Adecco, Randstad, Manpower, Robert Walters, Michael Page

### Module: email-categorizer.ts (Completed)
**Purpose**: Two-stage email categorization (domain check + AI analysis)

**Key Functions**:
- `checkOllamaAvailability()` - Verifies Ollama is running and has models
- `getBestModel()` - Auto-selects best available model (llama3.2, llama3.1, mistral, phi3)
- `categorizeEmail()` - Two-stage: domain check first, then Ollama LLM if needed
- `categorizeEmails()` - Batch categorization (async sequential)
- `formatEmailForDisplay()` - Terminal formatting with ANSI colors and checkmarks
- `resetOllamaClient()` - Resets singleton client instance (for testing)

**Implementation Notes - Two-Stage Categorization**:
1. **Stage 1**: Check if email is from known job portal using `isFromJobPortal()`
   - If YES: Return HIGH confidence immediately, skip AI analysis
   - Reason: "From known job board/freelance platform domain"
2. **Stage 2**: Use Ollama LLM for unknown senders
   - Multilingual prompt (English, German, French, Spanish, Italian, etc.)
   - No keyword matching - uses semantic understanding
   - Prompts LLM to return JSON: {isJobRelated, confidence, reason, keywords}
   - Temperature: 0.2 for consistent results
   - Graceful fallback if Ollama unavailable (returns isJobRelated=false, confidence=low)

**Technical Details**:
- Uses Ollama client library (ollama package) with singleton pattern
- ANSI color codes: \x1b[32m (green), \x1b[31m (red), \x1b[0m (reset)
- Configurable via OLLAMA_HOST environment variable (default: http://localhost:11434)
- Exports EmailMessage type for test imports
- JSON extraction with regex fallback for invalid LLM responses

### Module: database.ts (Completed)
**Purpose**: SQLite database operations for tracking processed emails and job postings

**Email Management Functions**:
- `getDatabase()` - Gets or creates database connection with WAL mode for better concurrency
- `isEmailScanned()` - Checks if an email has already been processed
- `saveEmail()` - Saves email with smart storage (high-confidence: full body, low/medium: metadata only)
- `getScannedEmailIds()` - Returns all processed email IDs for duplicate detection
- `getHighConfidenceEmails()` - Retrieves all high-confidence job-related emails
- `getEmails()` - Flexible query with filters (confidence, isJobRelated, limit)
- `getEmailStats()` - Returns statistics (total, jobRelated, high/medium/low confidence counts)
- `clearAllEmails()` - Deletes all emails (for testing)

**Job Management Functions**:
- `isJobScanned()` - Checks if a job link has already been scanned
- `saveJob()` - Saves job with title, link, and optional email_id reference
- `getScannedJobLinks()` - Returns all scanned job links for duplicate detection
- `getJobs()` - Flexible query with filters (emailId, limit)
- `getJobStats()` - Returns statistics (total jobs)
- `clearAllJobs()` - Deletes all jobs (for testing)

**Platform Management Functions** (NEW):
- `getPlatforms()` - Returns all platforms sorted by name
- `getPlatformByDomain(url)` - Finds platform by URL (supports subdomains)
- `getPlatformIdFromEmail(emailAddress)` - Extracts platform ID from email address
- `canCrawlUrl(url)` - Checks if URL can be crawled (returns true for unknown platforms)
- `getSkipReason(url)` - Returns skip reason for non-crawlable URLs
- `updatePlatformCrawlability(domain, canCrawl, skipReason)` - Updates crawl flag and reason
- `getPlatformStats()` - Returns total, crawlable, and non-crawlable counts

**General Functions**:
- `closeDatabase()` - Closes database connection

**Implementation Notes**:
- Uses better-sqlite3 for synchronous, fast SQLite operations
- Database file: job-seeker.db (git-ignored)
- WAL mode enabled for better read performance
- Singleton pattern for database connection
- Smart storage strategy:
  - **High confidence**: Stores gmail_id, subject, **full body**, confidence, timestamps
  - **Low/medium confidence**: Stores gmail_id, subject, confidence, timestamps (**body is NULL**)
- UPSERT logic on gmail_id to handle re-categorization
- Indexes on gmail_id, confidence, is_job_related, created_at for fast queries

**Database Schema**:
```sql
-- Emails table: Stores scanned emails with smart storage
CREATE TABLE emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_id TEXT NOT NULL UNIQUE,
  subject TEXT,
  from_address TEXT,  -- Sender email for platform detection
  body TEXT,  -- NULL for low/medium confidence
  confidence TEXT NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
  is_job_related INTEGER NOT NULL CHECK(is_job_related IN (0, 1)),
  reason TEXT,
  processed INTEGER NOT NULL DEFAULT 0 CHECK(processed IN (0, 1)),
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table: Tracks job postings to prevent duplicate scans
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,  -- Prevents duplicate job scans
  email_id INTEGER,            -- Links back to source email
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
);

-- Migrations table: Tracks applied database migrations
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,  -- e.g., "001_create_emails_table.sql"
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Platforms table: Manages job platforms with crawl control (NEW)
CREATE TABLE platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_name TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,  -- TLD-agnostic (e.g., 'linkedin' not 'linkedin.com')
  can_crawl INTEGER NOT NULL DEFAULT 1 CHECK(can_crawl IN (0, 1)),
  skip_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Pre-populated with 70+ known job boards and platforms
-- hostname stored without TLD for automatic matching across domains
-- Example: 'linkedin' matches linkedin.com, linkedin.de, linkedin.co.uk
-- LinkedIn set to can_crawl=0 (requires multi-level authentication)
```

### Module: migrate.sh (Database Migration Script)
**Purpose**: Applies database schema changes in a trackable, reproducible way

**Features**:
- Reads SQL migration files from `migrations/` folder in alphabetical order
- Tracks applied migrations in a `migrations` table
- Skips already-applied migrations (idempotent)
- Displays clear progress and summary
- No rollback support - forward-only migrations

**Migration Files**:
- `001_create_emails_table.sql` - Creates emails table with indexes
- `002_create_jobs_table.sql` - Creates jobs table with indexes
- Future migrations follow sequential numbering (003, 004, etc.)

**Usage**:
```bash
./migrate.sh
```

### Module: index.ts (Main Entry Point)
**Purpose**: Orchestrates the full email categorization workflow

**Workflow**:
1. Authorize with Gmail (OAuth 2.0)
2. Test Gmail connection
3. Check Ollama availability
4. Auto-detect best Ollama model
5. Fetch emails (customizable query, default: newer_than:7d, maxResults: 20)
6. **Filter out already-scanned emails from database**
7. Skip processing if all emails already scanned
8. Fetch full email bodies for new emails only
9. Categorize new emails using Ollama with progress bar
10. **Save categorized emails to database**
11. Display results with colored checkmarks and confidence levels
12. Show summary statistics (this run + database totals)
13. **Close database connection**

**Configuration Points**:
- Email query in `fetchEmails()` call
- maxResults for batch size
- Model selection (auto or manual)

### Future Modules (To Be Implemented)

#### URL Extraction
- Extract job description URLs from email bodies
- Support common job board patterns (LinkedIn, Indeed, Greenhouse, Lever, etc.)
- Handle shortened URLs and redirects

#### Web Scraping
- Parse job description pages to extract requirements and qualifications
- Use puppeteer or playwright for JavaScript-rendered pages
- Extract: job title, company, requirements, qualifications, salary (if available)
- Handle various job board formats

#### Skills Matching
- Read user skills from `skills.md` file
- Use Ollama to match job requirements against user skills
- Provide match percentage and detailed analysis
- Highlight matched skills and missing skills

## Testing Requirements

For every new feature or bug fix:
- Write at least 2 unit tests (vitest framework)
- For bug fixes, include regression tests
- Mock external API calls (Gmail API, Ollama) in tests
- All tests located in src/__tests__/ directory
- Test files follow naming: `<module-name>.test.ts`

**Current Test Coverage** (310 tests passing):
- `gmail-auth.test.ts` - 8 tests (OAuth authentication, token management)
- `email-scanner.test.ts` - 14 tests (email fetching, body extraction, progress bars)
- `email-categorizer.test.ts` - 13 tests (domain check, Ollama integration, error handling)
- `job-portal-domains.test.ts` - 15 tests (domain extraction, whitelist matching, case sensitivity)
- `url-extractor.test.ts` - 28 tests (URL extraction, job title parsing, deduplication)
- `job-scraper.test.ts` - 43 tests (salary extraction: ranges, single values, formats, currencies, periods, k-suffix handling)
- `database.test.ts` - 96 tests (emails, jobs, skills, salary, descriptions, processed flag, platform tracking, logs)
- `server.test.ts` - 33 tests (API endpoints, job/platform data, filtering, sorting)
- `jobs.test.ts` - 8 tests (Bull job processors: embedding, extraction, processing)
- `logger.test.ts` - 25 tests (logging system: database persistence, log levels, context, stack traces)
- `embeddings.test.ts` - 27 tests (vector embeddings, semantic search, blacklist matching)

**Running Tests**:
```bash
pnpm test           # Run all tests once
pnpm test:watch     # Watch mode
pnpm test:ui        # Visual UI
```

## Coding Standards

- **TypeScript only** - No JavaScript files allowed
- **Strict type checking** - Enabled in tsconfig.json
- **console.debug** for debug output (not console.log)
- **Progress bars** - Use cli-progress for long-running operations
- **Error handling** - Graceful fallbacks, never crash without informative error
- **Async/await** - Preferred over promises/callbacks
- **Function documentation** - JSDoc comments for exported functions

## Git Workflow

- Never commit directly to main/master branch
- Always work on feature branches
- Keep staging area clean after commits
- Update README.md for business logic changes
- Run tests before committing
- **Always commit migration files** to version control

### What to Commit vs Gitignore

**ALWAYS commit** (tracked in git):
- Source code: `src/**/*.ts`
- **Migration files: `migrations/*.sql`** (important for reproducibility)
- Tests: `src/__tests__/**/*.test.ts`
- Configuration: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Documentation: `README.md`, `CLAUDE.md`
- Scripts: `migrate.sh`

**NEVER commit** (git-ignored):
- Database files: `*.db`, `*.sqlite`, `*.db-wal`, `*.db-shm`
- OAuth credentials: `credentials.json`, `token.json`
- Environment files: `.env`, `.env.*` (except `.env.example`)
- Build artifacts: `dist/`, `node_modules/`
- Personal files: `skills.md`, `resume.md`
- Local settings: `.claude/settings.local.json`

## Dependencies

**Installed:**
- **googleapis** - Gmail API client library
- **google-auth-library** - OAuth 2.0 authentication (required by googleapis)
- **ollama** - Ollama client library for LLM-based categorization
- **better-sqlite3** - Fast, synchronous SQLite database with @types/better-sqlite3
- **cli-progress** - Terminal progress bars (@types/cli-progress for TypeScript)
- **vitest** - Testing framework with @vitest/ui
- **TypeScript** - Required language with @types/node
- **dotenvx** (@dotenvx/dotenvx) - Environment variable management
- **tsx** - TypeScript execution

**To Consider:**
- Web scraping library (cheerio, puppeteer, or playwright)

## Local Requirements

- **Ollama** must be installed and running locally for email categorization
  - Install: `brew install ollama` (macOS) or visit ollama.com
  - Start: `ollama serve`
  - Recommended models: llama3.2, llama3.1, mistral, phi3
- **SQLite database** created via `./migrate.sh` to track email processing and job postings
  - Migration system with automatic tracking of applied migrations
  - Migration files in `migrations/` folder (e.g., `001_create_emails_table.sql`)
  - Run migration script: `./migrate.sh` (only applies new migrations)
  - Creates `job-seeker.db` with emails, jobs, and migrations tables
  - Database file is git-ignored (*.db pattern)
- A `skills.md` file containing user's skills and qualifications (optional, for future features)

## Common Development Tasks

### Adding a New Feature
1. Create feature branch: `git checkout -b feature/my-feature`
2. Write TypeScript code in appropriate module
3. Add comprehensive unit tests (at least 2 test cases)
4. Update README.md if it changes user-facing behavior
5. Run `pnpm test` to ensure all tests pass
6. Commit with descriptive message

### Modifying Email Categorization Logic
- **Stage 1 (Domain Whitelist)**: Edit `src/job-portal-domains.ts`
  - Add new job board domains to `JOB_PORTAL_DOMAINS` array
  - Test with `src/__tests__/job-portal-domains.test.ts`
- **Stage 2 (AI Analysis)**: Edit `src/email-categorizer.ts`
  - Adjust multilingual prompt in `categorizeEmail()` function (line ~121)
  - Consider temperature parameter (currently 0.2 for consistency)
  - Test with various email types and languages
  - Update tests in `src/__tests__/email-categorizer.test.ts`
  - Remember to call `resetOllamaClient()` in test `beforeEach()` for clean state

### Changing Gmail Query
- Edit `src/index.ts`
- Modify the `query` parameter in `fetchEmails()` call
- Gmail query syntax: https://support.google.com/mail/answer/7190

### Adjusting Batch Size
- Edit `maxResults` parameter in `fetchEmails()` call
- Lower values = faster but multiple runs needed
- Higher values = slower but fewer API calls
- Consider Gmail API quota limits

### Adding Database Migrations

The project uses a migration system to track and apply database schema changes safely.

**Migration System Overview**:
- Each migration is a separate SQL file in the `migrations/` folder
- Migrations are numbered sequentially: `001`, `002`, `003`, etc.
- A `migrations` table tracks which migrations have been applied
- `migrate.sh` script applies only new migrations
- No rollback support - migrations are forward-only

**Step-by-Step Guide**:

1. **Create a new migration file** with the next sequential number:
   ```bash
   # Example filename: migrations/003_add_skills_column.sql
   ```

2. **Write the migration SQL** with descriptive comments:
   ```sql
   -- Migration: Add skills column to emails
   -- Created: 2024-01-14

   ALTER TABLE emails ADD COLUMN skills_matched TEXT;
   CREATE INDEX IF NOT EXISTS idx_skills_matched ON emails(skills_matched);
   ```

3. **Run the migration script**:
   ```bash
   ./migrate.sh
   ```

4. **How the script works**:
   - Creates `migrations` table if it doesn't exist
   - Queries database for already-applied migrations
   - Processes all `.sql` files in `migrations/` folder in alphabetical order
   - Skips migrations already in the `migrations` table
   - Applies new migrations and records them
   - Shows summary: total migrations, already applied, newly applied

5. **Output example**:
   ```
   ✓ Migrations tracking table ready

   ⊘ 001_create_emails_table.sql (already applied)
   ⊘ 002_create_jobs_table.sql (already applied)
   → Applying 003_add_skills_column.sql...
   ✓ 003_add_skills_column.sql applied successfully

   ================================
   Migration Summary:
     Total migrations: 3
     Already applied: 2
     Newly applied: 1
   ================================
   ```

6. **Best practices**:
   - ✅ **DO**: Create new migration files for all schema changes
   - ✅ **DO**: Use sequential numbering (001, 002, 003)
   - ✅ **DO**: Include descriptive comments in migration files
   - ✅ **DO**: Test migrations on a copy of the database first
   - ✅ **DO**: Commit migration files to version control
   - ✅ **DO**: Use `IF NOT EXISTS` for idempotency where possible
   - ❌ **DON'T**: Modify existing migration files
   - ❌ **DON'T**: Delete migration files
   - ❌ **DON'T**: Reorder migration file numbers
   - ❌ **DON'T**: Assume rollback is available

7. **Troubleshooting**:
   - If a migration fails, fix the SQL and delete the entry from the `migrations` table before re-running
   - Check migration status: `sqlite3 job-seeker.db "SELECT * FROM migrations;"`
   - Manually mark migration as applied: `sqlite3 job-seeker.db "INSERT INTO migrations (filename) VALUES ('003_migration.sql');"`

## Troubleshooting Tips

- **Ollama not connecting**: Check `OLLAMA_HOST` env var, verify `ollama serve` is running
- **Gmail OAuth issues**: Delete `token.json` and re-authenticate
- **Progress bars not showing**: Check console output isn't being buffered
- **Tests failing**: Run `pnpm test:ui` for visual debugging
- **TypeScript errors**: Run `pnpm build` to see all type errors
