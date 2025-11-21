# Architecture

[← Back to README](../README.md)

Understanding how Job Seeker works internally.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Layer                           │
├─────────────────────────────────────────────────────────────┤
│  CLI Commands          │  Web Interface (localhost:3001)    │
│  - scan:emails         │  - Job listings                     │
│  - scan:jobs           │  - Search (keyword + semantic)      │
│  - scan:all            │  - Blacklist management             │
└───────────┬─────────────┴──────────────┬─────────────────────┘
            │                            │
┌───────────▼────────────┐   ┌───────────▼──────────────┐
│  Email Processing      │   │  Web Server (Express)    │
│  - Gmail OAuth         │   │  - REST API              │
│  - Email fetching      │   │  - Static files          │
│  - AI categorization   │   │  - WebSocket server      │
│  - Job extraction      │   │  - Hot-reload            │
└───────────┬────────────┘   └───────────┬──────────────┘
            │                            │
┌───────────▼────────────────────────────▼──────────────┐
│              PostgreSQL Database + pgvector            │
│  emails │ jobs │ platforms │ blacklist │ embeddings    │
└───────────┬────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────┐
│         Background Processing (Redis + Bull)           │
│  - Embedding generation jobs                          │
│  - Email scanning jobs                                │
│  - Job extraction jobs                                │
│  - Job processing jobs                                │
│  - Blacklist embedding jobs                           │
└───────────┬────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────┐
│               Ollama (Local LLM)                       │
│  - Email categorization (llama3.2)                    │
│  - Job title extraction                               │
│  - Job summarization                                  │
│  - Salary extraction                                  │
│  - Embeddings (nomic-embed-text)                      │
└────────────────────────────────────────────────────────┘
```

## Component Details

### Gmail Integration

**Module:** `src/gmail-auth.ts`, `src/email-scanner.ts`

**Flow:**
1. OAuth 2.0 authentication (first run)
2. Token persistence (`token.json`)
3. Email fetching with Gmail API
4. Body extraction (multipart MIME support)
5. Progress tracking with cli-progress

**Two-Stage Email Categorization:**

**Stage 1: Domain Whitelisting** (`src/job-portal-domains.ts`)
- 70+ known job board domains
- Instant HIGH confidence recognition
- 100% accuracy for known platforms

**Stage 2: AI Analysis** (`src/email-categorizer.ts`)
- For unknown senders only
- Uses Ollama LLM (llama3.2/llama3.1/mistral/phi3)
- Multilingual support (EN, DE, FR, ES, IT+)
- Temperature: 0.2 for consistency
- Returns: isJobRelated, confidence, reason, keywords

### Job Extraction

**Module:** `src/url-extractor.ts`

**Pattern Matching:**
- 15+ platform-specific patterns
- Generic career page detection
- URL deduplication (removes tracking params)
- Title extraction from subject/body

**AI Title Extraction:** (`src/ai-title-extractor.ts`)
- Fallback when patterns fail
- Context-aware (500 chars around URL)
- Ollama temperature: 0.1
- Validates title length and generic patterns

### Web Scraping

**Module:** `src/job-scraper.ts`

**Platform-Specific Selectors:**
- LinkedIn, Indeed, Greenhouse, Lever
- Workday, SmartRecruiters, etc.
- 15+ platform configurations

**AI Salary Extraction:**
- Primary: Ollama analyzes text
- Fallback: Regex patterns
- Validation: Realistic ranges
- Multiple formats/currencies
- Structured output (min, max, currency, period)

**AI Job Summarization:**
- Structured format (Role, Responsibilities, Requirements, etc.)
- Temperature: 0.3
- Max tokens: 1000
- Professional tone

### Vector Search

**Module:** `src/embeddings.ts`

**Embedding Generation:**
- Model: nomic-embed-text (384 dimensions)
- PostgreSQL pgvector extension
- Cosine similarity for ranking
- Batch generation support

**Search Flow:**
1. Generate query embedding
2. Calculate similarity with all job embeddings
3. Rank by cosine similarity
4. Return top N results

**Blacklist Matching:**
- Semantic keyword filtering
- Configurable similarity threshold (MIN_SIMILARITY)
- Same embedding model for consistency

### Background Processing

**Module:** `src/queue.ts`, `src/worker.ts`, `src/jobs/`

**Queue System:**
- Redis + Bull for job queue
- Multiple job types with priorities
- Retry logic for failed jobs
- Progress tracking

**Job Processors:**
- `embedding.job.ts` - Generate embeddings + blacklist check
- `email-scan.job.ts` - Email scanning
- `job-extraction.job.ts` - Job URL extraction
- `job-processing.job.ts` - Description fetching
- `blacklist-embedding.job.ts` - Blacklist embedding generation

### Database Layer

**Module:** `src/database/`

**Modular Organization:**
- `index.ts` - Connection pooling
- `types.ts` - Shared TypeScript types
- `email.ts` - Email operations
- `job.ts` - Job operations
- `platform.ts` - Platform management
- `blacklist.ts` - Blacklist operations
- `embedding.ts` - Vector operations
- `log.ts` - Logging operations
- `skill.ts` - Skills management

**Design Patterns:**
- Connection pooling (pg Pool)
- Async/await throughout
- Transaction support
- Error handling
- Type safety

### Web Server

**Module:** `src/server.ts`

**Features:**
- Express.js REST API
- Static file serving
- WebSocket for real-time updates
- Hot-reload in development
- CORS support

**API Endpoints:**
- GET `/api/jobs` - List jobs
- POST `/api/jobs/search` - Semantic search
- GET `/api/platforms` - List platforms
- POST `/api/scan` - Trigger email scan
- POST `/api/embeddings/generate` - Generate embeddings
- POST `/api/reset` - Reset database
- GET `/api/blacklist` - Get blacklist
- POST `/api/blacklist` - Update blacklist

## Data Flow

### Email Scan Flow

```
Gmail API
  ↓
