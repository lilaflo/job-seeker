#!/usr/bin/env node
/**
 * Simple web server to display job listings
 * Serves a single-page HTML interface with job data from SQLite
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { getJobs, getJobStats, getPlatforms } from './database';

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
 * Main request handler
 */
function requestHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url || '/';

  console.debug(`${new Date().toISOString()} - ${req.method} ${url}`);

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
  console.log(`   - GET /api/jobs - Fetch job listings`);
  console.log(`   - GET /api/platforms - Fetch platform info\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
