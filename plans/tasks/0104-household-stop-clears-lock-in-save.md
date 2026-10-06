# Task 0104: Clear the lock in the save step when any household member stops a timer

**Branch**: `feature/household-stop-clears-lock-in-save`
**Depends on**: 0103
**Base**: `main` after Task 0103 has merged.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-06 · **User stories**: when any caregiver stops a timer, every
caregiver's phone stops showing it as running, even if the stopping phone's separate lock release
fails or the app is suspended.

## What to build

Applies to all four timers: sleep, feeding, pumping, and tummy time. Every stop that saves an
activity from a timer — the starter's own stop, and a household member's stop of a timer another
member started, including a member's stop sent from the widget or the Watch — sends the stopped timer's
identity (timer instance id and start time) with the queued save. The server applies the save and
the lock clearing in one transaction, whoever started the timer.

The atomic completion function decides with this table. Unless a row says otherwise, the record is
saved under the existing merge rules.

| Caller signed in and authorised for the record | Caller in the baby's household | Baby deleted | Lock for baby and activity type | Lock matches stopped timer | Result |
| --- | --- | --- | --- | --- | --- |
| no | any | any | any | any | Reject; nothing saved; lock unchanged |
| yes | no | any | any | any | Reject; nothing saved; lock unchanged |
| yes | yes | yes | any | any | Save; lock kept |
| yes | yes | no | none | — | Save; nothing cleared |
| yes | yes | no | present, any starter | yes: instance id equal | Save; lock cleared |
| yes | yes | no | present, any starter | lock has no instance id and its start equals the stopped timer's start | Save; lock cleared |
| yes | yes | no | present, any starter | no | Save; lock kept |
| yes | yes | no | any | save carries no timer identity | Save; lock unchanged |

"Caller in the baby's household" and "baby deleted" use the same household rule the 4.10
`release_timer_lock` function applies. Replaying the same queued save produces the same end state
and no error. Two members stopping the same timer, at once or by offline replay, end with one
record (the existing deterministic record id), no lock, and no error on either device.

The direct lock release attempt on stop stays as an early clear on every path. The starter's
device still clears its local timer without saving when its lock disappears.

## Decided

- Any household member's stop clears the matching lock in the save step — owner, 2026-10-06:
  "anyone can stop, without the bug".
- This supersedes Task 0102's "clears only a lock the caller started" rule; the authority for who
  may clear is the household rule of 4.10's `release_timer_lock`, which the owner approved in Task
  0091.
- A new migration `069` replaces the function body in place with the same name, arguments, return
  type, elevated rights, fixed search path, and grants; migration 065 is never edited — production
  already ran 065, and 4.9.23 clients call this signature.
- 4.9.23 clients keep working: they send timer identity only for their own timers, which this table
  still clears.
- The owner applies 069 in the production SQL editor before any 4.10.2 build is submitted.

## Clarifications

## Non-goals

- The direct lock deletes inside the widget and Watch native code, which filter to the caller's own
  timers; unchanged, as in Task 0102.
- Live Activity, push, and webhook behavior; the database delete webhook is verified on devices in
  Task 0105.
- Viewer-side hiding of a lock whose activity is already saved.
- Device scenarios for feeding, pumping, and tummy time; the device suite stays sleep-only.

## Context

Task 0102 made the starter's own stop save and clear the lock atomically, but deliberately limited
clearing to locks the caller started, because 4.9 had no household stop. On 4.10, a member's stop
of another member's timer saves through the queue without timer identity and relies on a separate
direct release, retried later from a local queue on failure. That is the two-write defect Task 0102
fixed for the starter. Widget and Watch stops of a remote timer reach the app through the external
command queue and run the same remote-stop path (Task 0092). The household E2E runner already blocks direct releases in the hotfix
scenario.

## Implementation work

- [ ] Migration 069 makes the atomic completion function follow the table — proven in
      `scripts/sql/active-timer-completion-tests.sql`.
- [ ] A member's in-app stop of another member's timer, for all four timers, queues its save with
      the stopped timer's identity — proven in
      `src/contexts/timer-stop-completion.component.test.tsx`.
- [ ] A member's stop of another member's timer sent from the widget or the Watch queues its save
      with the timer's identity — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`.
- [ ] With direct lock release blocked, a member stopping the owner's sleep timer leaves no lock and
      the owner's phone shows the timer stopped — proven in `e2e/scripts/run-household-timers.mjs`.

## Human checkpoints

- [ ] [confirm-security] Approve widening the elevated-rights atomic completion function to clear
      any household member's matching lock, after a security-reviewer pass.
- [ ] [confirm-db] Owner pastes migration 069 into the production SQL editor, then confirms the
      function body in production matches 069.
- [ ] [verify] Run `npm run e2e:household-timers:clean` with two iOS simulators and local Supabase. ·
      Expected: every scenario passes, including the member stop with direct release blocked. ·
      Failure: a remaining lock, the owner phone still showing the timer, or two records. · Reason:
      needs booted simulators, Maestro, and Docker.

## Acceptance criteria

- [ ] Every row of the table, replay, and the two-member concurrent stop hold for all four
      activity types in `npm run test:sql`.
- [ ] `npm run check` passes, with Docker running.
- [ ] Migration 065 is byte-identical to `hotfix/4.9`.
