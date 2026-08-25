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

**Apple Watch parity boundary**: provide only the start/pause/resume/stop timer and today's minutes
shown by Apple Watch. Do not add manual duration entry, notes, backdating, history, or editing.

## Implementation work

- [ ] Tummy time start/pause/resume/stop timer UI and today's-minutes readout.
- [ ] Tests: tummy time row/timer shape fixture-matches phone rows; summary reflects the entry.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove tummy-time timer,
row parity, and summary behavior through automated seams; Task 0098 verifies the complete activity
set end to end.

## Acceptance criteria

- [ ] Automated integration proof shows tummy time from the watch produces a phone-identical row
      readable through the shared snapshot path.
- [ ] Automated suites cover all five iOS-watch activity payloads; paired-device proof is deferred
      to Task 0098.
- [ ] Tests green in CI; no backend changes.
- [ ] Manual duration entry, notes, backdating, history, and editing are absent.
