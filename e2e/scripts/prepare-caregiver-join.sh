#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"

load_local_supabase_status "prepare caregiver join fixtures against"

if [[ -z "$DB_URL" ]]; then
  echo "Local Supabase credentials are unavailable. Run: npm run test:sql:setup" >&2
  exit 1
fi

npm run e2e:create-users
psql "$DB_URL" -f e2e/fixtures/caregiver-join.sql

echo "Caregiver join fixture ready: E2EJ-2345"
