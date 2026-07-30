#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
shift || true

if [[ "$platform" != "ios" && "$platform" != "android" ]]; then
  echo "Usage: $0 <ios|android> [--reset] [--only <flow>]" >&2
  exit 1
fi

reset=false
only_flow=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset)
      reset=true
      shift
      ;;
    --only)
      only_flow="${2:-}"
      if [[ -z "$only_flow" ]]; then
        echo "--only requires a flow name" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

flows=(
  welcome
  fresh-owner
  owner-invitation
  manual-code-join
  returning-user-restoration
  owner-restart
  auth-cancellation
  join-failure-recovery
  locales
  legacy-upgrade
)

if [[ -n "$only_flow" ]]; then
  found=false
  for flow in "${flows[@]}"; do
    if [[ "$flow" == "$only_flow" ]]; then
      found=true
      break
    fi
  done
  if [[ "$found" != true ]]; then
    echo "Unknown onboarding flow: $only_flow" >&2
    exit 1
  fi
  flows=("$only_flow")
fi

mkdir -p e2e/artifacts
config_file="e2e/artifacts/onboarding-${platform}.env"
progress_file="e2e/artifacts/onboarding-${platform}.passed"
log_dir="e2e/artifacts/onboarding-${platform}-logs"
mkdir -p "$log_dir"

if [[ "$reset" == true ]]; then
  rm -f "$progress_file"
fi

configured_device=""
if [[ -f "$config_file" ]]; then
  configured_device="$(awk -F= '$1 == "MAESTRO_DEVICE" { print substr($0, index($0, "=") + 1); exit }' "$config_file")"
fi
device="${MAESTRO_DEVICE:-$configured_device}"

if [[ -z "$device" && "$platform" == "ios" ]]; then
  device="$(xcrun simctl list devices booted -j | python3 -c 'import json,sys; devices=json.load(sys.stdin)["devices"]; print(next((d["udid"] for runtime in devices.values() for d in runtime if d.get("state") == "Booted"), ""))')"
fi
if [[ -z "$device" && "$platform" == "android" ]]; then
  device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi
if [[ -z "$device" ]]; then
  echo "No $platform device found. Set MAESTRO_DEVICE or boot a device." >&2
  exit 1
fi

printf 'MAESTRO_DEVICE=%s\n' "$device" > "$config_file"

echo "Device: $device"
echo "Progress: $progress_file"

stop_app() {
  if [[ "$platform" == "ios" ]]; then
    xcrun simctl terminate "$device" com.sofibaby.app >/dev/null 2>&1 || true
  else
    adb -s "$device" shell am force-stop com.sofibaby.app >/dev/null 2>&1 || true
  fi
  sleep 1
}

passed_count=0
skipped_count=0
for flow in "${flows[@]}"; do
  if [[ -z "$only_flow" && -f "$progress_file" ]] && grep -Fxq "$flow" "$progress_file"; then
    echo "SKIP $flow (checkpointed)"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  stop_app
  log_file="$log_dir/${flow}.log"
  echo "RUN  $flow"
  if maestro test --device "$device" "e2e/flows/onboarding/${flow}.yaml" >"$log_file" 2>&1; then
    if [[ ! -f "$progress_file" ]] || ! grep -Fxq "$flow" "$progress_file"; then
      printf '%s\n' "$flow" >> "$progress_file"
    fi
    echo "PASS $flow"
    passed_count=$((passed_count + 1))
  else
    tail -120 "$log_file"
    echo "FAIL $flow" >&2
    echo "Fix the failure, then rerun this command; completed flows will be skipped." >&2
    exit 1
  fi
done

echo "Onboarding $platform complete: $passed_count run, $skipped_count checkpointed."
