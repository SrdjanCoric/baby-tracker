# Task 0096: Wear tummy time logging

**Branch**: `feature/wear-tummy-time-logging`
**Depends on**: 0095
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I time and log tummy time from my watch.

## What to build

Tummy time with iOS-watch parity (reference `targets/watch/` tummy time flows) on the shared write
client and timer machinery. Completes activity-type parity: with this merged, every activity type
the iOS watch supports (feeding, sleep, diaper, pumping, tummy time) works on Wear. Sequenced after
0095 because it modifies the same shared Kotlin write/timer code.

Same durable rules as 0093–0095: direct writes, phone-identical row shapes, snapshot-driven
cross-device timer visibility, visible failure + retry, no backend changes.

## Implementation work

- [ ] Tummy time timer UI and logging flow with parity fields.
- [ ] Tests: tummy time row/timer shape fixture-matches phone rows; summary reflects the entry.

## Acceptance criteria

- [ ] Tummy time session from watch appears with phone-identical row shape and shows on the phone.
- [ ] All five iOS-watch activity types now log successfully from the Wear app on emulator.
- [ ] Tests green in CI; no backend changes.
