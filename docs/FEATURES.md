# Features

[← Back to README](../README.md)

## Currently Implemented

### Email Processing
- ✅ **Gmail OAuth Authentication** - Secure OAuth 2.0 authentication with automatic token refresh
- ✅ **Email Scanning** - Fetches emails from Gmail with customizable queries and date ranges
- ✅ **Full Email Body Extraction** - Downloads complete email content including multipart MIME messages
- ✅ **Domain-Based Categorization** - 70+ known job board domains for 100% accurate detection (freelancermap, LinkedIn, Indeed, Upwork, etc.)
- ✅ **AI-Powered Categorization** - Uses local Ollama LLM with multilingual support for emails from unknown senders
- ✅ **Multilingual Support** - Analyzes emails in English, German, French, Spanish, and more without keyword dependency
- ✅ **Duplicate Detection** - Automatically skips already processed emails for faster scans
- ✅ **Processed Tracking** - Marks emails as processed to prevent reprocessing on subsequent runs

### Database & Storage
- ✅ **PostgreSQL Database** - Production-ready database with async connection pooling
- ✅ **Vector Search (pgvector)** - Semantic job search using 384-dimensional embeddings
- ✅ **Smart Data Retention** - Full body for high-confidence, metadata only for low-confidence
- ✅ **Migration System** - Trackable database migrations with automatic version control
- ✅ **Platform Tracking** - Each email linked to its source platform (LinkedIn, Indeed, etc.)
- ✅ **Skills Database** - Pre-populated with 70 skills across 11 categories

### Job Extraction & Processing
- ✅ **URL Extraction** - Intelligent extraction of job URLs from emails (LinkedIn, Indeed, Greenhouse, career pages, etc.)
- ✅ **Job Title Extraction** - Smart parsing of job titles from email subjects with fallback to body content and AI extraction
- ✅ **AI Title Extraction** - Uses Ollama to extract job titles when pattern matching fails
- ✅ **Multi-Job Email Support** - Handles emails containing multiple job postings
- ✅ **Web Scraping** - Fetches job pages with intelligent content extraction using cheerio
- ✅ **AI Job Summarization** - Uses Ollama to generate structured job description summaries
- ✅ **Multi-Platform Support** - Works with 15+ job platforms (LinkedIn, Indeed, Greenhouse, Lever, Workday, etc.)
- ✅ **Platform Crawl Control** - Database-driven platform management with configurable crawlability flags
- ✅ **Smart Filtering** - Automatically skips non-crawlable platforms (e.g., LinkedIn requires multi-level authentication)
- ✅ **Job Tracking Table** - Prevents duplicate job scans with title and link storage

### Salary & Compensation
- ✅ **AI-Powered Salary Extraction** - Uses Ollama LLM to intelligently extract salary information from job pages
  - **Primary method**: Ollama analyzes job page text with context-aware extraction
  - **Fallback method**: Regex patterns for when Ollama is unavailable
  - **Validation**: Rejects unrealistic values (yearly: 20k-1M, monthly: 1.5k-100k, hourly: 10-500)
  - Salary ranges: "$80,000 - $120,000", "€60k-€80k", "CHF 100'000 - CHF 120'000"
  - Single values: "$100,000", "€75k", "£50,000/year"
  - Multiple currencies: USD, EUR, GBP, CHF with automatic normalization
  - Multiple formats: US (80,000.50), European (80.000,50), Swiss (80'000)
  - Period detection: yearly, monthly, weekly, daily, hourly
  - Smart k-suffix handling: "50-60k" interpreted as "50k-60k"
- ✅ **Structured Salary Data** - Track min/max salary ranges with currency and period for precise filtering

### Search & Discovery
- ✅ **Vector Search (RAG)** - Semantic job search using vector embeddings
  - **Ollama embeddings**: Uses nomic-embed-text model (384 dimensions)
  - **PostgreSQL storage**: Embeddings stored in pgvector extension
  - **Cosine similarity**: Rank jobs by semantic relevance to search queries
  - **Smart search toggle**: UI switch between keyword and semantic search
  - **Embedding generation**: One-click generation for all jobs without embeddings
- ✅ **Blacklist Support** - Semantic blacklist matching to filter unwanted jobs
- ✅ **Skills Matching** - Match jobs against your skill profile

### Web Interface
- ✅ **Job Listing UI** - Single-page application at http://localhost:3001
  - Sortable table with all job data (title, link, salary, description, date)
  - Real-time search/filter functionality
  - Salary formatting with currency and period
  - Description preview with hover for full text
  - Statistics display (total jobs, with salary, with descriptions)
- ✅ **Real-time WebSocket Updates** - Live progress during email scanning
  - WebSocket server streams scan progress to all connected clients
  - Live email display with checkmark/X indicator
  - Progress bar during categorization
  - Confidence badges (high/medium/low)
  - Auto-reconnect if connection drops
- ✅ **Hot-Reload Development** - Frontend automatically reloads when files change
  - File watching monitors `public/` directory
  - WebSocket-based instant reload notifications
  - Development mode with `NODE_ENV=development`

### Background Processing
- ✅ **Redis + Bull Queues** - Async job processing
  - Embedding generation jobs
  - Email scanning jobs
  - Job extraction jobs
  - Job processing jobs
  - Blacklist embedding jobs
- ✅ **Worker Process** - Background job processor with auto-restart
- ✅ **Queue Status** - Monitor queue status via API

### Developer Experience
- ✅ **Visual Progress Bars** - Real-time progress tracking for all operations
- ✅ **Confidence Scoring** - High/medium/low confidence levels for each categorization
- ✅ **Color-Coded Terminal Output** - Green checkmarks (✓) for job-related, red X (✗) for others
- ✅ **Automatic Model Selection** - Detects and uses the best available Ollama model
- ✅ **Centralized Logging System** - Database-backed logging for errors and warnings
  - Global logger available to all modules
  - Database persistence for historical analysis
  - Log levels: error, warning, info, debug
  - Stack traces for errors
  - Context support for structured data
- ✅ **Comprehensive Unit Tests** - 310+ passing tests using Vitest
- ✅ **Automated Test Enforcement** - Git pre-commit hooks automatically run tests

## Coming Soon

- 🔜 **Enhanced Skills Matching** - More sophisticated matching against skills.md profile
- 🔜 **Gmail Marking** - Automatically mark matching jobs as important/starred
- 🔜 **Email Notifications** - Get notified of new matching jobs
- 🔜 **Job Application Tracking** - Track which jobs you've applied to
- 🔜 **Company Research** - Automatically research companies using AI

## See Also

- [Setup Guide →](SETUP.md) - Get started
- [Usage Guide →](USAGE.md) - Learn the workflows
- [Architecture →](ARCHITECTURE.md) - Understand how it works