Email Metadata
  ↓
Already Scanned? ──Yes──→ Skip
  ↓ No
Fetch Email Body
  ↓
Domain Check ──Known──→ HIGH confidence
  ↓ Unknown
Ollama Analysis
  ↓
Save to Database (emails table)
  ↓
Mark as Processed
```

### Job Extraction Flow

```
High-Confidence Emails
  ↓
Extract URLs (pattern matching)
  ↓
Extract Titles (AI + patterns)
  ↓
Check Platform Crawlability
  ↓
Already in DB? ──Yes──→ Skip
  ↓ No
Save Job (jobs table)
  ↓
Crawlable? ──No──→ Generate description from email (Ollama)
  ↓ Yes
Queue for Processing
  ↓
Worker: Scrape + Summarize
  ↓
Extract Salary (Ollama)
  ↓
Update Job in Database
  ↓
Queue Embedding Generation
  ↓
Worker: Generate Embedding
  ↓
Check Blacklist (semantic)
  ↓
Mark as Blacklisted (if match)
```

### Search Flow

**Keyword Search:**
```
User Query
  ↓
PostgreSQL LIKE/ILIKE query
  ↓
Return matching jobs
```

**Semantic Search:**
```
User Query
  ↓
Generate Query Embedding (Ollama)
  ↓
Calculate Similarity (pgvector)
  ↓
Rank by Cosine Similarity
  ↓
Return top N results
```

## Technology Decisions

### Why PostgreSQL?

- ✅ Production-ready relational database
- ✅ pgvector extension for embeddings
- ✅ Better concurrency than SQLite
- ✅ Scalable for large datasets
- ✅ ACID compliance
- ✅ Rich query capabilities

### Why Ollama?

- ✅ Runs locally (privacy)
- ✅ No external API calls
- ✅ No rate limits
- ✅ Fast inference
- ✅ Multiple model support
- ✅ Embedding generation

### Why Redis + Bull?

- ✅ Reliable job queue
- ✅ Retry logic built-in
- ✅ Priority support
- ✅ Progress tracking
- ✅ Concurrent job processing
- ✅ Job persistence

### Why TypeScript?

- ✅ Type safety catches errors early
- ✅ Better IDE support
- ✅ Self-documenting code
- ✅ Refactoring confidence
- ✅ Modern language features

## Performance Considerations

### Database

- Connection pooling (configurable max connections)
- Indexed columns for common queries
- pgvector for efficient similarity search
- Async operations throughout

### API

- Rate limiting for web scraping (1s delays)
- Caching (future improvement)
- Pagination support
- WebSocket for real-time updates

### Background Jobs

- Queue-based processing
- Concurrent job execution
- Retry logic for failures
- Progress tracking

### Memory

- Streaming where possible
- Batch operations
- Connection pooling
- Efficient embedding storage

## Security

### OAuth 2.0

- Secure Gmail authentication
- Token refresh handled automatically
- Credentials never committed to git

### Local Processing

- All AI processing happens locally (Ollama)
- Email content never sent externally
- No external API dependencies

### Database

- Credentials in `.env` (git-ignored)
- Parameterized queries (SQL injection protection)
- Connection pooling limits
- Password-protected access

## See Also

- [Database Guide →](DATABASE.md) - Schema details
- [Development →](DEVELOPMENT.md) - Code structure
- [API Reference →](API.md) - Endpoint documentation
