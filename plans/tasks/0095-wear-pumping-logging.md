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

## Implementation work

- [ ] Pumping UI and logging flow with parity fields.
- [ ] Tests: pumping row shape fixture-matches phone rows; summary reflects the entry.

## Acceptance criteria

- [ ] Pumping logged from watch appears with phone-identical row shape and shows on the phone.
- [ ] Tests green in CI; no backend changes.
