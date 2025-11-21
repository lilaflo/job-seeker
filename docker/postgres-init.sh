#!/bin/bash
# PostgreSQL initialization script
# Runs migrations automatically on container startup

set -e

# Use POSTGRES_HOST from environment or default to 'postgres'
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"

# Export password for psql
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Waiting for PostgreSQL to be ready at $POSTGRES_HOST..."
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h "$POSTGRES_HOST"; do
  sleep 1
done

echo "PostgreSQL is ready!"
echo "Running migrations..."

# Create migrations table if it doesn't exist
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
" || echo "Migrations table already exists"

# Run all SQL files in migrations-pg directory
for migration in /migrations-pg/*.sql; do
  if [ -f "$migration" ]; then
    filename=$(basename "$migration")

    # Check if migration has already been applied
    applied=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM migrations WHERE filename='$filename'" 2>/dev/null || echo "0")

    if [ "$applied" = "0" ]; then
      echo "→ Applying $filename..."
      psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration"
      psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO migrations (filename) VALUES ('$filename')"
      echo "✓ $filename applied successfully"
    else
      echo "⊘ $filename (already applied)"
    fi
  fi
done

echo "✓ All migrations completed"
