# Database Module Structure

This folder contains the refactored PostgreSQL database module, organized by entity.

## Folder Structure

```
src/database/
├── index.ts          # Main entry point with common functions
├── types.ts          # Shared TypeScript interfaces
├── email.ts          # Email-related database functions
├── job.ts            # Job-related database functions
├── platform.ts       # Platform-related database functions
├── blacklist.ts      # Blacklist keyword functions
├── embedding.ts      # Vector embedding functions (pgvector)
├── log.ts            # Logging functions
└── skill.ts          # Skill matching functions (stubs)
```

## Module Responsibilities

### `index.ts` - Common Functions
- `getPool()` - Get PostgreSQL connection pool
- `closeDatabase()` - Close database connection
- `query()` - Execute raw SQL queries
- `checkConnection()` - Verify database connectivity
- `initializeDatabase()` - Initialize database and verify extensions
- Re-exports all entity modules

### `types.ts` - Shared Types
- `EmailRow` - Email table row interface
- `JobRow` - Job table row interface
- `PlatformRow` - Platform table row interface
- `BlacklistKeyword` - Blacklist keyword interface

### `email.ts` - Email Functions
- `isEmailScanned()` - Check if email was already scanned
- `saveEmail()` - Save/update email with categorization
- `getScannedEmailIds()` - Get all scanned email IDs
- `getHighConfidenceEmails()` - Get high-confidence job emails
- `getEmails()` - Get emails with filters
- `getEmailStats()` - Get email statistics
- `markEmailAsProcessed()` - Mark single email as processed
- `markEmailsAsProcessed()` - Mark multiple emails as processed
- `getUnprocessedEmails()` - Get emails not yet processed
- `clearAllEmails()` - Delete all emails (testing)

### `job.ts` - Job Functions
- `isJobScanned()` - Check if job URL was already scanned
- `saveJob()` - Legacy sync version (throws error)
- `saveJobAsync()` - Save/update job with salary and description (returns `{ id: number, isNew: boolean }`)
- `updateJobProcessingStatus()` - Update job processing status
- `getScannedJobLinks()` - Get all scanned job URLs
- `getJobs()` - Get jobs with filters
- `getJobStats()` - Get job statistics
- `getJobById()` - Get single job by ID
- `deleteJob()` - Delete job by ID
- `markJobBlacklisted()` - Mark job as blacklisted
- `resetAllJobsBlacklisted()` - Reset all blacklist flags
- `getBlacklistedJobCount()` - Count blacklisted jobs
- `clearAllJobs()` - Delete all jobs (testing)

### `platform.ts` - Platform Functions
- `getPlatforms()` - Get all job platforms
- `getPlatformByDomain()` - Find platform by URL/domain
- `getPlatformIdFromEmail()` - Extract platform from email address
- `canCrawlUrl()` - Check if URL can be crawled
- `getSkipReason()` - Get reason for non-crawlable URL
- `updatePlatformCrawlability()` - Update crawl permissions
- `getPlatformStats()` - Get platform statistics

### `blacklist.ts` - Blacklist Functions
- `getBlacklistKeywords()` - Get all blacklist keywords
- `saveBlacklistKeywordWithoutEmbedding()` - Save keyword without vector
- `updateBlacklistKeywordEmbedding()` - Add vector embedding to keyword
- `clearBlacklist()` - Delete all blacklist keywords
- `getBlacklistText()` - Get keywords as newline-separated text

### `embedding.ts` - Embedding Functions (pgvector)
- `saveJobEmbedding()` - Save job vector embedding
- `getJobEmbedding()` - Get job vector embedding
- `hasJobEmbedding()` - Check if job has embedding
- `getJobsWithoutEmbeddings()` - Get jobs needing embeddings
- `searchSimilarJobsPG()` - Semantic search using cosine similarity
- `clearAllEmbeddings()` - Delete all embeddings (testing)
- `getEmbeddingStats()` - Get embedding statistics
- `getJobsWithEmbeddings()` - Get jobs with embeddings (for blacklist checking)

### `log.ts` - Logging Functions
- `saveLog()` - Save log entry (fire-and-forget)

### `skill.ts` - Skill Functions (Stubs)
⚠️ **Note:** These functions are stubs that throw "not implemented" errors.
They need proper PostgreSQL implementation.

- `getSkillByName()` - Get skill by name
- `addSkillToJob()` - Associate skill with job
- `addSkillsToJob()` - Associate multiple skills
- `removeSkillFromJob()` - Remove skill association
- `getSkillsForJob()` - Get skills for a job
- `getJobsForSkill()` - Get jobs for a skill
- `getJobMatchScore()` - Calculate job match score
- `findMatchingJobs()` - Find matching jobs by skills
- `getJobSkillMatchStats()` - Get skill matching statistics
- `clearAllJobSkillMatches()` - Clear all matches (testing)

## Usage

Import functions from the main module:

```typescript
import {
  getJobs,
  saveJobAsync,
  getEmailStats,
  searchSimilarJobsPG,
  closeDatabase
} from './database';

// Or import from specific modules:
import { getJobs } from './database/job';
import { saveEmail } from './database/email';
```

## Migration Notes

- **Async/Await Required:** All functions are now async (except `saveJob` which throws an error)
- **PostgreSQL-specific:** Uses PostgreSQL-specific features like pgvector
- **Backwards Compatibility:** Old `database.ts` backed up to `database.ts.backup`
- **Test Updates Needed:** Tests need updating from sync to async API

## Development

- All database queries use the shared `query()` function from `index.ts`
- Connection pooling managed by `getPool()`
- Environment variables configured in `DB_CONFIG` (index.ts)
