# Task 0094: Wear sleep timer and logging

**Branch**: `feature/wear-sleep-timer-and-logging`
**Depends on**: 0093
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I track my baby's sleep from my watch.

## What to build

Sleep tracking with iOS-watch parity on top of the shared timer machinery from 0093: start/stop a
sleep timer from the watch with the fields the iOS watch supports (reference `targets/watch/` sleep
flows), rows identical in shape to phone-written sleep sessions, cross-device visibility via
snapshot. Sequenced after 0093 because both modify the shared Kotlin write client and timer
machinery.

Same durable rules as 0093: DB-persisted timer instances, no second instance for an
already-active type, visible failure + retry, no backend changes.

## Implementation work

- [ ] Sleep timer UI and completion flow with parity fields, on the shared timer machinery.
- [ ] Snapshot-driven display of a phone-started sleep timer.
- [ ] Tests: sleep row/timer shape fixture-matches phone rows; already-active rule; summary
      reflects completed sleep.

## Acceptance criteria

- [ ] Sleep timer lifecycle from watch produces phone-identical rows and appears on the phone.
- [ ] Phone-started sleep timer visible on watch.
- [ ] Tests green in CI; no backend changes.
