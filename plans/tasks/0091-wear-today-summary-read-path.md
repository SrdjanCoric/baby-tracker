# Task 0091: Wear today summary read path

**Branch**: `feature/wear-today-summary-read-path`
**Depends on**: 0090
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I glance at my watch and see today's activity for my baby.

## What to build

The watch's read path: fetch the day's data via the existing `get_baby_activity_snapshot` Supabase
RPC (migration 061 — unchanged backend) and render the today summary screen for the selected baby,
matching the information the iOS watch summary shows (recent feeding, sleep, diaper, pumping, tummy
time, active timers, goals as applicable). Refresh on app open/wake, mirroring the iOS poll-on-wake
pattern. No incremental sync (migration 064 cursors stay unused).

This task also establishes the **model drift guard** decided in the brief: Kotlin data classes
mirroring the ~40 snapshot fields (reference: `targets/watch/WatchActivitySummary.swift`) are
covered by fixture-based serialization tests against JSON captured from the real RPC, so a backend
or phone-side field change breaks a test instead of silently desyncing the watch.

Failure policy (from the brief): Supabase unreachable → visible error state with manual retry; no
caching guarantees beyond last successfully rendered data.

## Implementation work

- [ ] Kotlin data models mirroring the snapshot payload (all activity types, active timers, goals),
      with a comment pointing at the Swift models as the parity reference.
- [ ] Fixture-based serialization tests: captured real snapshot JSON decodes into the models with
      every field asserted (the drift guard).
- [ ] Snapshot fetch client using the 0090 session; refresh on app open and on wake.
- [ ] Today summary Compose screen with parity content; loading, error+retry, and empty states.
- [ ] Timezone handling matches iOS (RPC takes `p_timezone` from the baby identity payload).

## Acceptance criteria

- [ ] Watch shows real today data for the signed-in household's selected baby on emulator.
- [ ] Serialization fixture tests cover every snapshot field and are green in CI.
- [ ] Network failure shows error + retry; retry after connectivity returns succeeds.
- [ ] No backend changes in the diff.
