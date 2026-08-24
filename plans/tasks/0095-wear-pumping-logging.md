# Task 0095: Wear pumping logging

**Branch**: `feature/wear-pumping-logging`
**Depends on**: 0094
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I log pumping sessions from my watch.

## Implementation classification

- **Change class**: `code`
- **Validation tier**: `canonical`
- **TDD applicable**: `true`

## What to build

Pumping with iOS-watch parity (reference `targets/watch/` pumping flows: timer and/or direct log,
sides, amounts as the iOS watch supports them) on the shared write client and timer machinery.
Sequenced after 0094 because it modifies the same shared Kotlin write/timer code.

Same durable rules as 0093/0094: direct writes, phone-identical row shapes, snapshot-driven
cross-device visibility where timers apply, visible failure + retry, no backend changes.

**Apple Watch parity boundary**: provide the left, right, and both pumping timer starts, timer
pause/resume, and stop-with-volume flow shown in `targets/watch/`, plus its last-time/today-volume
summary. Do not add an untimed pumping form, notes, manual timestamps, history, or editing.

## Implementation work

- [x] Pumping UI with left/right/both timer start, pause/resume, stop-with-volume, and Apple-parity
      summary fields.
- [x] Tests: pumping row shape fixture-matches phone rows; summary reflects the entry.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove pumping payload,
timer, and summary behavior through automated seams; Task 0098 verifies end-to-end visibility.

## Acceptance criteria

- [x] Automated integration proof shows pumping from the watch produces a phone-identical row that
      is readable through the shared snapshot path.
- [ ] Tests green in CI; no backend changes.
- [x] Untimed manual pumping, notes, manual timestamps, history, and editing are absent.

## Implementation evidence

- RED/GREEN cycles covered all three pumping start sides, phone-shaped timer acquire and completed
  row payloads, owner hydration, durable pause/resume state, paused-stop timestamps, 0–500 ml
  selection with 5 ml crown and 10 ml button steps, visible stop retry with draft reuse, runtime and
  Compose action wiring, and post-write shared-summary refresh.
- The phone-row fixture is decoded independently from the generated Wear request. A completed
  85 ml right-side session is also decoded through `ActivitySnapshotCodec` and projected as the
  shared last-time/today-volume Pumping summary.
- `./gradlew :wear:testDebugUnitTest :wear:assembleDebug` passed locally in 3 seconds; log:
  `/tmp/agent-workflows/e2f8af45fd34/a0fd2ce14ae4/wear-focused.log`.
- `node --test scripts/wear-os-plugin.test.mjs` passed 2 tests; log:
  `/tmp/agent-workflows/e2f8af45fd34/a0fd2ce14ae4/wear-plugin.log`.
- The stable diff contains no `supabase/` changes. CI proof remains for the review/finish workflow.
