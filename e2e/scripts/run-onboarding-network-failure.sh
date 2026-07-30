#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/lib/local-supabase.sh"

cd "$PROJECT_DIR"
load_local_supabase_status "run onboarding network failure against"

api_container="supabase_kong_baby-tracker"
maestro_args=()
if [[ -n "${MAESTRO_DEVICE:-}" ]]; then
  maestro_args+=(--device "$MAESTRO_DEVICE")
fi

restore_api() {
  docker start "$api_container" >/dev/null 2>&1 || true
}
trap restore_api EXIT

npm run e2e:seed
npm run e2e:prepare-caregiver-join
maestro test "${maestro_args[@]}" e2e/flows/onboarding/network-failure-prepare.yaml

docker stop "$api_container" >/dev/null
maestro test "${maestro_args[@]}" e2e/flows/onboarding/network-failure-offline.yaml

docker start "$api_container" >/dev/null
for _ in $(seq 1 30); do
  if curl --silent --output /dev/null --connect-timeout 1 "$API_URL/auth/v1/health"; then
    break
  fi
  sleep 1
done
curl --fail --silent --output /dev/null "$API_URL/auth/v1/health"
maestro test "${maestro_args[@]}" e2e/flows/onboarding/network-failure-recover.yaml
trap - EXIT
