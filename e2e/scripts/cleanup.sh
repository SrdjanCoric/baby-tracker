#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$E2E_DIR")"

echo "Cleaning up E2E test data..."

# Get the database URL from supabase status
DB_URL=$(cd "$PROJECT_DIR" && supabase status --output json 2>/dev/null | grep -o '"DB_URL":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DB_URL" ]; then
  # Fallback to default local Supabase database URL
  DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
fi

psql "$DB_URL" -f "$E2E_DIR/fixtures/cleanup.sql"
echo "Cleanup complete!"
