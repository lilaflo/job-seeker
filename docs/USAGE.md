# Usage Guide

[← Back to README](../README.md)

Complete guide to using Job Seeker's commands and workflows.

## Quick Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services (Redis, Worker, Server) with hot-reload |
| `pnpm start` | Start all services (production mode) |
| `pnpm scan:all` | Complete workflow (emails + jobs) |
| `pnpm scan:emails` | Scan and categorize emails only |
| `pnpm scan:jobs` | Extract jobs and fetch descriptions |
| `pnpm process:jobs` | Process existing jobs (rarely needed) |
| `pnpm serve:dev` | Web server only (with hot-reload) |
| `pnpm worker` | Background worker only |
| `pnpm test` | Run all unit tests |

## Complete Workflows

### Start the Application

**Development mode** (recommended):

```bash
pnpm dev
```

This starts all services with hot-reload:
- **Redis** - Queue backend (blue output)
- **Worker** - Background job processor (yellow output)
- **Web Server** - API and UI at http://localhost:3001 (green output)
- **Hot-reload** - Frontend reloads when `public/index.html` changes

**Production mode:**

```bash
pnpm start
```

Same as dev mode but without hot-reload and with `NODE_ENV=production`.

**Individual services** (if needed):

```bash
pnpm serve:dev    # Web server with hot-reload
pnpm serve        # Web server without hot-reload
pnpm worker       # Just the worker
pnpm redis:start  # Just Redis (detached)
pnpm redis:stop   # Stop Redis
```

### Step 1: Scan and Categorize Emails

Scan your Gmail inbox and categorize job-related emails:

```bash
dotenvx run -- pnpm scan:emails
```

**What it does:**
1. Authorizes with Gmail (OAuth 2.0) on first run
2. Fetches emails from the last 7 days
3. Skips already-scanned emails (duplicate detection)
4. Fetches full email bodies
5. Categorizes using domain whitelisting and AI (Ollama)
6. Saves results to PostgreSQL database
7. Marks each email as "processed"
8. Displays summary with colored output

**Example output:**
```
Processing Emails |████████████████████| 100% | 50/50 emails

--- Categorization Results ---
✓ 1. Remote Jobs - New Projects from office@freelancermap.de [high]
✓ 2. Jobs you may be interested in from LinkedIn [high]
✗ 3. Weekly Newsletter from newsletter@company.com [high]
✓ 4. Software Engineer Position at TechCorp [medium]
```

### Step 2: Extract and Process Jobs

Extract job URLs and fetch descriptions:

```bash
dotenvx run -- pnpm scan:jobs
```

**What it does:**
1. **Extracts all jobs**: Reads high-confidence emails and extracts job URLs
2. **Saves to database**: Stores all jobs (including non-crawlable like LinkedIn)
3. **Fetches descriptions**: Only visits crawlable job pages
4. **Generates AI summaries**: Uses Ollama for structured descriptions
5. **Processes existing jobs**: Also handles jobs without descriptions
6. **Shows statistics**: Displays extraction and processing results

**Features:**
- ✅ Tracks ALL jobs (including LinkedIn)
- ✅ Smart description fetching (only crawlable platforms)
- ✅ Handles 15+ job platforms
- ✅ Processes new and existing jobs
- ✅ Graceful error handling
- ✅ Rate limiting (1-second delays)
- ✅ Progress bars

**Optional: Disable Description Fetching**

```bash
# Fast extraction only (no descriptions)
FETCH_DESCRIPTIONS=false dotenvx run -- pnpm scan:jobs
```

### Step 3: Generate Embeddings

Embeddings are automatically queued by `scan:jobs`. The worker processes them in the background.

**Manual embedding generation:**

```bash
# Via API (when server is running)
curl -X POST http://localhost:3001/api/embeddings/generate

# Or through the web interface
# Click "Generate Embeddings" button
```

**Requirements:**
- Ollama with `nomic-embed-text` model installed
- Redis running for queue-based processing
- Worker running to process the queue

