# Task 0095: Wear pumping logging

**Branch**: `feature/wear-pumping-logging`
**Depends on**: 0094
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I log pumping sessions from my watch.

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

- [ ] Pumping UI with left/right/both timer start, pause/resume, stop-with-volume, and Apple-parity
      summary fields.
- [ ] Tests: pumping row shape fixture-matches phone rows; summary reflects the entry.

## Acceptance criteria

- [ ] Pumping logged from watch appears with phone-identical row shape and shows on the phone.
- [ ] Tests green in CI; no backend changes.
- [ ] Untimed manual pumping, notes, manual timestamps, history, and editing are absent.
