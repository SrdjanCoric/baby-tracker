#!/bin/bash
set -e

echo "Creating E2E test users via Supabase Admin API..."

SERVICE_ROLE_KEY=$(supabase status --output json | jq -r '.SERVICE_ROLE_KEY // empty')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: Could not get service role key. Is Supabase running?"
  echo "Run: supabase start"
  exit 1
fi

API_URL="http://localhost:54321"

create_user() {
  local email=$1
  local display_name=$2

  echo "Creating user: $email"

  response=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"testpassword123\",
      \"email_confirm\": true,
      \"user_metadata\": {\"display_name\": \"$display_name\"}
    }" 2>/dev/null)

  if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
    user_id=$(echo "$response" | jq -r '.id')
    echo "  Created: $user_id"
  else
    error=$(echo "$response" | jq -r '.msg // .message // "Unknown error"')
    if [[ "$error" == *"already been registered"* ]]; then
      echo "  User already exists"
    else
      echo "  Error: $error"
    fi
  fi
}

create_user "e2e-owner@test.local" "E2E Owner"
create_user "e2e-member@test.local" "E2E Member"
create_user "e2e-test@test.local" "E2E Test User"

echo ""
echo "Test users created!"
echo "Password for all users: testpassword123"
