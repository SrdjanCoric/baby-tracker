#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"

load_local_supabase_status "create E2E users against"

if [[ -z "$SERVICE_ROLE_KEY" || -z "$DB_URL" ]]; then
  echo "Local Supabase credentials are unavailable. Run: npx supabase start" >&2
  exit 1
fi

create_user() {
  local email="$1"
  local display_name="$2"
  local payload response user_id

  payload="$(jq -nc \
    --arg email "$email" \
    --arg password "testpassword123" \
    --arg displayName "$display_name" \
    '{email: $email, password: $password, email_confirm: true, user_metadata: {display_name: $displayName}}')"

  response="$(curl --fail-with-body --silent --show-error \
    -X POST "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1)" || {
      if [[ "$response" != *"already been registered"* ]]; then
        echo "Failed to create $email: $response" >&2
        return 1
      fi
    }

  user_id="$(psql "$DB_URL" -Atqc \
    "SELECT id FROM auth.users WHERE email = '$email' LIMIT 1")"

  if [[ -z "$user_id" ]]; then
    echo "Auth user was not found after creating $email" >&2
    return 1
  fi

  curl --fail-with-body --silent --show-error \
    -X PUT "$API_URL/auth/v1/admin/users/$user_id" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null

  echo "Ready: $email"
}

echo "Creating local E2E users..."
create_user "e2e-owner@test.local" "E2E Owner"
create_user "e2e-member@test.local" "E2E Member"
create_user "e2e-test@test.local" "E2E Test User"
