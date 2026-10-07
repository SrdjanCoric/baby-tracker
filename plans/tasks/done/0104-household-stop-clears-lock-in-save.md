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

- 2026-10-07: after the security-reviewer pass described below, the owner approved
  widening atomic completion to household members with the reviewed guards: "ok".

## Implementation classification

- Change class: `code`; validation tier: `canonical`; TDD applicable: `true`.
- Implementation branch: `feature/household-stop-clears-lock-in-save`, based on `main`
  at `58b6360` after Task 0103. The remote base was fetched; local `main` already
  contained it.
- Task logs: `/tmp/agent-workflows/e2f8af45fd34/0ce276a1f60a`.

## Implementation progress

- 2026-10-07: read-only reconnaissance and security-reviewer pass completed.
  Existing remote-stop lifecycle resolves the completion identity but its persistence
  callback discards it; all four providers can use the existing optional completion
  argument of their database save functions.
- Reviewed migration 069 proposal: preserve 065's authenticated caller, expected-user,
  and household authorization before merge/replay; preserve the timer identity
  predicate, function signature, elevated rights, fixed search path, and grants.
  Remove the starter restriction from lock cleanup and add the nondeleted-baby
  household guard from 066's `release_timer_lock` to cleanup only. This permits
  deleted-baby saves without clearing their locks and protects replacement timers.
- Security-reviewer verdict: the proposal matches the approved household release
  authority with those guards. Owner approval of the declared `[confirm-security]`
  checkpoint was approved by the owner on 2026-10-07.

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

- [x] Migration 069 makes the atomic completion function follow the table — proven in
      `scripts/sql/active-timer-completion-tests.sql`.
- [x] A member's in-app stop of another member's timer, for all four timers, queues its save with
      the stopped timer's identity — proven in
      `src/contexts/timer-stop-completion.component.test.tsx`.
- [x] A member's stop of another member's timer sent from the widget or the Watch queues its save
      with the timer's identity — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`.
- [x] With direct lock release blocked, a member stopping the owner's sleep timer leaves no lock and
      the owner's phone shows the timer stopped — proven in `e2e/scripts/run-household-timers.mjs`.

## Human checkpoints

- [x] [confirm-security] Approve widening the elevated-rights atomic completion function to clear
      any household member's matching lock, after a security-reviewer pass.
- [ ] [confirm-db] Owner pastes migration 069 into the production SQL editor, then confirms the
      function body in production matches 069.
- [ ] [verify] Run `npm run e2e:household-timers:clean` with two iOS simulators and local Supabase. ·
      Expected: every scenario passes, including the member stop with direct release blocked. ·
      Failure: a remaining lock, the owner phone still showing the timer, or two records. · Reason:
      needs booted simulators, Maestro, and Docker.

## Acceptance criteria

- [x] Every row of the table, replay, and the two-member concurrent stop hold for all four
      activity types in `npm run test:sql`.
- [ ] `npm run check` passes, with Docker running.
- [x] Migration 065 is byte-identical to `hotfix/4.9`.

## Pre-review implementation evidence

- Migration 069 replaces only the atomic completion function and preserves the 065
  signature, security settings, grants, and identity comparison. The new cleanup
  guard follows 066's household/nondeleted-baby rule. Migration 065 matches
  `hotfix/4.9` byte for byte.
- Shared remote-stop persistence now receives the resolved completion. All four
  providers pass its instance id and original start to the existing queued-save
  metadata; direct release attempts remain unchanged.
- The blocked-direct-release E2E scenario now stops from the member's dashboard,
  backgrounds the owner, checks one additional saved activity with no lock, then
  foregrounds the owner and checks stopped prediction and unlocked controls.
  Its implementation is complete; live simulator proof remains the declared
  `[verify]` checkpoint, not a pre-review result.

### Coverage and TDD

- Client RED: `client-red.log` — member online/offline saves left four locks;
  Widget/Watch remote saves omitted the expected completion argument.
- Client GREEN: `client-green.log` — 62 component/integration tests passed
  (5.56 seconds), including the real providers, storage, CRDT, and sync queue.
- SQL RED: `sql-red.log` — existing 065 left the other starter's sleep lock.
- SQL GREEN: `sql-green.log` — all four decision tables, replay, replacement,
  former-member replay rejection, deleted-baby retention, rollback, and grants passed.
- `npm run test:sql`: passed on a clean local migration chain (`sql.log`).
  The runner adds simultaneous authenticated owner/member completions and replay
  for all four activity types, asserting one record, zero locks, and two acknowledgements.
- Focused unit tests: 62 passed across timer lifecycle, timer completion, active
  timer service, and sync engine (`unit.log`, 0.402 seconds).
- `npm run typecheck`: passed (`typecheck.log`).
- ESLint on changed executable files with `--max-warnings=0`: passed (`lint.log`
  and `runner.log`).
- `npm run e2e:household-timers:test`: 18 runner tests passed (`runner.log`).
  JavaScript syntax checks and `git diff --check` passed.
- Full `npm run check` is deferred to finish-task after manual review; the clean
  two-simulator E2E and owner production migration checkpoint remain unchecked.

### Derived facts and boundaries

- Existing `create*InDatabase` functions already accept queued completion metadata:
  `src/services/activity-sync-service.ts`. The real sync-engine component tests
  prove metadata reaches `merge_record_and_complete_timer` without entering the
  activity record.
- Lock start times are strings produced by `acquireTimerLock` and lock readers in
  `src/services/active-timer-service.ts`; acquisition itself accepts a Date.
  The component fixture uses provider-produced lock data and mirrors that conversion.
- Native command identities follow the existing external command queue contract
  consumed by `useWidgetStopHandler`; real-provider integration tests exercise its
  Widget and Watch paths through the save callback.
- SQL records and acknowledgements follow the existing migrations and real
  `merge_record` function. Decision-table tests and simultaneous authenticated
  database sessions exercise the complete RPC/merge/delete boundary.
- The E2E ownership checker aggregates caregiver emails for all saved records:
  `verifyHouseholdTimerStop` in the runner. Both records in the member-stop scenario
  belong to the member, so its expected aggregate includes the member twice.
- Local SQL initially failed unrelated token, invitation, and snapshot permission
  checks. Rebuilding only the isolated local database with `npm run test:sql:setup`
  resolved them; no unrelated product changes were made. Earlier evidence is retained
  in `sql-before-clean-setup.log`; provisioning evidence is in `sql-setup.log`.
- Actual classification remains `code / canonical / TDD applicable`.
- Questions: the declared security checkpoint was approved by the owner; no other
  clarification was needed.
- Additions outside the task: None. Out-of-scope work left undone: None.
- Ready for manual task-review. No README changes, final completion record, PR,
  production access, or production migration was performed.

## Completion

- 2026-10-07: owner requested local squash/merge to `main` and task closeout together.
- Implementation is complete. Production checkpoints remain owner work.
- Full `npm run check` was not run. The clean two-simulator E2E retry was stopped during validation at the owner’s request to close out; no passing E2E result is claimed.
