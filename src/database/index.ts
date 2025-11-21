/**
 * PostgreSQL Database Module - Main Entry Point
 * Common functions and utilities shared across all database modules
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

// Database configuration from environment
export const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.NODE_ENV === 'test' ? 'jobseeker_test' : (process.env.POSTGRES_DB || 'jobseeker'),
  user: process.env.POSTGRES_USER || 'jobseeker',
  password: process.env.POSTGRES_PASSWORD || 'jobseeker_dev_password',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

let pool: Pool | null = null;

/**
 * Gets or creates the PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });

    pool.on('connect', () => {
      console.debug('New PostgreSQL client connected');
    });
  }
  return pool;
}

/**
 * Closes the database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Execute a query with parameters
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const client = getPool();
  return client.query<T>(text, params);
}

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Initialize database (verify connection and extensions)
 */
export async function initializeDatabase(): Promise<void> {
  const pool = getPool();

  // Verify pgvector extension
  const result = await pool.query("SELECT * FROM pg_extension WHERE extname = 'vector'");
  if (result.rows.length === 0) {
    console.warn('pgvector extension not found. Some features may not work.');
  } else {
    console.debug('✓ pgvector extension is installed');
  }
}

// Alias for backwards compatibility
export const getDatabase = getPool;

// Re-export types
export * from './types';

// Re-export all entity modules
export * from './email';
export * from './job';
export * from './platform';
export * from './blacklist';
export * from './embedding';
export * from './log';
export * from './skill';
