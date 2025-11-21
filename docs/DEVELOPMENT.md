# Development Guide

[← Back to README](../README.md)

Guide for contributing to Job Seeker and understanding the codebase.

## Getting Started

### Prerequisites

- Familiarity with TypeScript and Node.js
- Understanding of async/await patterns
- Basic SQL knowledge
- Git workflow experience

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/yourusername/job-seeker.git
cd job-seeker

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start services
docker-compose up -d

# Run migrations
./migrations-pg/migrate.sh

# Install git hooks
./hooks/install.sh
```

## Project Structure

```
job-seeker/
├── src/
│   ├── __tests__/              # Unit tests (310+ tests)
│   ├── database/               # Database modules
│   │   ├── index.ts           # Connection pooling
│   │   ├── types.ts           # Shared types
│   │   ├── email.ts           # Email operations
│   │   ├── job.ts             # Job operations
│   │   ├── platform.ts        # Platform management
│   │   ├── blacklist.ts       # Blacklist operations
│   │   ├── embedding.ts       # Vector operations
│   │   ├── log.ts             # Logging
│   │   └── skill.ts           # Skills management
│   ├── jobs/                  # Background job processors
│   │   ├── embedding.job.ts
│   │   ├── email-scan.job.ts
│   │   ├── job-extraction.job.ts
│   │   ├── job-processing.job.ts
│   │   └── blacklist-embedding.job.ts
│   ├── gmail-auth.ts          # OAuth authentication
│   ├── email-scanner.ts       # Email fetching
│   ├── email-categorizer.ts   # AI categorization
│   ├── job-portal-domains.ts  # Domain whitelist
│   ├── url-extractor.ts       # Job extraction
│   ├── ai-title-extractor.ts  # AI title extraction
│   ├── job-scraper.ts         # Web scraping
│   ├── embeddings.ts          # Vector search
│   ├── ollama-client.ts       # Ollama helper
│   ├── queue.ts               # Queue management
│   ├── worker.ts              # Worker process
│   ├── server.ts              # Web server
│   ├── pubsub.ts              # WebSocket pub/sub
│   ├── logger.ts              # Centralized logging
│   └── index.ts               # Main entry point
├── migrations-pg/             # PostgreSQL migrations
├── public/                    # Web interface
├── docs/                      # Documentation
└── hooks/                     # Git hooks
```

## Coding Standards

### TypeScript

- **Strict mode** - All code must pass strict type checking
- **No `any` types** - Use proper types or `unknown` with type guards
- **Async/await** - Prefer over promises/callbacks
- **Arrow functions** - Use for consistency

### Naming Conventions

- **Files**: kebab-case (`email-scanner.ts`)
- **Classes**: PascalCase (`EmailScanner`)
- **Functions**: camelCase (`fetchEmails`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with `I` prefix (`IEmailMessage`)

### Debugging

- Use `console.debug()` for debug output (not `console.log`)
- Use the logger module for errors: `logger.error('message', error)`
- Include context in log messages
- Remove debug logs before committing

### Comments

- Use JSDoc for exported functions
- Explain "why" not "what"
- Keep comments up to date
- Remove commented-out code

### Example:

```typescript
/**
 * Extracts job URLs from email body using pattern matching
 * @param body - Email body text
 * @returns Array of job URLs with deduplicated tracking parameters
 */
export function extractJobUrls(body: string): string[] {
  // Implementation
}
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on changes)
pnpm test:watch

# Visual UI
pnpm test:ui

