#!/bin/bash
# Database migration script for Job Seeker
# Applies SQL migrations from the migrations/ folder in order
# Tracks applied migrations in a migrations table

set -e  # Exit on error

DB_FILE="job-seeker.db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$SCRIPT_DIR/$DB_FILE"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

echo "Starting database migration for Job Seeker..."
echo "Database location: $DB_PATH"
echo "Migrations folder: $MIGRATIONS_DIR"
echo ""

# Create migrations tracking table if it doesn't exist
sqlite3 "$DB_PATH" <<'EOF'
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
EOF

echo "✓ Migrations tracking table ready"
echo ""

# Get list of already applied migrations
APPLIED_MIGRATIONS=$(sqlite3 "$DB_PATH" "SELECT filename FROM migrations ORDER BY filename;")

# Process each migration file in order
MIGRATION_COUNT=0
NEW_MIGRATION_COUNT=0

for MIGRATION_FILE in "$MIGRATIONS_DIR"/*.sql; do
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "No migration files found in $MIGRATIONS_DIR"
    exit 0
  fi

  FILENAME=$(basename "$MIGRATION_FILE")
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))

  # Check if migration has already been applied
  if echo "$APPLIED_MIGRATIONS" | grep -q "^${FILENAME}$"; then
    echo "⊘ $FILENAME (already applied)"
  else
    echo "→ Applying $FILENAME..."

    # Apply the migration
    sqlite3 "$DB_PATH" < "$MIGRATION_FILE"

    # Record the migration as applied
    sqlite3 "$DB_PATH" "INSERT INTO migrations (filename) VALUES ('$FILENAME');"

    echo "✓ $FILENAME applied successfully"
    NEW_MIGRATION_COUNT=$((NEW_MIGRATION_COUNT + 1))
  fi
done

echo ""
echo "================================"
echo "Migration Summary:"
echo "  Total migrations: $MIGRATION_COUNT"
echo "  Already applied: $((MIGRATION_COUNT - NEW_MIGRATION_COUNT))"
echo "  Newly applied: $NEW_MIGRATION_COUNT"
echo "================================"
echo ""

if [ $NEW_MIGRATION_COUNT -gt 0 ]; then
  echo "✓ Database migration completed successfully!"
  echo ""
  echo "Current database structure:"
  sqlite3 "$DB_PATH" ".schema emails"
  echo ""
  sqlite3 "$DB_PATH" ".schema jobs"
else
  echo "✓ Database is up to date - no new migrations to apply"
fi

echo ""
echo "To query the database:"
echo "  sqlite3 $DB_PATH"
echo ""
echo "Example queries:"
echo "  -- Emails"
echo "  SELECT * FROM emails WHERE confidence='high';"
echo "  SELECT COUNT(*) FROM emails WHERE is_job_related=1;"
echo "  SELECT gmail_id, subject FROM emails ORDER BY created_at DESC LIMIT 10;"
echo ""
echo "  -- Jobs"
echo "  SELECT * FROM jobs;"
echo "  SELECT COUNT(*) FROM jobs;"
echo "  SELECT title, link FROM jobs ORDER BY created_at DESC LIMIT 10;"
echo ""
echo "  -- Migrations"
echo "  SELECT * FROM migrations ORDER BY applied_at;"
