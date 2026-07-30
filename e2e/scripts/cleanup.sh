#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$E2E_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"

load_local_supabase_status "clean up"

echo "Cleaning local E2E fixtures..."
psql "$DB_URL" -f "$E2E_DIR/fixtures/cleanup.sql"

remaining="$(psql "$DB_URL" -Atqc "
  SELECT count(*)
  FROM auth.users
  WHERE email IN ('e2e-owner@test.local', 'e2e-member@test.local', 'e2e-test@test.local', 'e2e-new-owner@test.local')
")"

if [[ "$remaining" != "0" ]]; then
  echo "Cleanup failed: $remaining E2E auth users remain" >&2
  exit 1
fi

echo "Local E2E cleanup complete."
