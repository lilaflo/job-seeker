#!/usr/bin/env node
/**
 * PostgreSQL Migration Script
 * Reads SQL migration files from migrations-pg/ and applies them in order
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

// Database configuration
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  database: process.env.POSTGRES_DB || "jobseeker",
  user: process.env.POSTGRES_USER || "jobseeker",
  password: process.env.POSTGRES_PASSWORD || "jobseeker_dev_password",
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log("🔄 PostgreSQL Migration Runner");
    console.log("==============================\n");

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Migrations tracking table ready\n");

    // Get already applied migrations
    const result = await client.query<{ filename: string }>(
      "SELECT filename FROM migrations ORDER BY filename"
    );
    const appliedMigrations = new Set(result.rows.map((row) => row.filename));

    // Read migration files from migrations-pg directory
    const migrationsDir = join(process.cwd(), "migrations-pg");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let totalMigrations = files.length;
    let alreadyApplied = 0;
    let newlyApplied = 0;

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`⊘ ${file} (already applied)`);
        alreadyApplied++;
        continue;
      }

      console.log(`→ Applying ${file}...`);

      try {
        // Begin transaction
        await client.query("BEGIN");

        // Read and execute migration file
        const filePath = join(migrationsDir, file);
        const sql = readFileSync(filePath, "utf-8");

        await client.query(sql);

        // Record migration as applied
        await client.query("INSERT INTO migrations (filename) VALUES ($1)", [
          file,
        ]);

        // Commit transaction
        await client.query("COMMIT");

        console.log(`✓ ${file} applied successfully`);
        newlyApplied++;
      } catch (error) {
        // Rollback on error
        await client.query("ROLLBACK");
        throw new Error(
          `Failed to apply ${file}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    console.log("\n================================");
    console.log("Migration Summary:");
    console.log(`  Total migrations: ${totalMigrations}`);
    console.log(`  Already applied: ${alreadyApplied}`);
    console.log(`  Newly applied: ${newlyApplied}`);
    console.log("================================\n");
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations();
