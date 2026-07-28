#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"

load_local_supabase_status "start caregiver join Metro against"

if [[ -z "$API_URL" || -z "$ANON_KEY" ]]; then
  echo "Local Supabase API credentials are unavailable. Run: npm run test:sql:setup" >&2
  exit 1
fi

export SOFIBABY_E2E_LOCAL_ENV=1
export EXPO_PUBLIC_SUPABASE_URL="$API_URL"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS=0

exec npx expo start --dev-client --clear "$@"
