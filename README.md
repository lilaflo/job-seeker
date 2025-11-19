# Job Seeker

An automation tool that scans Gmail for job-related emails, extracts job descriptions, analyzes them against your skills using AI, and marks matching opportunities as important.

## Features

### Currently Implemented

- ✅ **Gmail OAuth Authentication** - Secure OAuth 2.0 authentication with automatic token refresh
- ✅ **Email Scanning** - Fetches emails from Gmail with customizable queries and date ranges
- ✅ **Full Email Body Extraction** - Downloads complete email content including multipart MIME messages
- ✅ **Domain-Based Categorization** - 70+ known job board domains for 100% accurate detection (freelancermap, LinkedIn, Indeed, Upwork, etc.)
- ✅ **AI-Powered Categorization** - Uses local Ollama LLM with multilingual support for emails from unknown senders
- ✅ **Multilingual Support** - Analyzes emails in English, German, French, Spanish, and more without keyword dependency
- ✅ **SQLite Database** - Persistent storage with smart data retention (full body for high-confidence, metadata only for low-confidence)
- ✅ **Duplicate Detection** - Automatically skips already processed emails for faster scans
- ✅ **Processed Tracking** - Marks emails as processed to prevent reprocessing on subsequent runs
- ✅ **Two-Step Workflow** - Separate commands for email scanning and job extraction for better control
- ✅ **URL Extraction** - Intelligent extraction of job URLs from emails (LinkedIn, Indeed, Greenhouse, career pages, etc.)
- ✅ **Job Title Extraction** - Smart parsing of job titles from email subjects with fallback to body content
- ✅ **Visual Progress Bars** - Real-time progress tracking for all operations
- ✅ **Confidence Scoring** - High/medium/low confidence levels for each categorization
- ✅ **Color-Coded Terminal Output** - Green checkmarks (✓) for job-related, red X (✗) for others
- ✅ **Automatic Model Selection** - Detects and uses the best available Ollama model
- ✅ **Job Tracking Table** - SQLite table to prevent duplicate job scans with title and link storage
- ✅ **Skills Database** - Pre-populated with 70 skills from resume across 11 categories (Programming, Cloud, AI, etc.)
- ✅ **Job-Skill Matching** - Junction table to classify jobs by required skills with relevance scoring
- ✅ **Match Scoring** - Calculate job compatibility based on skill requirements
- ✅ **AI-Powered Salary Extraction** - Uses Ollama LLM to intelligently extract salary information from job pages:
  - **Primary method**: Ollama analyzes job page text with context-aware extraction
  - **Fallback method**: Regex patterns for when Ollama is unavailable
  - **Validation**: Rejects unrealistic values (yearly: 20k-1M, monthly: 1.5k-100k, hourly: 10-500)
  - Salary ranges: "$80,000 - $120,000", "€60k-€80k", "CHF 100'000 - CHF 120'000"
  - Single values: "$100,000", "€75k", "£50,000/year"
  - Multiple currencies: USD, EUR, GBP, CHF with automatic normalization
  - Multiple formats: US (80,000.50), European (80.000,50), Swiss (80'000)
  - Period detection: yearly, monthly, weekly, daily, hourly
  - Smart k-suffix handling: "50-60k" interpreted as "50k-60k"
  - Better accuracy with complex or unusual salary formats
- ✅ **Structured Salary Data** - Track min/max salary ranges with currency and period for precise filtering
- ✅ **Email-Based Job Descriptions** - For non-crawlable platforms (LinkedIn, etc.), uses Ollama to generate structured job descriptions from email content:
  - **Automatic fallback**: When job page cannot be crawled, analyzes the email notification instead
  - **Structured format**: Extracts Role Overview, Key Responsibilities, Requirements, Nice to Have, Work Details
  - **Professional summaries**: AI-generated descriptions under 500 words
  - **Complete tracking**: All jobs saved with metadata, descriptions added where possible
  - **Separate statistics**: Shows count of web-scraped vs email-generated descriptions
- ✅ **Migration System** - Trackable database migrations with automatic version control
- ✅ **Web Scraping** - Fetches job pages with intelligent content extraction using cheerio
- ✅ **AI Job Summarization** - Uses Ollama to generate structured job description summaries (Role Overview, Responsibilities, Requirements, etc.)
- ✅ **Multi-Platform Support** - Works with 15+ job platforms (LinkedIn, Indeed, Greenhouse, Lever, Workday, etc.)
- ✅ **Platform Crawl Control** - Database-driven platform management with configurable crawlability flags and skip reasons
- ✅ **Smart Filtering** - Automatically skips non-crawlable platforms (e.g., LinkedIn requires multi-level authentication)
- ✅ **Smart Processing** - Skips jobs that already have descriptions, with rate limiting for respectful scraping
- ✅ **Platform Tracking in Emails** - Each email linked to its source platform (LinkedIn, Indeed, etc.) via foreign key
- ✅ **Vector Search (RAG)** - Semantic job search using vector embeddings:
  - **Ollama embeddings**: Uses nomic-embed-text model (768 dimensions) for semantic understanding
  - **SQLite storage**: Embeddings stored as binary BLOBs for efficient retrieval
  - **Cosine similarity**: Rank jobs by semantic relevance to search queries
  - **Smart search toggle**: UI switch between keyword and semantic search
  - **Embedding generation**: One-click generation for all jobs without embeddings
  - **API endpoints**: `/api/jobs/search` for semantic search, `/api/embeddings/generate` for batch generation
- ✅ **Real-time WebSocket Updates** - Live progress during email scanning:
  - **WebSocket server**: Streams scan progress to all connected clients
  - **Live email display**: Shows each processed email immediately with checkmark/X indicator
  - **Progress bar**: Visual progress indicator during categorization
  - **Confidence badges**: Color-coded confidence levels (high/medium/low)
  - **Auto-reconnect**: Reconnects automatically if connection drops
- ✅ **Hot-Reload Development** - Frontend automatically reloads when files change:
  - **File watching**: Monitors `public/` directory for changes using chokidar
  - **WebSocket-based**: Uses existing WebSocket connection for instant reload notifications
  - **Development mode**: Enabled with `NODE_ENV=development` or `pnpm dev`
  - **Production mode**: Disabled in production for optimal performance
- ✅ **Centralized Logging System** - Database-backed logging for errors and warnings:
  - **Global logger**: Import and use `logger` from any module
  - **Database persistence**: All logs stored in SQLite for historical analysis
  - **Log levels**: error, warning, info, debug with automatic console output
  - **Stack traces**: Automatic capture for error-level logs
  - **Context support**: Attach structured data to any log entry
  - **Query API**: Filter logs by level, source, date with pagination support
  - **Maintenance**: Auto-cleanup of old logs with configurable retention
- ✅ **Comprehensive Unit Tests** - Full test coverage with 310 passing tests using Vitest
- ✅ **Automated Test Enforcement** - Git pre-commit hooks automatically run all tests before every commit

### Coming Soon

- 🔜 **Skills Matching** - Match job requirements against your skills.md profile
- 🔜 **Gmail Marking** - Automatically mark matching jobs as important/starred

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **pnpm** v10.22.0 (automatically enforced by packageManager field)
- **Ollama** installed and running locally for AI skill matching
- **Google Cloud Project** with Gmail API enabled

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API for your project
4. Create OAuth 2.0 credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Choose **Desktop app** as the application type
   - **IMPORTANT**: Add `http://localhost:3000` as an authorized redirect URI
   - Download the credentials JSON file
5. Save the downloaded file as `credentials.json` in the project root

   **Note**: If you get redirect URI errors, make sure `http://localhost:3000` is listed in your OAuth client's authorized redirect URIs in Google Cloud Console.

### 3. Install and Configure Ollama

1. **Install Ollama** (if not already installed):
   - Visit [ollama.com](https://ollama.com/) and follow installation instructions for your OS
   - Or use package manager:
     - macOS: `brew install ollama`
     - Linux: `curl -fsSL https://ollama.com/install.sh | sh`

2. **Pull a recommended model**:
   ```bash
   ollama pull llama3.2
   ```

   Other recommended models (choose one or more):
   - `llama3.2` (3B parameters, fast and efficient)
   - `llama3.1` (8B parameters, more accurate)
   - `mistral` (7B parameters, good balance)
   - `phi3` (3.8B parameters, lightweight)

3. **Pull the embedding model** (required for semantic search):
   ```bash
   ollama pull nomic-embed-text
   ```

4. **Start Ollama server**:
   ```bash
   ollama serve
   ```

   The application will automatically detect and use the best available model.

### 4. Initialize the Database

Run the migration script to create the SQLite database:

```bash
./migrate.sh
```

The migration system:
- Automatically tracks which migrations have been applied in a `migrations` table
- Only applies new migrations on subsequent runs
- Migration files are located in the `migrations/` folder
- Each migration is a separate SQL file (e.g., `001_create_emails_table.sql`)

This creates `job-seeker.db` with the following structure:

**emails table**: Stores scanned emails
- gmail_id (unique), subject, from_address, body, confidence, is_job_related, reason, processed, platform_id (FK), timestamps
- Smart storage: High-confidence emails store full body text, low/medium confidence stores only metadata
- processed: INTEGER (0/1) - Tracks whether email has been fully processed to prevent reprocessing
- from_address: TEXT - Sender email address for platform detection and filtering
- platform_id: INTEGER - Foreign key to platforms table, automatically detected from sender
- Indexes: Optimized for fast lookups by gmail_id, confidence, job-related status, processed status, from_address, platform_id, and date

**jobs table**: Tracks job postings to prevent duplicate scans
- id, title, link (unique), email_id (foreign key), salary_min, salary_max, salary_currency, salary_period, description, created_at, scanned_at
- Prevents re-processing the same job posting from multiple emails
- Links jobs back to the source email for context
- Structured salary fields:
  - salary_min/salary_max: REAL numbers for precise range queries
  - salary_currency: TEXT (EUR, USD, GBP, etc.)
  - salary_period: TEXT CHECK constraint ('yearly', 'monthly', 'weekly', 'daily', 'hourly')
- description: TEXT - AI-generated summary of job posting (Role Overview, Responsibilities, Requirements, etc.)
- Indexes: Optimized for fast lookups by link, email_id, salary_min, salary_max, currency, and description

**job_skills table**: Stores user's skills from resume (70 skills pre-populated)
- id, name, category, proficiency_level, created_at
- Pre-populated with skills across 11 categories:
  - Programming Languages (JavaScript, TypeScript, PHP, etc.)
  - Cloud & Infrastructure (Docker, AWS, Terraform, etc.)
  - AI & Machine Learning (LLM, Ollama, Analytics, etc.)
  - Modern Web Stack (Vue.js, React, Nuxt, Supabase)
  - Databases (MySQL, MongoDB, PostgreSQL, Redis, SQLite)
  - E-Commerce & PIM (Shopware, Akeneo, Shopify, WooCommerce)
  - Development Tools (Git, PhpStorm, VS Code, Cursor AI)
  - Management & Methodology (Scrum, Kanban, CSM, CSPO)
  - Privacy & Decentralization (Tor, IPFS, Nostr, Yggdrasil)
  - Blockchain & Crypto
  - Languages (German, English, French)
- Proficiency levels: Expert, Advanced, Proficient, Intermediate, Basic
- Indexes: Optimized for lookups by name, category, and proficiency

**job_skill_matches table**: Junction table linking jobs to required skills
- id, job_id (FK), skill_id (FK), relevance_score (0-100), created_at
- Enables job classification by required skills
- Relevance score indicates how important a skill is for the job
- UNIQUE constraint prevents duplicate skill-job associations
- CASCADE deletion: removes matches when job or skill is deleted
- Indexes: Optimized for finding skills by job, jobs by skill, and sorting by relevance

**platforms table**: Manages job platforms and crawlability
- id, platform_name, hostname (unique), can_crawl, skip_reason, created_at
- 70+ pre-configured platforms (LinkedIn, Indeed, Greenhouse, etc.)
- hostname: TLD-agnostic matching (e.g., 'linkedin' matches linkedin.com, linkedin.de, linkedin.co.uk)
- can_crawl: INTEGER (0/1) - Controls which platforms can have descriptions fetched
- skip_reason: TEXT - Explanation for why platform cannot be crawled
- Linked to emails via platform_id foreign key for automatic sender tracking
- Indexes: Optimized for hostname and crawlability lookups

**job_embeddings table**: Stores vector embeddings for semantic search
- job_id (FK, primary key), embedding (BLOB), embedding_dim, model, created_at
- Foreign key to jobs table with CASCADE delete
- embedding: Binary BLOB storing float32 array for vector search
- embedding_dim: Dimension of embedding vector (768 for nomic-embed-text)
- model: Name of embedding model used (nomic-embed-text)
- Index on model for filtering by embedding source

**migrations table**: Tracks applied database migrations
- id, filename (unique), applied_at
- Automatically managed by `migrate.sh`
- Ensures migrations run only once
- Enables safe schema evolution

The database file is automatically excluded from version control (.gitignore).

**Database queries:**
```bash
# Open the database
sqlite3 job-seeker.db

# View all high-confidence emails
SELECT gmail_id, subject FROM emails WHERE confidence='high';

# Count job-related emails
SELECT COUNT(*) FROM emails WHERE is_job_related=1;

# View recent emails
SELECT gmail_id, subject, confidence FROM emails ORDER BY created_at DESC LIMIT 10;

# View emails with sender information
SELECT gmail_id, subject, from_address, confidence FROM emails
WHERE from_address IS NOT NULL ORDER BY created_at DESC LIMIT 10;

# Find emails from a specific platform
SELECT e.gmail_id, e.subject, e.from_address, p.platform_name
FROM emails e
JOIN platforms p ON e.platform_id = p.id
WHERE p.platform_name = 'LinkedIn';

# Count emails by platform
SELECT p.platform_name, COUNT(*) as email_count
FROM emails e
LEFT JOIN platforms p ON e.platform_id = p.id
GROUP BY p.platform_name
ORDER BY email_count DESC;

# View all tracked jobs with salary info
SELECT title, link, salary_min, salary_max, salary_currency, salary_period
FROM jobs ORDER BY created_at DESC LIMIT 10;

# Count total jobs
SELECT COUNT(*) FROM jobs;

# Find jobs with salary information
SELECT title, link, salary_min, salary_max, salary_currency, salary_period
FROM jobs WHERE salary_min IS NOT NULL;

# Find yearly jobs within a salary range (€60k - €100k)
SELECT title, link, salary_min, salary_max, salary_currency
FROM jobs
WHERE salary_currency = 'EUR'
  AND salary_period = 'yearly'
  AND salary_min >= 60000
  AND salary_max <= 100000;

# Find hourly jobs above a minimum rate
SELECT title, link, salary_min, salary_max, salary_currency
FROM jobs
WHERE salary_period = 'hourly' AND salary_min >= 80;

# Find jobs from a specific email
SELECT j.title, j.link FROM jobs j
JOIN emails e ON j.email_id = e.id
WHERE e.gmail_id = 'your-gmail-id-here';

# View jobs with descriptions
SELECT title, link, substr(description, 1, 100) || '...' as summary
FROM jobs WHERE description IS NOT NULL LIMIT 10;

# Count jobs with/without descriptions
SELECT
  COUNT(CASE WHEN description IS NOT NULL THEN 1 END) as with_description,
  COUNT(CASE WHEN description IS NULL THEN 1 END) as without_description
FROM jobs;

# Search job descriptions for keywords
SELECT title, link FROM jobs
WHERE description LIKE '%React%' OR description LIKE '%TypeScript%';

# View all user skills
SELECT name, category, proficiency_level FROM job_skills ORDER BY category, name;

# Count skills by category
SELECT category, COUNT(*) as count FROM job_skills GROUP BY category ORDER BY count DESC;

# Find all Expert-level skills
SELECT name, category FROM job_skills WHERE proficiency_level='Expert';

# View skills for a specific job
SELECT js.name, js.category, jsm.relevance_score
FROM job_skill_matches jsm
JOIN job_skills js ON jsm.skill_id = js.id
WHERE jsm.job_id = 1
ORDER BY jsm.relevance_score DESC;

# Find all jobs requiring a specific skill
SELECT j.title, j.link, jsm.relevance_score
FROM job_skill_matches jsm
JOIN jobs j ON jsm.job_id = j.id
JOIN job_skills js ON jsm.skill_id = js.id
WHERE js.name = 'TypeScript'
ORDER BY jsm.relevance_score DESC;

# View applied migrations
SELECT * FROM migrations ORDER BY applied_at;

# View embedding statistics
SELECT COUNT(*) as total_embeddings FROM job_embeddings;

# View jobs with embeddings
SELECT j.title, je.model, je.embedding_dim
FROM jobs j
JOIN job_embeddings je ON j.id = je.job_id
LIMIT 10;

# Find jobs without embeddings
SELECT j.id, j.title FROM jobs j
LEFT JOIN job_embeddings je ON j.id = je.job_id
WHERE je.job_id IS NULL;
```

### 5. Create Your Skills Profile (Optional)

Create a `skills.md` file in the project root with your skills and qualifications:

```markdown
# My Skills

## Programming Languages
- TypeScript/JavaScript
- Python
- Go

## Frameworks
- Node.js
- React
- Express

## Tools & Technologies
- Git
- Docker
- PostgreSQL
```

**Note**: Skills matching against `skills.md` is coming in a future update. Currently, the app categorizes emails based on general job/project indicators.

### 5. Install Git Hooks (Recommended)

Install the pre-commit hook to automatically run tests before each commit:

```bash
./hooks/install.sh
```

This installs a pre-commit hook that:
- ✅ Automatically runs all tests before every commit
- ✅ Blocks commits if any tests fail
- ✅ Ensures code quality and prevents broken commits
- ✅ Shows test output in real-time

**Manual installation** (if script fails):
```bash
cp hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**To bypass the hook** (use sparingly):
```bash
git commit --no-verify
```

## Usage

The Job Seeker uses a simple two-step workflow:

### Start the Application

**Development mode** (with hot-reload for frontend):

```bash
pnpm dev
```

This runs all services with:
- **Redis** - Queue backend for embedding generation (blue output)
- **Worker** - Processes embedding jobs with auto-restart on file changes (yellow output)
- **Web Server** - API and web interface with hot-reload at http://localhost:3001 (green output)
- **Hot-reload** - Frontend automatically reloads when `public/index.html` changes

**Production mode:**

```bash
pnpm start
```

Same as dev mode but without hot-reload and with `NODE_ENV=production`.

Then open http://localhost:3001 in your browser.

**Individual services** (if needed separately):

```bash
pnpm serve:dev    # Web server with hot-reload (development)
pnpm serve        # Web server without hot-reload (production)
pnpm worker       # Just the worker
pnpm redis:start  # Just Redis (detached)
```

**Features:**
- **Job table** with sortable columns (title, link, salary, description, date)
- **Search/filter** jobs by title, URL, or description
- **Salary display** with formatted ranges (e.g., "USD 80k-120k/y")
- **Description preview** with full text on hover
- **Statistics** showing total jobs, with salary, with descriptions
- **Responsive design** for desktop and mobile

**API Endpoints:**
- `GET /api/jobs?limit=100` - Fetch job listings with optional limit
- `GET /api/platforms` - Fetch platform information
- `POST /api/scan` - Trigger email scan
- `GET /api/scan/status` - Check scan status
- `POST /api/jobs/search` - Semantic search (body: `{query, limit, minSimilarity}`)
- `POST /api/embeddings/generate` - Generate embeddings for all jobs
- `POST /api/reset` - Reset database (delete and run migrations)

### Step 1: Scan and Categorize Emails

First, scan your Gmail inbox and categorize job-related emails:

```bash
dotenvx run -- pnpm scan:emails
```

This will:
1. Authorize with Gmail (OAuth 2.0) on first run
2. Fetch emails from the last 7 days
3. Skip already-scanned emails (duplicate detection)
4. Fetch full email bodies
5. Categorize emails using domain whitelisting and AI (Ollama)
6. Save results to SQLite database row-by-row
7. Mark each email as "processed" to prevent reprocessing
8. Display summary with green checkmarks (✓) for job-related emails

### Step 2: Extract and Process Jobs

After scanning emails, extract job URLs and process their descriptions:

```bash
dotenvx run -- pnpm scan:jobs
```

This command now automatically:
1. **Extracts all jobs**: Reads high-confidence emails and extracts job URLs from ALL platforms
2. **Saves to database**: Stores all jobs (including non-crawlable like LinkedIn) with title and URL
3. **Fetches descriptions**: Only visits crawlable job pages and scrapes content
4. **Summarizes with AI**: Uses Ollama to create structured summaries for crawlable jobs
5. **Processes existing jobs**: Also processes any crawlable jobs in database that don't have descriptions yet
6. **Shows complete statistics**: Displays extraction and processing results with platform breakdown

**Features:**
- ✅ **Tracks ALL jobs** - Including LinkedIn and other non-crawlable platforms
- ✅ **Smart description fetching** - Only crawls platforms that don't require authentication
- ✅ Automatic description fetching enabled by default for crawlable platforms
- ✅ Handles 15+ job platforms (LinkedIn, Indeed, Greenhouse, etc.)
- ✅ Processes both new and existing crawlable jobs in one run
- ✅ Graceful error handling - saves jobs even if description fetching fails
- ✅ Rate limiting with 1-second delays between requests
- ✅ Progress bars for both extraction and processing phases

**Optional: Disable Description Fetching**

If you want to quickly extract job URLs without fetching descriptions:

```bash
# Disable description fetching for fast extraction only
FETCH_DESCRIPTIONS=false dotenvx run -- pnpm scan:jobs
```

**Note**: Requires Ollama to be running for description processing. If Ollama is unavailable, description fetching will be automatically disabled.

### Step 3: Generate Embeddings

After extracting jobs, the `scan:jobs` command automatically queues embedding generation. The embeddings are processed by a background worker.

**Start Redis and worker:**
```bash
# Start Redis (required)
pnpm redis:start

# Run job extraction (queues embeddings)
dotenvx run -- pnpm scan:jobs

# Start worker in another terminal (processes queue)
pnpm worker
```

Or use `pnpm start` to run everything in parallel.

**Requirements:**
- **Ollama** with `nomic-embed-text` model installed
- **Redis** for queue-based processing

**Worker commands:**
```bash
pnpm redis:start    # Start Redis container
pnpm redis:stop     # Stop Redis container
pnpm worker         # Start embedding worker
```

**Note**: The embedding model `nomic-embed-text` must be installed in Ollama. The worker will fail with a clear error message if the model is not available:
```bash
ollama pull nomic-embed-text
```

### Alternative: Process Jobs Only (Rarely Needed)

Since `scan:jobs` now handles both extraction and processing, this command is rarely needed. Use it only for specific cases:

```bash
dotenvx run -- pnpm process:jobs
```

**When to use this:**
- You want to ONLY process existing jobs without extracting new ones from emails
- You manually added job URLs to the database
- You want to retry failed descriptions without re-scanning emails

This command:
1. Fetches only jobs from database that don't have descriptions
2. Processes each job (scrape + summarize)
3. Does NOT scan emails or extract new job URLs

### Run Complete Workflow

To run both steps in one command:

```bash
# Recommended: Complete workflow with all features
dotenvx run -- pnpm scan:all

# Alternative alias
dotenvx run -- pnpm scan:full
```

This runs:
1. **Step 1**: Scan and categorize emails
2. **Step 2**: Extract jobs and process descriptions

**Note**: Since Step 2 now handles both extraction and processing automatically, this gives you a complete end-to-end workflow!

### Alternative Commands

```bash
# Scan emails only (step 1)
dotenvx run -- pnpm scan:emails

# Run all services in parallel (default start command)
pnpm start
```

### Utility Scripts

For database maintenance and backfilling data:

```bash
# Populate from_address for existing emails (one-time)
dotenvx run -- pnpm populate:from

# Update platform_id for existing emails (one-time)
dotenvx run -- pnpm update:platforms
```

**populate:from** - Backfills sender email addresses for existing emails in database
- Fetches email metadata from Gmail API
- Updates from_address column for all emails where it's NULL
- Useful after adding the from_address column via migration

**update:platforms** - Links existing emails to their source platforms
- Uses from_address to detect platform (LinkedIn, Indeed, etc.)
- Updates platform_id foreign key for all emails where it's NULL
- Automatically matches TLD-agnostic hostnames (linkedin.com, linkedin.de → linkedin)

### Running Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Run tests in watch mode
pnpm test:ui           # Run tests with UI
```

### Building for Production

```bash
pnpm build
```

## How It Works

### Step 1: Email Scanning (`pnpm scan:emails`)

1. **Gmail Connection**: Connects to Gmail using OAuth 2.0 authentication
2. **Email Scanning**: Fetches emails from the last 7 days with visual progress bar
3. **Duplicate Detection**: Checks SQLite database to skip already-processed emails
4. **Email Body Fetching**: Downloads full email content for new emails only
5. **Two-Stage Categorization**:
   - **Stage 1 - Domain Check**: Instantly recognizes emails from 70+ known job boards (freelancermap, LinkedIn, Indeed, Upwork, etc.) with 100% confidence
   - **Stage 2 - AI Analysis**: For unknown senders, uses Ollama LLM with multilingual support to analyze content
6. **Row-by-Row Persistence**: Each email is saved to the database immediately after categorization:
   - Ensures partial progress is saved if the process is interrupted
   - Allows resuming from where you left off in case of errors
   - High-confidence: Stores gmail_id, subject, full body, confidence, and timestamps
   - Low/medium-confidence: Stores gmail_id, subject, confidence, and timestamps (body is NULL)
7. **Visual Feedback**: Displays results with green checkmarks (✓) for job-related emails and red X (✗) for others
8. **Statistics**: Shows database statistics (total emails, job-related count, confidence breakdown)

### Step 2: Job Extraction (`pnpm scan:jobs`)

9. **High-Confidence Email Retrieval**: Reads job-related emails with high confidence from database
10. **URL Extraction**: Extracts job URLs from email bodies using:
    - Known job board patterns (LinkedIn, Indeed, Greenhouse, Lever, etc.)
    - Generic career page patterns (/careers/, /jobs/, /apply/)
    - URL deduplication (removes tracking parameters)
11. **Job Title Parsing**: Intelligently extracts job titles from:
    - Email subject lines (with prefix/suffix cleaning)
    - Email body content (as fallback)
12. **Platform Crawlability Check**: Determines whether each job URL can be crawled:
    - Checks platforms database for crawlability flags
    - Non-crawlable platforms (e.g., LinkedIn) marked for special handling
13. **Optional Description Fetching** (if `FETCH_DESCRIPTIONS=true`):
    - **For crawlable platforms**:
      - Visits each new job URL
      - Scrapes page content using cheerio with platform-specific selectors
      - **Extracts salary information using Ollama AI**:
        - Primary method: Ollama LLM analyzes job page text for salary information
        - Validation: Rejects unrealistic values (yearly: 20k-1M, monthly: 1.5k-100k, hourly: 10-500)
        - Understands context and complex salary formats
        - Extracts ranges: "$80,000 - $120,000", "€60k-€80k per year"
        - Extracts single values: "$100,000", "CHF 100'000"
        - Handles multiple formats: US (commas), European (dots/comma), Swiss (apostrophes)
        - Automatic currency detection (USD, EUR, GBP, CHF)
        - Period detection (yearly, monthly, weekly, daily, hourly)
        - Smart k-suffix handling: "50-60k" treated as "50k-60k"
        - Fallback to regex patterns if Ollama fails
      - Summarizes description using Ollama AI (temperature 0.3, 1000 tokens)
      - Adds 1-second delay between requests
    - **For non-crawlable platforms (LinkedIn, etc.)**:
      - Uses Ollama to generate structured job description from email notification
      - Extracts available information: Role Overview, Responsibilities, Requirements, Nice to Have, Work Details
      - Shorter delay (500ms) as no web request needed
      - Saves job with AI-generated description from email content
    - Handles failures gracefully (saves job with or without description)
14. **Job Persistence**: Saves jobs to jobs table with duplicate detection and salary data
15. **Progress Tracking**: Shows extraction progress and summary statistics (including separate counts for web-scraped vs email-generated descriptions)

### Step 3: Job Description Processing (`pnpm process:jobs`)

15. **Job Retrieval**: Fetches all jobs from database that don't have descriptions yet
16. **Web Scraping**: For each job:
    - Fetches HTML with proper browser headers (User-Agent, Accept, etc.)
    - Extracts job description content using cheerio with 15+ platform-specific selectors:
      - LinkedIn: `.jobs-description__content`, `.jobs-description-content__text`
      - Indeed: `#jobDescriptionText`, `.jobsearch-jobDescriptionText`
      - Greenhouse: `#content`, `.application`, `.job-post`
      - Lever: `.posting-headline`, `.posting-description`
      - Workday: `.jobDescription`, `[data-automation-id="jobPostingDescription"]`
      - Generic: `.job-description`, `article`, `main`, etc.
    - Removes noise elements (scripts, styles, navigation, footers, cookie banners)
    - Cleans and normalizes text (whitespace, length limits)
17. **AI Summarization**: Uses Ollama to generate structured summaries (temperature 0.3, 1000 tokens):
    - Role Overview (1-2 sentences)
    - Key Responsibilities (bullet points)
    - Requirements (skills, experience, qualifications)
    - Nice to Have (preferred/optional qualifications)
    - Work Details (location, remote options, employment type)
18. **Database Update**: Saves summary to description field using COALESCE to preserve existing data
19. **Rate Limiting**: 1-second delay between requests to avoid overwhelming servers
20. **Progress Tracking**: Visual progress bar with error reporting (shows first 10 errors)

### Future Steps (Coming Soon)

21. **Skills Matching**: Uses Ollama to match job requirements against your skills
22. **Gmail Marking**: Marks matching jobs as important/starred in Gmail

### Two-Stage Email Categorization

The application uses a smart two-stage approach for maximum accuracy:

#### Stage 1: Domain Whitelisting (100% Accuracy)
- Maintains a curated list of 70+ job board and freelance platform domains
- Instantly recognizes emails from:
  - **Freelance platforms**: freelancermap.de, upwork.com, freelancer.com, fiverr.com, toptal.com, guru.com, peopleperhour.com, twago.de, malt.com
  - **Job boards**: LinkedIn, Indeed, StepStone, Monster, Xing, Glassdoor, ZipRecruiter, Dice, CareerBuilder
  - **Tech-specific**: Stack Overflow, WeWorkRemotely, RemoteOK, AngelList, Wellfound
  - **ATS systems**: Greenhouse, Lever, Workday, SmartRecruiters, Recruitee, Breezy, Workable, Jobvite
  - **Recruitment agencies**: Hays, Adecco, Randstad, Manpower, Robert Walters, Michael Page
- Supports subdomain matching (e.g., jobs.linkedin.com, mail.indeed.com)
- Returns HIGH confidence immediately without needing AI analysis

#### Stage 2: AI-Powered Analysis (Multilingual)
For emails from unknown senders, the application uses local Ollama LLM:
- **Multilingual Support**: Analyzes emails in English, German, French, Spanish, Italian, and more
- **No Keyword Dependency**: Uses semantic understanding instead of keyword matching for better accuracy across languages
- **Model Selection**: Automatically detects and uses the best available Ollama model (prefers llama3.2, llama3.1, mistral, or phi3)
- **Context Analysis**: Analyzes sender, subject, snippet, and full email body
- **Confidence Levels**: Provides high/medium/low confidence scores based on analysis quality
- **Smart Detection**: Identifies job offers, project opportunities, freelance work, career opportunities, contract work, and recruitment-related emails in any language

### Progress Tracking

The application provides visual progress bars for:
- **Email Fetching**: Shows progress while downloading email metadata from Gmail
- **Body Fetching**: Displays progress while retrieving full email content
- **Categorizing & Saving**: Tracks progress during LLM-based email analysis and database persistence (row-by-row)
- **Batch Operations**: Shows progress for any bulk operations

Example output:
```
Processing Emails |████████████████████| 100% | 50/50 emails
Fetching Email Bodies |████████████████| 100% | 50/50
Categorizing & Saving Emails |██████████████████| 100% | 50/50

--- Categorization Results ---
✓ 1. Remote Jobs - Anzahl neue Projekte: 51 from office@freelancermap.de [high]
✓ 2. Jobs you may be interested in from LinkedIn Jobs <jobs-noreply@linkedin.com> [high]
✗ 3. Weekly Newsletter from newsletter@company.com [high]
✓ 4. Software Engineer Position at TechCorp from recruiter@techcorp.com [medium]
✗ 5. Team Meeting Reminder from colleague@company.com [high]
```

## Project Structure

```
job-seeker/
├── migrations/                     # Database migration files
│   ├── 001_create_emails_table.sql
│   ├── 002_create_jobs_table.sql
│   ├── 003_create_job_skills_table.sql      # User skills (70 pre-populated)
│   ├── 004_create_job_skill_matches_table.sql # Job-skill associations
│   ├── 005_add_salary_estimation_to_jobs.sql # Initial salary column (deprecated)
│   ├── 006_split_salary_to_min_max.sql      # Structured salary fields (min/max/currency/period)
│   ├── 007_add_description_to_jobs.sql      # Job description field for AI summaries
│   ├── 008_add_processed_to_emails.sql      # Processed flag to prevent email reprocessing
│   ├── 009_create_platforms_table.sql       # Platform crawlability management
│   ├── 010_add_from_to_emails.sql           # Sender tracking for emails
│   └── 011_create_job_embeddings_table.sql  # Vector embeddings for semantic search
├── public/
│   └── index.html                 # Single-page job listing web interface
├── src/
│   ├── __tests__/                  # Unit tests (262 tests passing)
│   │   ├── gmail-auth.test.ts      # 8 tests for OAuth authentication
│   │   ├── email-scanner.test.ts   # 14 tests for email fetching
│   │   ├── email-categorizer.test.ts # 13 tests for AI categorization
│   │   ├── job-portal-domains.test.ts # 15 tests for domain whitelisting
│   │   ├── url-extractor.test.ts   # 28 tests for URL extraction
│   │   ├── job-scraper.test.ts     # 43 tests for salary extraction (ranges, single values, formats, currencies, periods)
│   │   ├── database.test.ts        # 96 tests for database operations (emails, jobs, skills, salary, descriptions, processed)
│   │   ├── server.test.ts          # 27 tests for web server API endpoints
│   │   └── embeddings.test.ts      # 18 tests for vector embeddings and semantic search
│   ├── email-categorizer.ts        # AI-powered categorization with Ollama
│   ├── email-scanner.ts            # Email fetching with progress bars
│   ├── gmail-auth.ts               # Gmail OAuth authentication
│   ├── job-portal-domains.ts       # Whitelist of 70+ job board domains
│   ├── url-extractor.ts            # Job URL extraction and title parsing
│   ├── job-scraper.ts              # Web scraping module for job pages (cheerio)
│   ├── database.ts                 # SQLite database operations (emails, jobs, skills, matching, descriptions)
│   ├── embeddings.ts               # Vector embeddings module for semantic search (Ollama + cosine similarity)
│   ├── index.ts                    # Main entry point (Step 1: Email scanning)
│   ├── extract-jobs.ts             # Job extraction script (Step 2: Job URL extraction)
│   ├── process-jobs.ts             # Job processing script (Step 3: Scrape & summarize descriptions)
│   ├── queue.ts                    # Bull queue module for background job processing
│   ├── worker.ts                   # Queue worker - registers and coordinates all job processors
│   ├── server.ts                   # Web server for job listing interface (API + static files)
│   └── jobs/                       # Bull job processors (modular organization)
│       ├── embedding.job.ts        # Embedding generation and blacklist checking
│       ├── email-scan.job.ts       # Email scanning and categorization
│       ├── job-extraction.job.ts   # Job URL extraction from emails
│       └── job-processing.job.ts   # Job description scraping and processing
├── docker-compose.yml             # Redis container configuration for queue
├── migrate.sh                      # Database migration script (executable)
├── job-seeker.db                   # SQLite database (git-ignored, auto-created)
├── credentials.json                # Google OAuth credentials (git-ignored)
├── token.json                      # OAuth token (git-ignored, auto-generated)
├── skills.md                       # Your skills profile (git-ignored, optional)
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Testing configuration
└── package.json                    # Dependencies and scripts
```

## Configuration

### Environment Variables

You can configure the application using environment variables:

```bash
# .env file (optional)
OLLAMA_HOST=http://localhost:11434  # Default Ollama host
FETCH_DESCRIPTIONS=true              # Enable automatic job description fetching in scan:jobs
```

**Available environment variables:**
- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `FETCH_DESCRIPTIONS` - Enable job description fetching during job extraction (default: `true`)
  - Set to `false` to disable automatic description fetching and only extract job URLs
  - Requires Ollama to be running when enabled
  - Jobs are saved even if description fetching fails

### Email Query Customization

Edit `src/index.ts` to customize the email search query:

```typescript
const emails = await fetchEmails(auth, {
  query: 'newer_than:7d',  // Last 7 days (default)
  maxResults: 20,          // Number of emails to fetch (default: 20)
  showProgress: true,      // Show progress bars (default: true)
});
```

**Gmail search query examples:**
- `newer_than:7d` - Emails from last 7 days
- `newer_than:1d` - Emails from last day
- `subject:job OR subject:opportunity` - Emails with specific subjects
- `from:linkedin.com OR from:indeed.com` - Emails from specific domains
- `is:unread newer_than:7d` - Only unread emails from last 7 days

## Managing Platforms

The application uses a `platforms` database table to manage which job platforms can be crawled. Some platforms (like LinkedIn) require complex authentication that makes scraping impractical.

### Platform Database

The platforms table includes:
- **70+ pre-configured platforms** - All known job boards from `job-portal-domains.ts`
- **Crawlability flags** - `can_crawl` (0 or 1) to control which platforms can have descriptions fetched
- **Skip reasons** - Explanatory text for why a platform cannot be crawled
- **Smart processing** - All jobs are saved, but descriptions are only fetched for crawlable platforms

### Non-Crawlable Platforms

By default, these platforms are marked as non-crawlable:
- **LinkedIn** - Requires multi-level authentication (username, password, mobile app verification)

When jobs from non-crawlable platforms are encountered, they are:
- **Saved to the database** - Job title and URL are tracked for completeness
- **AI-Generated descriptions from email** - Uses Ollama to create structured job descriptions from the email notification content (if FETCH_DESCRIPTIONS is enabled)
- **Tracked separately in statistics** - Shows count of email-generated vs web-scraped descriptions
- **Logged for visibility** - Console output shows which platforms had descriptions generated from email

This approach ensures you have a complete record of ALL job opportunities (including LinkedIn) with descriptions. For crawlable platforms, descriptions come from web scraping; for non-crawlable platforms, descriptions are generated from the email notification using AI.

### Viewing Platform Status

To see all platforms and their crawlability status, you can query the database directly:

```typescript
import { getPlatforms, getPlatformStats } from './src/database';

// Get all platforms
const platforms = getPlatforms();
platforms.forEach(p => {
  console.log(`${p.platform_name} (${p.domain}): ${p.can_crawl ? 'Crawlable' : 'Non-crawlable'}`);
  if (!p.can_crawl && p.skip_reason) {
    console.log(`  Reason: ${p.skip_reason}`);
  }
});

// Get statistics
const stats = getPlatformStats();
console.log(`Total platforms: ${stats.total}`);
console.log(`Crawlable: ${stats.crawlable}`);
console.log(`Non-crawlable: ${stats.nonCrawlable}`);
```

### Updating Platform Crawlability

If you need to change whether a platform can be crawled:

```typescript
import { updatePlatformCrawlability } from './src/database';

// Disable crawling for a platform
updatePlatformCrawlability('example.com', false, 'Requires authentication');

// Enable crawling for a platform
updatePlatformCrawlability('example.com', true);
```

Or directly via SQL:

```sql
-- Disable crawling
UPDATE platforms
SET can_crawl = 0, skip_reason = 'Requires authentication'
WHERE domain = 'example.com';

-- Enable crawling
UPDATE platforms
SET can_crawl = 1, skip_reason = NULL
WHERE domain = 'example.com';
```

### Adding New Platforms

To add a new platform that's not in the database:

```sql
INSERT INTO platforms (platform_name, domain, can_crawl, skip_reason)
VALUES ('New Job Board', 'newjobs.com', 1, NULL);
```

Unknown platforms (not in the database) are **allowed by default** - the system will attempt to crawl them.

## Troubleshooting

### Ollama Connection Issues

**Error**: "Ollama is not available. Please ensure Ollama is running."

**Solutions**:
1. Check if Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Start Ollama if not running:
   ```bash
   ollama serve
   ```

3. Verify a model is installed:
   ```bash
   ollama list
   ```

4. Pull a model if none available:
   ```bash
   ollama pull llama3.2
   ```

### Gmail Authentication Issues

**Error**: "redirect_uri_mismatch"

**Solutions**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add: `http://localhost:3000`
5. Click **Save**
6. Delete `token.json` and try again

### Rate Limiting

**Error**: "User rate limit exceeded"

**Solutions**:
- Reduce `maxResults` to fetch fewer emails at once
- Add delays between batch operations
- Check your Gmail API quota in Google Cloud Console

### Token Expired

**Error**: "invalid_grant" or "Token has been expired or revoked"

**Solutions**:
1. Delete the `token.json` file
2. Run the application again to re-authenticate
3. Complete the OAuth flow in your browser

## Technologies

- **TypeScript** - Type-safe JavaScript for reliability
- **Node.js** - Runtime environment
- **pnpm** - Fast, disk space efficient package manager
- **Gmail API** (googleapis) - Email access and manipulation
- **Ollama** - Local LLM inference for AI-powered categorization and job summarization
- **SQLite** (better-sqlite3) - Fast, embedded database for email and job storage
- **cheerio** - Fast, flexible HTML parsing for web scraping
- **cli-progress** - Terminal progress bars
- **Vitest** - Modern testing framework
- **dotenvx** - Environment variable management
- **tsx** - TypeScript execution

## Development

### Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run tests with UI dashboard
pnpm test:ui

# Build the project
pnpm build
```

### Code Structure

- **gmail-auth.ts** - Handles OAuth 2.0 authentication flow, token management, and Gmail API client setup
- **email-scanner.ts** - Fetches emails and bodies from Gmail with progress tracking
- **job-portal-domains.ts** - Maintains whitelist of 70+ known job board and freelance platform domains
- **email-categorizer.ts** - Two-stage categorization: domain check first, then Ollama LLM for unknown senders
- **url-extractor.ts** - Job URL extraction module:
  - Pattern matching for 15+ job board platforms
  - Generic career page URL detection
  - Job title parsing from email subjects and bodies
  - URL deduplication (removes tracking parameters)
- **job-scraper.ts** - Web scraping module for job pages:
  - Fetches HTML with proper browser headers
  - Extracts job descriptions using cheerio with 15+ platform-specific selectors
  - **AI-powered salary extraction** using Ollama LLM:
    - Primary: Ollama analyzes job page text with context awareness
    - Fallback: Regex patterns for when Ollama is unavailable
    - Handles multiple formats: US ($80,000), European (€80.000,50), Swiss (CHF 80'000)
    - Supports ranges and single values with k-suffix ("50-60k" → 50k-60k)
    - Detects currencies (USD, EUR, GBP, CHF) and periods (yearly, monthly, hourly, etc.)
    - Returns structured data (min, max, currency, period)
    - Better accuracy with complex or unusual salary formats
  - Cleans and normalizes extracted text
  - Removes noise elements (scripts, styles, navigation, footers)
  - Fallback extraction strategies for unknown platforms
- **database.ts** - SQLite database operations including:
  - Email storage with smart retention (full body for high-confidence, metadata for low-confidence)
  - Job tracking to prevent duplicate scans (with description field)
  - Skills management (70 pre-populated skills from resume)
  - Job-skill matching with relevance scoring
  - Match percentage calculation for job compatibility
  - Query functions for finding matching jobs by skill requirements
  - COALESCE updates to preserve existing data
- **embeddings.ts** - Vector embeddings for semantic search:
  - Ollama integration with nomic-embed-text model (768 dimensions)
  - Binary buffer conversion for SQLite storage
  - Cosine similarity calculation for ranking results
  - Functions: generateEmbedding, saveJobEmbedding, getJobEmbedding, searchSimilarJobs
  - Batch generation: getJobsWithoutEmbeddings, generateAndSaveJobEmbedding
  - Statistics: getEmbeddingStats for tracking coverage
- **index.ts** - Step 1: Email scanning workflow (categorization and persistence)
- **extract-jobs.ts** - Step 2: Job extraction workflow (URL extraction and job persistence)
- **process-jobs.ts** - Step 3: Job description processing workflow:
  - Fetches jobs without descriptions from database
  - Scrapes job pages using job-scraper module
  - Generates AI summaries using Ollama (structured format)
  - Saves summaries to database with data preservation
  - Progress tracking with error reporting
  - Rate limiting (1-second delay between requests)

### Adding New Features

1. Create a feature branch (never commit to main/master)
2. Write TypeScript code with proper types
3. Add at least 2 unit tests for new functionality
4. Use `console.debug()` for debug output (not `console.log()`)
5. Update README.md for business logic changes
6. Run tests to ensure everything passes

### Adding Database Migrations

1. **Create a new migration file** in `migrations/` folder with incremented number:
   - Example: `003_add_skills_column.sql`
   - Use descriptive names with snake_case
   - Format: `{number}_{description}.sql`

2. **Write SQL statements** in the migration file:
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
   The script automatically tracks applied migrations and skips already-applied ones.

4. **Verify the migration**:
   ```bash
   sqlite3 job-seeker.db "SELECT * FROM migrations ORDER BY applied_at;"
   ```

5. **Important guidelines**:
   - ✅ Commit migration files to version control (NOT gitignored)
   - ✅ Never modify existing migration files - always create new ones
   - ✅ Use `IF NOT EXISTS` for idempotency
   - ✅ Test migrations on a copy of the database first
   - ❌ Never delete migration files
   - ❌ No rollback support - plan carefully

## Security Notes

- `credentials.json` and `token.json` are git-ignored for security
- Never commit these files to version control
- Keep your OAuth credentials secure and private
- All LLM processing happens locally via Ollama - no data leaves your machine
- Email content is only analyzed locally and never sent to external services

### Version Control

**Files to commit** (tracked in git):
- Source code (`src/`, `*.ts`)
- Migration files (`migrations/*.sql`)
- Configuration (`package.json`, `tsconfig.json`, etc.)
- Documentation (`README.md`, `CLAUDE.md`)
- Migration script (`migrate.sh`)

**Files NOT to commit** (git-ignored):
- Database files (`*.db`, `*.sqlite`)
- OAuth credentials (`credentials.json`, `token.json`)
- Environment files (`.env`, `.env.*`)
- Build output (`dist/`, `node_modules/`)
- Personal data (`skills.md`, `resume.md`)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

ISC
