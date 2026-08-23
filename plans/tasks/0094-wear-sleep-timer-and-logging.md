# Task 0094: Wear sleep timer and logging

**Branch**: `feature/wear-sleep-timer-and-logging`
**Depends on**: 0093
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I track my baby's sleep from my watch.

## Implementation classification

- **Change class**: `code`
- **Validation tier**: `canonical`
- **TDD applicable**: `true`

## What to build

Sleep tracking with iOS-watch parity on top of the shared timer machinery from 0093: start/stop a
sleep timer from the watch with the fields the iOS watch supports (reference `targets/watch/` sleep
flows), rows identical in shape to phone-written sleep sessions, cross-device visibility via
snapshot. Sequenced after 0093 because both modify the shared Kotlin write client and timer
machinery.

Same durable rules as 0093: DB-persisted timer instances, no second instance for an
already-active type, visible failure + retry, no backend changes.

**Apple Watch parity boundary**: show the current awake/wake-window readout and the phone-confirmation
notice when applicable; provide only automatic sleep start plus pause/resume/stop. Do not add manual
sleep entry, nap/night choice, overlap handling, morning-classification answers, history, or editing.

## Implementation work

- [x] Sleep timer UI with automatic type, pause/resume/stop, current awake/wake-window readout, and
      phone-confirmation notice, on the shared timer machinery.
- [x] Snapshot-driven display of a phone-started sleep timer.
- [x] Tests: sleep row/timer shape fixture-matches phone rows; already-active rule; summary
      reflects completed sleep.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove the shared timer,
snapshot, and row-parity behavior through automated seams; Task 0098 owns the end-to-end device
pass.

## Acceptance criteria

- [x] Automated integration proof shows the watch sleep lifecycle produces phone-identical rows.
- [x] Snapshot tests prove a phone-started sleep timer renders on the watch.
- [ ] Tests green in CI; no backend changes.
- [x] Manual sleep entry, classification controls, overlap handling, history, and editing are absent.

## Implementation evidence

- RED/GREEN cycles covered phone-started snapshot restoration, already-active locks, automatic
  start shape and state, phone-shaped completion and lock release, pause/resume persistence,
  stop retry reuse, owner hydration, stale-session reset, awake/next-nap display, phone
  confirmation, and the no-anchor wake-window display.
- `./gradlew :wear:testDebugUnitTest :wear:assembleDebug` passed locally in 3 seconds; log:
  `/tmp/agent-workflows/e2f8af45fd34/1aa0ca028842/wear-focused.log`.
- `node --test scripts/wear-os-plugin.test.mjs` passed 2 tests; log:
  `/tmp/agent-workflows/e2f8af45fd34/1aa0ca028842/wear-plugin.log`.
- The stable diff contains no `supabase/` changes. CI proof remains for the review/finish workflow.
