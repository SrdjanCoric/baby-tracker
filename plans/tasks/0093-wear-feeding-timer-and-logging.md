# Task 0093: Wear feeding timer and logging

**Branch**: `feature/wear-feeding-timer-and-logging`
**Depends on**: 0092
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I run a feed timer from my watch; a feed started on the phone shows on my watch and the reverse.

## What to build

Feeding with full iOS-watch parity: start/pause/stop a feed timer from the watch, log completed
feeds with the same fields the iOS watch supports (reference `targets/watch/` feeding flows —
bottle vs breast, sides, amounts as applicable), and cross-device timer visibility. This task
builds the shared timer machinery reused by sleep (0094), pumping (0095), and tummy time (0096).

Durable decisions this task must respect (from the brief):

- Timers are database-persisted timer-instance rows, not device-local stopwatches. Cross-device
  visibility comes from the snapshot poll (`active timers` in the payload) — the same mechanism for
  phone-started and watch-started timers. No Data Layer timer messages.
- A running timer survives watch app restart/reboot because state is in the database; reopening
  re-fetches active timers via snapshot.
- Starting a timer of a type that is already active follows the phone app's rule: surface the
  existing active timer, do not create a second instance.
- Same failure policy as all writes: visible error + retry, no queue.

## Implementation work

- [ ] Shared timer machinery on the 0092 write client: create/pause/resume/complete timer-instance
      rows matching the phone's timer row shape, reusable per activity type.
- [ ] Feed timer UI: start, pause/resume, stop-and-save with feeding parity fields.
- [ ] Direct feed logging without a timer where iOS watch offers it.
- [ ] Snapshot-driven active-timer display: phone-started feed timer appears on watch with correct
      elapsed time; watch-started timer appears on phone.
- [ ] Tests: timer row shape fixture-matches phone rows; already-active-type rule; restart
      resumes running timer from snapshot; completed feed row shape parity.

## Human checkpoints

- [ ] [verify] Paired emulators: start feed timer on phone, open watch app; then start one on
      watch, check phone. · Expected: each device shows the other's running timer with sensible
      elapsed time; stopping on either completes it everywhere after refresh. · Failure: timer
      missing, duplicated, or wrong elapsed time. · Reason: cross-device end-to-end timing spans
      two emulators and the live backend; not unit-assertable.

## Acceptance criteria

- [ ] Feed timer full lifecycle from watch produces the same rows a phone-run timer produces.
- [ ] Cross-device visibility proven both directions.
- [ ] Watch app restart during a running timer resumes display correctly.
- [ ] Feeding logs carry parity fields; tests green in CI; no backend changes.
