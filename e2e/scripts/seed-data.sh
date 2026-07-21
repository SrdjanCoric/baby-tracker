#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$E2E_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"

load_local_supabase_status "seed against"

echo "Resetting local E2E fixtures..."
psql "$DB_URL" -f "$E2E_DIR/fixtures/cleanup.sql" >/dev/null
"$SCRIPT_DIR/create-test-users.sh"
psql "$DB_URL" -f "$E2E_DIR/fixtures/seed-data.sql" >/dev/null
psql "$DB_URL" -f "$E2E_DIR/fixtures/verify-household-timer-fixtures.sql"

echo "Local E2E fixtures are ready."
