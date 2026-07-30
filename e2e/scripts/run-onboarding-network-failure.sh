#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"
load_local_supabase_status "run onboarding network failure against"

api_container="supabase_kong_baby-tracker"
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
artifact_dir="$PROJECT_DIR/e2e/artifacts/onboarding-network/$run_id"
current_step="preflight"
api_interruption_started=false
maestro_args=()

mkdir -p "$artifact_dir"
if [[ -n "${MAESTRO_DEVICE:-}" ]]; then
  maestro_args+=(--device "$MAESTRO_DEVICE")
fi

wait_for_api() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --output /dev/null --connect-timeout 1 "$API_URL/auth/v1/health"; then
      return 0
    fi
    sleep 1
  done
  echo "Local Supabase API did not become healthy within 30 seconds" >&2
  return 1
}

ensure_api_running() {
  local status
  local paused
  status="$(docker inspect --format '{{.State.Status}}' "$api_container")"
  paused="$(docker inspect --format '{{.State.Paused}}' "$api_container")"

  if [[ "$paused" == "true" ]]; then
    docker unpause "$api_container" >/dev/null
  elif [[ "$status" != "running" ]]; then
    docker start "$api_container" >/dev/null
  fi
  wait_for_api
}

capture_failure_diagnostics() {
  {
    printf 'failed_step=%s\n' "$current_step"
    printf 'api_container=%s\n' "$api_container"
    docker inspect --format 'status={{.State.Status}} paused={{.State.Paused}}' "$api_container" 2>&1 || true
  } >"$artifact_dir/failure-summary.log"

  psql "$DB_URL" -Atc "
    SELECT 'caregiver=' || email || ',household=' || household_id || ',owner=' || is_owner
    FROM public.users WHERE email IN ('e2e-owner@test.local', 'e2e-test@test.local') ORDER BY email;
    SELECT 'invitation=' || invite_code || ',consumed=' || (consumed_at IS NOT NULL) || ',consumer=' || COALESCE(consumed_by::text, 'none')
    FROM public.caregiver_invitations WHERE invite_code = 'E2EJ2345';
    SELECT 'baby=' || id || ',household=' || household_id || ',name=' || name
    FROM public.babies WHERE id IN (
      'e2e00000-0000-4000-8000-000000000041'::uuid,
      '00000000-0000-0000-0001-000000000001'::uuid,
      '00000000-0000-0000-0001-000000000002'::uuid,
      '00000000-0000-0000-0001-000000000003'::uuid
    ) ORDER BY id;
  " >"$artifact_dir/database-diagnostics.log" 2>&1 || true
}

cleanup() {
  local exit_code=$?
  local restore_code=0
  trap - EXIT INT TERM

  if [[ "$exit_code" -ne 0 ]]; then
    capture_failure_diagnostics
  fi
  if [[ "$api_interruption_started" == "true" ]]; then
    ensure_api_running >"$artifact_dir/api-restoration.log" 2>&1 || restore_code=$?
  fi
  if [[ "$restore_code" -ne 0 ]]; then
    echo "Failed to restore the local Supabase API; see $artifact_dir/api-restoration.log" >&2
    exit "$restore_code"
  fi
  if [[ "$exit_code" -ne 0 ]]; then
    echo "Onboarding network recovery failed during $current_step; diagnostics: $artifact_dir" >&2
  fi
  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run_logged() {
  local label="$1"
  shift
  "$@" > >(tee "$artifact_dir/$label.log") 2>&1
}

current_step="local API preflight"
ensure_api_running

current_step="fixture reset"
run_logged seed npm run e2e:seed
run_logged prepare-fixture npm run e2e:prepare-caregiver-join

current_step="join confirmation preparation"
run_logged prepare-ui maestro test "${maestro_args[@]}" --test-output-dir "$artifact_dir/maestro-prepare" e2e/flows/onboarding/network-failure-prepare.yaml

current_step="local API interruption"
api_interruption_started=true
docker stop "$api_container" >"$artifact_dir/api-stop.log"
if curl --fail --silent --output /dev/null --connect-timeout 1 "$API_URL/auth/v1/health"; then
  echo "Local Supabase API remained reachable after interruption" >&2
  exit 1
fi

current_step="offline submission and restart"
run_logged offline-ui maestro test "${maestro_args[@]}" --test-output-dir "$artifact_dir/maestro-offline" e2e/flows/onboarding/network-failure-offline.yaml

current_step="local API restoration"
ensure_api_running >"$artifact_dir/api-restart.log" 2>&1

current_step="persisted recovery"
run_logged recover-ui maestro test "${maestro_args[@]}" --test-output-dir "$artifact_dir/maestro-recover" e2e/flows/onboarding/network-failure-recover.yaml

current_step="database postconditions"
run_logged verify-database psql "$DB_URL" -f e2e/fixtures/verify-caregiver-join-recovery.sql

current_step="complete"
echo "Onboarding network recovery passed. Evidence: $artifact_dir"