### Complete Workflow (All Steps)

Run everything in one command:

```bash
dotenvx run -- pnpm scan:all
```

This runs:
1. Step 1: Scan and categorize emails
2. Step 2: Extract jobs and process descriptions
3. Step 3: Embeddings are queued automatically

## Web Interface

Once the server is running (`pnpm dev` or `pnpm start`), open:

```bash
open http://localhost:3001
```

**Features:**
- **Job table** with sortable columns (title, link, salary, description, date)
- **Search/filter** jobs by title, URL, or description
- **Salary display** with formatted ranges (e.g., "USD 80k-120k/y")
- **Description preview** with full text on hover
- **Statistics** showing total jobs, with salary, with descriptions
- **Blacklist management** - Add keywords to filter jobs semantically
- **Semantic search** - Vector-based job search
- **Generate embeddings** - One-click embedding generation
- **Reset database** - Clear all data and re-run migrations
- **Responsive design** for desktop and mobile

## Utility Commands

### Database Maintenance

```bash
# Populate sender addresses (one-time backfill)
dotenvx run -- pnpm populate:from

# Update platform associations (one-time backfill)
dotenvx run -- pnpm update:platforms

# Reset database (caution: deletes all data)
# Better to use via API: POST http://localhost:3001/api/reset
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Build the project
pnpm build
```

### Redis Queue Management

```bash
# Start Redis container
pnpm redis:start

# Stop Redis container
pnpm redis:stop

# View queue status
curl http://localhost:3001/api/queue/status
```

## Customization

### Email Query Customization

Edit `src/index.ts` to customize the email search:

```typescript
const emails = await fetchEmails(auth, {
  query: 'newer_than:7d',  // Last 7 days (default)
  maxResults: 20,          // Number of emails (default: 20)
  showProgress: true,      // Show progress bars
});
```

**Gmail search query examples:**
- `newer_than:7d` - Emails from last 7 days
- `newer_than:1d` - Emails from last day
- `subject:job OR subject:opportunity` - Specific subjects
- `from:linkedin.com OR from:indeed.com` - Specific domains
- `is:unread newer_than:7d` - Only unread emails

### Platform Management

See which platforms can be crawled:

```sql
SELECT platform_name, hostname, can_crawl, skip_reason
FROM platforms
ORDER BY platform_name;
```

Disable crawling for a platform:

```sql
UPDATE platforms
SET can_crawl = 0, skip_reason = 'Requires authentication'
WHERE hostname = 'example';
```

Enable crawling:

```sql
UPDATE platforms
SET can_crawl = 1, skip_reason = NULL
WHERE hostname = 'example';
```

See [Database Guide →](DATABASE.md) for more queries.

## Command Reference

### Scanning Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `pnpm scan:all` | Complete workflow | Initial scan or full update |
| `pnpm scan:emails` | Email scanning only | Just categorize emails |
| `pnpm scan:jobs` | Job extraction + processing | After email scan |
| `pnpm process:jobs` | Process existing jobs | Retry failed descriptions |

### Service Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `pnpm dev` | All services (dev mode) | Development |
| `pnpm start` | All services (prod mode) | Production |
| `pnpm serve:dev` | Web server only (dev) | Frontend development |
| `pnpm serve` | Web server only (prod) | Deploy web interface |
| `pnpm worker` | Worker only | Debug background jobs |

### Development Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `pnpm test` | Run tests once | Before commit |
| `pnpm test:watch` | Run tests on change | During development |
| `pnpm test:ui` | Visual test UI | Debugging tests |
| `pnpm build` | Build TypeScript | Before deployment |

## Next Steps

- [API Reference →](API.md) - REST API endpoints
- [Database Guide →](DATABASE.md) - Query examples
- [Troubleshooting →](TROUBLESHOOTING.md) - Fix issues
- [Architecture →](ARCHITECTURE.md) - Understand internals
