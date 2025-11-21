# API Reference

[← Back to README](../README.md)

REST API endpoints for Job Seeker web interface.

## Base URL

```
http://localhost:3001
```

## Endpoints

### GET /api/jobs

Get list of jobs with optional filtering.

**Query Parameters:**
- `limit` (number, optional) - Maximum number of jobs to return (default: 100)
- `includeBlacklisted` (boolean, optional) - Include blacklisted jobs (default: false)

**Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "Senior TypeScript Developer",
      "link": "https://example.com/jobs/123",
      "email_id": 5,
      "email_subject": "New job opportunity",
      "email_date": "2024-01-15T10:30:00Z",
      "salary_min": 80000,
      "salary_max": 120000,
      "salary_currency": "USD",
      "salary_period": "yearly",
      "description": "Role Overview: Senior developer position...",
      "processing_status": "completed",
      "is_blacklisted": false,
      "blacklist_reason": null,
      "created_at": "2024-01-15T10:35:00Z",
      "scanned_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

### POST /api/jobs/search

Semantic search for jobs using vector embeddings.

**Request Body:**
```json
{
  "query": "React TypeScript developer remote",
  "limit": 10,
  "minSimilarity": 0.5
}
```

**Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "Senior React Developer",
      "link": "https://example.com/jobs/123",
      "description": "...",
      "similarity": 0.87
    }
  ]
}
```

### GET /api/job/:id

Get details of a specific job.

**Response:**
```json
{
  "id": 1,
  "title": "Senior TypeScript Developer",
  "link": "https://example.com/jobs/123",
  "description": "Full job description...",
  "salary_min": 80000,
  "salary_max": 120000,
  "salary_currency": "USD",
  "salary_period": "yearly"
}
```

### DELETE /api/job/:id

Delete a specific job.

**Response:**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

### GET /api/platforms

Get list of all job platforms.

**Response:**
```json
{
  "platforms": [
    {
      "id": 1,
      "platform_name": "LinkedIn",
      "hostname": "linkedin",
      "can_crawl": false,
      "skip_reason": "Requires multi-level authentication",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/scan

Trigger email scan and job extraction.

**Request Body:**
```json
{
  "maxResults": 20,
  "query": "newer_than:7d"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scan started",
  "scanId": "scan-123"
}
```

### GET /api/scan/status

Check status of email scan.

**Response:**
```json
{
  "scanning": false,
  "progress": {
    "total": 20,
    "processed": 20
  }
}
```

### POST /api/embeddings/generate

Generate embeddings for all jobs without them.

**Response:**
```json
{
  "success": true,
  "message": "Queued 15 jobs for embedding generation"
}
```

### GET /api/blacklist

Get blacklist keywords.

**Response:**
```json
{
  "keywords": [
    "IT Support",
    "Junior Developer",
    "Internship"
  ]
}
```

### POST /api/blacklist

Update blacklist keywords.

**Request Body:**
```json
{
  "keywords": "IT Support\nJunior Developer\nInternship"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blacklist updated successfully"
}
```

### POST /api/reset

Reset database (delete all data and re-run migrations).

**⚠️ Warning:** This deletes ALL data including emails, jobs, and logs.

**Response:**
```json
{
  "success": true,
  "message": "Database reset successfully. Blacklist preserved. Redis queues cleared."
}
```

### GET /api/queue/status

Get status of background job queues.

**Response:**
```json
{
  "queues": {
    "embedding": {
      "waiting": 5,
      "active": 1,
      "completed": 150,
      "failed": 2
    },
    "email-scan": {
      "waiting": 0,
      "active": 0,
      "completed": 10,
      "failed": 0
    }
  }
}
```

## WebSocket Events

Connect to WebSocket server at `ws://localhost:3001`

### Events from Server

#### scan:progress

Sent during email scanning with progress updates.

```json
{
  "type": "scan:progress",
  "current": 5,
  "total": 20,
  "email": {
    "subject": "Job opportunity",
    "isJobRelated": true,
    "confidence": "high"
  }
}
```

#### scan:complete

Sent when email scan completes.

```json
{
  "type": "scan:complete",
  "total": 20,
  "jobRelated": 15
}
```

#### job:created

Sent when a new job is added.

```json
{
  "type": "job:created",
  "job": {
    "id": 1,
    "title": "Senior Developer",
    "link": "https://example.com/jobs/123"
  }
}
```

#### job:updated

Sent when a job is updated.

```json
{
  "type": "job:updated",
  "jobId": 1,
  "updates": {
    "description": "New description...",
    "processing_status": "completed"
  }
}
```

#### job:removed

Sent when a job is deleted.

```json
{
  "type": "job:removed",
  "jobId": 1
}
```

#### reload

Sent in development mode when frontend files change (hot-reload).

```json
{
  "type": "reload"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description",
  "details": "Optional additional details"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

### Example Error Response

```json
{
  "error": "Job not found",
  "details": "No job with ID 999 exists in the database"
}
```

## Rate Limiting

No rate limiting is currently implemented. Be respectful when making requests.

## Authentication

No authentication is currently required. The API is intended for local use only.

## CORS

CORS is enabled for all origins in development mode.

## Examples

### Using curl

**Get jobs:**
```bash
curl http://localhost:3001/api/jobs?limit=10
```

**Search jobs:**
```bash
curl -X POST http://localhost:3001/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"query": "React developer", "limit": 10}'
```

**Update blacklist:**
```bash
curl -X POST http://localhost:3001/api/blacklist \
  -H "Content-Type: application/json" \
  -d '{"keywords": "IT Support\nJunior"}'
```

**Generate embeddings:**
```bash
curl -X POST http://localhost:3001/api/embeddings/generate
```

### Using JavaScript

```javascript
// Get jobs
const response = await fetch('http://localhost:3001/api/jobs');
const data = await response.json();

// Search jobs
const searchResponse = await fetch('http://localhost:3001/api/jobs/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'React TypeScript',
    limit: 10,
    minSimilarity: 0.5
  })
});
const jobs = await searchResponse.json();

// WebSocket connection
const ws = new WebSocket('ws://localhost:3001');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## See Also

- [Usage Guide →](USAGE.md) - Command reference
- [Architecture →](ARCHITECTURE.md) - System design
- [Development →](DEVELOPMENT.md) - API development
