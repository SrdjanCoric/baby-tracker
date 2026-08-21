# Task 0091: Wear today summary read path

**Branch**: `feature/wear-today-summary-read-path`
**Depends on**: 0090
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I glance at my watch and see today's activity for my baby.

**Change class**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

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

**Apple Watch parity boundary**: render only the activity facts, timers, wake-window state, goals,
and baby-selection behavior present in `targets/watch/`. Do not add history browsing, charts,
record editing, prediction controls, settings, or other phone-only dashboard features.

## Implementation work

- [x] Kotlin data models mirroring the snapshot payload (all activity types, active timers, goals),
      with a comment pointing at the Swift models as the parity reference.
- [x] Fixture-based serialization tests: captured real snapshot JSON decodes into the models with
      every field asserted (the drift guard).
- [x] Snapshot fetch client using the 0090 session; refresh on app open and on wake.
- [x] Today summary Compose screen with parity content; loading, error+retry, and empty states.
- [x] Selected-baby picker when the household has multiple babies, matching the Apple Watch's
      baby-selection behavior and refreshing the chosen baby's snapshot.
- [x] Timezone handling matches iOS (RPC takes `p_timezone` from the baby identity payload).

## Implementation decisions

- The settled 0090 session envelope remains unchanged. The watch loads the household's baby
  identities directly from the existing RLS-scoped `babies` REST read, persists its own selection,
  and continues to send the identity payload's timezone to the snapshot RPC.
- The dedicated Kotlin fixture was captured from the real migration 061 RPC against the isolated
  local Supabase vector household. The rollback-only capture populated all activity sections and
  four timers, including context, pause, remote-owner, and accumulated-time fields. The decoder
  rejects unknown fields, and the fixture test asserts every modeled leaf so drift is visible.
- Growth remains decoded for drift protection but is not rendered, matching the Apple Watch parity
  boundary. No history, charts, editing, prediction controls, or settings were added.

## Implementation evidence

- RED/GREEN cycles cover exhaustive fixture decoding and strict drift rejection; authenticated RPC
  request construction and response decoding; the RLS-scoped baby directory; loading, content,
  empty, error/retry, and selection state; parity presentation; launch/wake refresh; and 401 session
  rejection.
- The plugin template remains the source of truth for generated `android/wear`; its generated copy
  was kept byte-for-byte synchronized during implementation.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove the RPC client,
model drift guard, rendering, refresh, and error recovery at automated seams; Task 0098 performs
the consolidated end-to-end device pass.

## Acceptance criteria

- [x] Automated RPC-client and Compose-state tests prove the selected baby's today snapshot is
      fetched and rendered correctly.
- [ ] Serialization fixture tests cover every snapshot field and are green in CI. Local Wear unit
      tests pass; CI proof belongs to the later PR workflow.
- [x] Network failure shows error + retry; retry after connectivity returns succeeds.
- [x] No phone-only dashboard, history, charting, editing, or settings surface is introduced.
- [x] No backend changes in the diff.
