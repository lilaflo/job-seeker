#!/usr/bin/env node
/**
 * Simple web server to display job listings
 * Serves a single-page HTML interface with job data from SQLite
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { getJobs, getJobStats, getPlatforms, deleteJob } from './database';
import { runScan, type ScanResult } from './scan-runner';

// Track if a scan is currently running
let scanInProgress = false;

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

    const result: ScanResult = await runScan({
      query: 'newer_than:7d',
      maxResults: 50,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error('Scan error:', error);
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

server.listen(PORT, () => {
  console.log(`\n🚀 Job Seeker Web Server running at http://localhost:${PORT}`);
  console.log(`   API endpoints:`);
  console.log(`   - GET  /api/jobs - Fetch job listings`);
  console.log(`   - GET  /api/platforms - Fetch platform info`);
  console.log(`   - POST /api/scan - Trigger email scan`);
  console.log(`   - GET  /api/scan/status - Check scan status\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