# Coverage report
pnpm test:coverage
```

### Writing Tests

**Test file naming:** `<module-name>.test.ts`

**Test structure:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('moduleName', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

**Testing guidelines:**
- Write at least 2 tests for each feature
- Test happy path and error cases
- Mock external dependencies (Gmail API, Ollama)
- Use descriptive test names
- Keep tests focused and isolated

### Test Categories

- **Unit tests** - Individual functions
- **Integration tests** - Multiple components
- **Database tests** - Database operations (currently skipped, need PostgreSQL refactor)

## Adding New Features

### Step-by-Step Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Write code with proper types**
   - Follow TypeScript strict mode
   - Use proper error handling
   - Add console.debug for development

3. **Write tests (minimum 2)**
   ```typescript
   describe('myFeature', () => {
     it('should handle normal case', () => {
       // Test implementation
     });
     
     it('should handle error case', () => {
       // Test implementation
     });
   });
   ```

4. **Run tests**
   ```bash
   pnpm test
   ```

5. **Update documentation**
   - Update README.md if user-facing
   - Update relevant docs/ files
   - Add JSDoc comments to functions

6. **Commit with clear message**
   ```bash
   git add .
   git commit -m "Feature: Add my feature description"
   ```

7. **Push and create PR**
   ```bash
   git push origin feature/my-feature
   ```

## Database Changes

### Adding a Migration

1. **Create migration file**
   ```bash
   touch migrations-pg/012_add_new_table.sql
   ```

2. **Write SQL**
   ```sql
   -- Migration: Add new table
   -- Created: 2024-01-14
   
   CREATE TABLE IF NOT EXISTS new_table (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);
   ```

3. **Test migration**
   ```bash
   ./migrations-pg/migrate.sh
   ```

4. **Update types**
   ```typescript
   // src/database/types.ts
   export interface NewTableRow {
     id: number;
     name: string;
     created_at: Date;
   }
   ```

5. **Add database functions**
   ```typescript
   // src/database/new-table.ts
   export async function insertNewTable(name: string): Promise<number> {
     const result = await query<{ id: number }>(
       'INSERT INTO new_table (name) VALUES ($1) RETURNING id',
       [name]
     );
     return result.rows[0].id;
   }
   ```

6. **Write tests**
   ```typescript
   // src/__tests__/new-table.test.ts
   describe('newTable', () => {
     it('should insert and retrieve', async () => {
       // Test implementation
     });
   });
   ```

See [Database Guide →](DATABASE.md) for more details.

## Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Commit Messages

Follow conventional commits:

```
Feature: Add semantic job search
Fix: Correct salary extraction for EUR
Refactor: Split database module
Docs: Update setup guide
Test: Add tests for URL extraction
Chore: Update dependencies
```

### Pre-Commit Hook

The git hook automatically:
- Runs all tests
- Blocks commit if tests fail
- Shows test output

**Bypass if needed** (use sparingly):
```bash
git commit --no-verify
```

## Common Tasks

### Adding a New Job Platform

1. **Add to domain whitelist**
   ```typescript
   // src/job-portal-domains.ts
   export const JOB_PORTAL_DOMAINS = [
     // ... existing
     'newplatform.com',
   ];
   ```

2. **Add to database**
   ```sql
   INSERT INTO platforms (platform_name, hostname, can_crawl)
   VALUES ('New Platform', 'newplatform', true);
   ```

3. **Add scraping selectors**
   ```typescript
   // src/job-scraper.ts
   const selectors = [
     // ... existing
     '.newplatform-job-description',
   ];
   ```

### Adding a New API Endpoint

1. **Add route**
   ```typescript
   // src/server.ts
   app.get('/api/my-endpoint', async (req, res) => {
     try {
       const data = await myFunction();
       res.json(data);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

2. **Add types**
   ```typescript
   interface MyEndpointResponse {
     data: string[];
   }
   ```

3. **Update API docs**
   ```markdown
   // docs/API.md
   ### GET /api/my-endpoint
   
   Returns my data.
   ```

### Adding a Background Job

1. **Create job processor**
   ```typescript
   // src/jobs/my-job.job.ts
   import { Job } from 'bull';
   
   export async function processMyJob(job: Job) {
     console.debug(`Processing job ${job.id}`);
     // Implementation
   }
   ```

2. **Register in worker**
   ```typescript
   // src/worker.ts
   import { processMyJob } from './jobs/my-job.job';
   
   myQueue.process('my-job', processMyJob);
   ```

3. **Enqueue jobs**
   ```typescript
   // src/queue.ts
   export async function enqueueMyJob(data: any) {
     await myQueue.add('my-job', data);
   }
   ```

## Debugging

### VS Code Launch Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Common Issues

**TypeScript errors:**
```bash
pnpm build  # See all type errors
```

**Database connection issues:**
```bash
psql -d jobseeker -c "SELECT 1;"  # Test connection
```

**Redis connection issues:**
```bash
redis-cli ping  # Should return PONG
```

**Ollama issues:**
```bash
curl http://localhost:11434/api/tags  # List models
```

## Code Review Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm build`)
- [ ] Code follows style guide
- [ ] Functions have JSDoc comments
- [ ] Tests cover new functionality (min 2)
- [ ] Documentation updated
- [ ] No console.log (use console.debug)
- [ ] Error handling present
- [ ] Types are strict (no `any`)
- [ ] Git commit message is clear

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Docs](https://vitest.dev/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Bull Queue Docs](https://github.com/OptimalBits/bull)
- [Ollama Docs](https://ollama.com/docs)

## See Also

- [Setup Guide →](SETUP.md) - Development setup
- [Architecture →](ARCHITECTURE.md) - System design
- [Database Guide →](DATABASE.md) - Database details
