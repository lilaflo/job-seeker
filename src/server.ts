#!/usr/bin/env node
/**
 * Simple web server to display job listings
 * Serves a single-page HTML interface with job data from SQLite
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WebSocketServer, WebSocket } from 'ws';
import { getJobs, getJobStats, getPlatforms, deleteJob, closeDatabase } from './database';

const execAsync = promisify(exec);

// Track if a scan is currently running
let scanInProgress = false;

// Connected WebSocket clients
const wsClients = new Set<WebSocket>();

/**
 * Broadcast message to all connected WebSocket clients
 */
function broadcast(message: object): void {
  const data = JSON.stringify(message);
  console.debug(`Broadcasting to ${wsClients.size} clients:`, (message as any).type);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const PORT = process.env.PORT || 3001;

// Get the public directory path
const publicDir = path.join(process.cwd(), 'public');

/**
 * Serve static files from public directory
 */
function serveStaticFile(filePath: string, res: http.ServerResponse): void {
  const extname = path.extname(filePath);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
  };

  const contentType = contentTypes[extname] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end(`Server error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

/**
 * API endpoint to get jobs with optional filters
 */
function handleJobsApi(req: http.IncomingMessage, res: http.ServerResponse): void {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const jobs = getJobs({ limit });
    const stats = getJobStats();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ jobs, stats }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch jobs' }));
  }
}

/**
 * API endpoint to get platform statistics
 */
function handlePlatformsApi(res: http.ServerResponse): void {
  try {
    const platforms = getPlatforms();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ platforms }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch platforms' }));
  }
}

/**
 * API endpoint to delete a job
 */
function handleDeleteJobApi(jobId: number, res: http.ServerResponse): void {
  try {
    const deleted = deleteJob(jobId);

    if (deleted) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true, message: 'Job deleted' }));
    } else {
      res.writeHead(404, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Job not found' }));
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to delete job' }));
  }
}

/**
 * API endpoint to trigger email scan
 */
async function handleScanApi(res: http.ServerResponse): Promise<void> {
  // Check if scan is already in progress
  if (scanInProgress) {
    res.writeHead(409, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ error: 'Scan already in progress' }));
    return;
  }

  try {
    scanInProgress = true;

    // Dynamic import to avoid loading Gmail/Ollama dependencies at server startup
    const { runScan } = await import('./scan-runner');

    const result = await runScan({
      query: 'newer_than:7d',
      maxResults: 50,
      onEmailProcessed: (email) => {
        // Broadcast each processed email via WebSocket
        broadcast({
          type: 'email_processed',
          email
        });
      },
      onProgress: (event) => {
        // Broadcast progress updates via WebSocket
        broadcast({
          type: 'scan_progress',
          ...event
        });
      }
    });

    // Broadcast completion
    broadcast({
      type: 'scan_complete',
      result
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error('Scan error:', error);

    // Broadcast error
    broadcast({
      type: 'scan_error',
      error: error instanceof Error ? error.message : 'Scan failed'
    });

    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Scan failed'
    }));
  } finally {
    scanInProgress = false;
  }
}

/**
 * API endpoint to check scan status
 */
function handleScanStatusApi(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ scanning: scanInProgress }));
}

/**
 * API endpoint for semantic search
 */
async function handleSearchApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    // Parse request body
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    const { query, limit = 20, minSimilarity = 0.3 } = JSON.parse(body);

    if (!query || typeof query !== 'string') {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Query is required' }));
      return;
    }

    // Dynamic import to avoid loading dependencies at startup
    const { searchSimilarJobs, getEmbeddingStats } = await import('./embeddings');

    const jobs = await searchSimilarJobs(query, { limit, minSimilarity });
    const stats = getEmbeddingStats();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ jobs, stats }));
  } catch (error) {
    console.error('Search error:', error);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : 'Search failed'
    }));
  }
}

/**
 * API endpoint to reset database (delete and run migrations)
 */
async function handleResetDatabaseApi(res: http.ServerResponse): Promise<void> {
  try {
    const dbPath = path.join(process.cwd(), 'job-seeker.db');
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';

    // Close the database connection first
    closeDatabase();

    // Delete database files
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Run migrations
    const { stdout, stderr } = await execAsync('./migrate.sh');

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      message: 'Database reset successfully',
      output: stdout
    }));
  } catch (error) {
    console.error('Reset database error:', error);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to reset database'
    }));
  }
}

/**
 * API endpoint to generate embeddings for jobs
 */
async function handleGenerateEmbeddingsApi(res: http.ServerResponse): Promise<void> {
  try {
    const { getJobsWithoutEmbeddings, generateAndSaveJobEmbedding, getEmbeddingStats } = await import('./embeddings');

    const jobsToProcess = getJobsWithoutEmbeddings();

    if (jobsToProcess.length === 0) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        message: 'All jobs already have embeddings',
        processed: 0,
        stats: getEmbeddingStats()
      }));
      return;
    }

    // Process jobs
    let processed = 0;
    for (const job of jobsToProcess) {
      await generateAndSaveJobEmbedding(job.id, job.title, job.description);
      processed++;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      message: `Generated embeddings for ${processed} jobs`,
      processed,
      stats: getEmbeddingStats()
    }));
  } catch (error) {
    console.error('Embedding generation error:', error);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : 'Embedding generation failed'
    }));
  }
}

/**
 * Main request handler
 */
function requestHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url || '/';

  console.debug(`${new Date().toISOString()} - ${req.method} ${url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // POST /api/scan - trigger email scan
  if (url === '/api/scan' && req.method === 'POST') {
    handleScanApi(res);
    return;
  }

  // GET /api/scan/status - check scan status
  if (url === '/api/scan/status' && req.method === 'GET') {
    handleScanStatusApi(res);
    return;
  }

  // POST /api/jobs/search - semantic search
  if (url === '/api/jobs/search' && req.method === 'POST') {
    handleSearchApi(req, res);
    return;
  }

  // POST /api/embeddings/generate - generate embeddings for jobs
  if (url === '/api/embeddings/generate' && req.method === 'POST') {
    handleGenerateEmbeddingsApi(res);
    return;
  }

  // POST /api/reset - reset database (delete and run migrations)
  if (url === '/api/reset' && req.method === 'POST') {
    handleResetDatabaseApi(res);
    return;
  }

  // DELETE /api/jobs/:id
  const deleteMatch = url.match(/^\/api\/jobs\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const jobId = parseInt(deleteMatch[1], 10);
    handleDeleteJobApi(jobId, res);
    return;
  }

  // API endpoints
  if (url.startsWith('/api/jobs')) {
    handleJobsApi(req, res);
    return;
  }

  if (url === '/api/platforms') {
    handlePlatformsApi(res);
    return;
  }

  // Serve index.html for root
  if (url === '/' || url === '/index.html') {
    serveStaticFile(path.join(publicDir, 'index.html'), res);
    return;
  }

  // Serve other static files
  const filePath = path.join(publicDir, url);
  serveStaticFile(filePath, res);
}

// Create and start server
const server = http.createServer(requestHandler);

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.debug('WebSocket client connected');
  wsClients.add(ws);

  ws.on('close', () => {
    console.debug('WebSocket client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsClients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Job Seeker Web Server running at http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   API endpoints:`);
  console.log(`   - GET  /api/jobs - Fetch job listings`);
  console.log(`   - GET  /api/platforms - Fetch platform info`);
  console.log(`   - POST /api/scan - Trigger email scan`);
  console.log(`   - GET  /api/scan/status - Check scan status`);
  console.log(`   - POST /api/jobs/search - Semantic search`);
  console.log(`   - POST /api/embeddings/generate - Generate embeddings`);
  console.log(`   - POST /api/reset - Reset database\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
