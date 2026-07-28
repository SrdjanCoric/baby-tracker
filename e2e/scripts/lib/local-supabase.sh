#!/usr/bin/env bash

load_local_supabase_status() {
  local operation="$1"
  local status_json
  local api_is_local=false
  local db_is_local=false

  status_json="$(npx supabase status --output json 2>/dev/null)"
  API_URL="$(jq -r '.API_URL // empty' <<<"$status_json")"
  DB_URL="$(jq -r '.DB_URL // empty' <<<"$status_json")"
  SERVICE_ROLE_KEY="$(jq -r '.SERVICE_ROLE_KEY // empty' <<<"$status_json")"
  ANON_KEY="$(jq -r '.ANON_KEY // empty' <<<"$status_json")"

  if [[ "$API_URL" =~ ^http://(127\.0\.0\.1|localhost)(:|/) || "$API_URL" =~ ^http://\[::1\](:|/) ]]; then
    api_is_local=true
  fi
  if [[ "$DB_URL" =~ @(127\.0\.0\.1|localhost): || "$DB_URL" =~ @\[::1\]: ]]; then
    db_is_local=true
  fi
  if [[ "$api_is_local" != true || "$db_is_local" != true ]]; then
    echo "Refusing to $operation non-local Supabase endpoints" >&2
    return 1
  fi
}
