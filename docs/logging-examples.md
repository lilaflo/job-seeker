# Logging Examples

The Job Seeker application includes a centralized logging system that persists logs to the database for historical analysis. This document shows how to use the logger in your code.

## Basic Usage

### Import the Logger

```typescript
import { logger } from './logger';
```

### Log Levels

The logger supports four levels: `error`, `warning`, `info`, and `debug`.

```typescript
// Error - for serious problems that need attention
logger.error('Failed to connect to database');

// Warning - for potential issues that don't stop execution
logger.warning('Using default configuration - no config file found');

// Info - for general informational messages
logger.info('Application started successfully');

// Debug - for detailed debugging information
logger.debug('Processing job ID 123');
```

## Advanced Usage

### Adding Context

Attach structured data to any log entry:

```typescript
logger.error('Database query failed', {
  context: {
    query: 'SELECT * FROM jobs',
    errorCode: 'SQLITE_BUSY',
    retryCount: 3
  }
});
```

### Custom Source

Override the automatic source detection:

```typescript
logger.warning('Rate limit approaching', {
  source: 'gmail-api',
  context: {
    currentRate: 450,
    limit: 500
  }
});
```

### Logging Exceptions

For caught exceptions, use `errorFromException`:

```typescript
try {
  await fetchJobDescription(url);
} catch (error) {
  logger.errorFromException(error, {
    source: 'job-scraper',
    context: { url, jobId: 123 }
  });
}
```

### Skip Console or Database

Sometimes you want to log only to console or only to database:

```typescript
// Log only to database (silent console)
logger.error('Background task failed', {
  skipConsole: true,
  context: { taskId: 'cleanup-001' }
});

// Log only to console (no database persistence)
logger.debug('Temporary debug info', {
  skipDatabase: true
});
```

## Querying Logs

### Get Recent Errors

```typescript
import { getRecentLogs } from './database';

// Get last 10 errors
const recentErrors = getRecentLogs('error', 10);

recentErrors.forEach(log => {
  console.log(`[${log.created_at}] ${log.message}`);
  if (log.context) {
    console.log('Context:', JSON.parse(log.context));
  }
});
```

### Filter by Level and Source

```typescript
import { getLogs } from './database';

// Get all warnings from job-scraper
const scraperWarnings = getLogs({
  level: 'warning',
  source: 'job-scraper',
  limit: 20
});
```

### Get Log Statistics

```typescript
import { getLogStats } from './database';

const stats = getLogStats();
console.log(`Total logs: ${stats.total}`);
console.log(`Errors: ${stats.errors}`);
console.log(`Warnings: ${stats.warnings}`);
```

### Pagination

```typescript
// Get logs with pagination
const page1 = getLogs({ limit: 10, offset: 0 });
const page2 = getLogs({ limit: 10, offset: 10 });
```

## Maintenance

### Delete Old Logs

```typescript
import { deleteOldLogs } from './database';

// Delete logs older than 30 days
const deletedCount = deleteOldLogs(30);
console.log(`Deleted ${deletedCount} old log entries`);
```

### Clear All Logs

```typescript
import { clearAllLogs } from './database';

// Clear all logs (useful for testing)
clearAllLogs();
```

## Real-World Examples

### Database Connection Error

```typescript
import { logger } from './logger';

async function connectToDatabase() {
  try {
    const db = await Database.connect(config);
    logger.info('Database connected successfully', {
      source: 'database',
      context: { host: config.host }
    });
    return db;
  } catch (error) {
    logger.errorFromException(error, {
      source: 'database',
      context: {
        host: config.host,
        port: config.port,
        retryAttempt: 1
      }
    });
    throw error;
  }
}
```

### API Rate Limiting

```typescript
import { logger } from './logger';

async function fetchEmails(count: number) {
  const rateLimit = 500;
  const currentUsage = await getRateUsage();

  if (currentUsage > rateLimit * 0.9) {
    logger.warning('Approaching Gmail API rate limit', {
      source: 'gmail-api',
      context: {
        currentUsage,
        limit: rateLimit,
        percentage: (currentUsage / rateLimit * 100).toFixed(1)
      }
    });
  }

  // Fetch emails...
}
```

### Job Processing Failure

```typescript
import { logger } from './logger';

async function processJob(jobId: number) {
  try {
    const job = await getJob(jobId);
    const description = await scrapeJobPage(job.link);
    const summary = await summarizeWithAI(description);

    logger.debug('Job processed successfully', {
      source: 'job-processor',
      context: { jobId, url: job.link }
    });

    return summary;
  } catch (error) {
    logger.errorFromException(error, {
      source: 'job-processor',
      context: {
        jobId,
        stage: 'scraping',
        url: job?.link
      }
    });

    // Re-throw or handle appropriately
    throw error;
  }
}
```

## Database Schema

Logs are stored in the `logs` table with the following structure:

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK(level IN ('error', 'warning', 'info', 'debug')),
  message TEXT NOT NULL,
  source TEXT,              -- Module/file that generated the log
  context TEXT,             -- JSON string for additional data
  stack_trace TEXT,         -- Stack trace for errors
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Best Practices

1. **Use appropriate log levels**
   - `error`: For failures that need immediate attention
   - `warning`: For potential issues that should be monitored
   - `info`: For important business events
   - `debug`: For detailed troubleshooting information

2. **Include context**
   - Always add relevant context data to help with debugging
   - Use structured data (objects) rather than concatenating strings

3. **Don't log sensitive data**
   - Never log passwords, tokens, or personal information
   - Sanitize URLs that might contain credentials

4. **Use descriptive messages**
   - Messages should be clear and actionable
   - Include what failed and why, not just "error occurred"

5. **Clean up old logs**
   - Run `deleteOldLogs()` periodically to prevent database bloat
   - Consider a scheduled task to clean logs older than 30-90 days

6. **Query logs for analysis**
   - Regularly review error logs to identify recurring issues
   - Use log statistics to track system health over time
