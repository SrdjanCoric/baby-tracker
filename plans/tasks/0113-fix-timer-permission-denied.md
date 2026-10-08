# Task 0113: Stop "permission denied" errors when the app restores household timers

**Branch**: `feature/fix-timer-permission-denied`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: Sentry triage 2026-10-08 (org `sofibaby`, project `react-native`) · **User stories**: a
caregiver who opens the app sees their running timers come back, and the app never logs a
permission error for a timer read or write the user is allowed to make.

## What to build

When the app starts or comes back to the foreground, it restores running timers and loads the
household's timer locks. In production, these calls sometimes fail with Postgres error `42501`
(permission denied). When they fail, the user's timers do not come back.

After this task, every timer call that a signed-in household member is allowed to make succeeds.
When a call cannot be allowed, the app does not send it to the server at all.

| Situation when a timer call runs | Result |
| --- | --- |
| Signed in, login token valid, member of the household that owns the baby | Call succeeds. No `42501`. |
| Signed in, but the login is not ready yet (cold start, token still loading) | Call waits until the login is ready, then runs once. No `42501`. |
| Signed in, but the login token expired (`PGRST303`) | Login is refreshed once, then the call runs once. If refresh fails, it is handled the same as signed out. |
| Signed out, or a guest with no household | No timer call is sent to the server. Nothing is reported to Sentry. |
| Removed from the household, or the household or baby was deleted | No timer call is sent for that household or baby. Local timers for it are cleared, as when leaving a household today. |
| Server still answers `42501` in a case the table says is allowed | Reported to Sentry once per session, with the `code` tag and the failing table or function name. The user's local timer state is kept. |

Covered calls: restoring running timers (`timers.restore_failed`), loading the household's locks
(`timers.load_locks_failed`), reading a lock (`timers.lock_read_failed`), releasing a pending lock
(`timers.pending_lock_release_failed`), and the pending start-time edit
(`timers.pending_start_edit_rejected`).

## Decided

- Find the cause before changing anything: write a failing test that reproduces `42501` first, then
  fix. — The Sentry events do not show the full Postgres message, so the cause is not proven yet.
- If the cause is a server access rule (row-level security policy or missing grant), fix it with a
  new migration. Never widen access beyond the members of the household that owns the baby. —
  Timer data belongs to one household.
- All work and testing uses the local Supabase stack and emulators. No production database action. —
  Production is shared and recently unstable (2026-10-07 incident).

## Clarifications

## Non-goals

- `57014` statement timeouts and `Network request failed` in the same Sentry issues. Timeouts depend
  on database load (Tasks 0111, 0112). Offline noise is already partly filtered.
- Scoping live updates to one household. That is Task 0112.
- iOS session-lock errors (REACT-NATIVE-9, B, F). Fixed by Task 0097.

## Context

Sentry evidence (last 30 days, query `code:42501`):

- **39 events, all Android, all release `com.sofibaby.app@4.9.16+110`.** None on iOS. First seen
  2026-09-27, then bursts on 2026-10-06 and 2026-10-07.
- **[REACT-NATIVE-E](https://sofibaby.sentry.io/issues/REACT-NATIVE-E)** `timers.restore_failed`
  (35 users, 234 events in total). 22 events are `42501`. The rest are offline errors, `57014`
  (17 events) and `PGRST303` (3 events, login token expired).
- **[REACT-NATIVE-D](https://sofibaby.sentry.io/issues/REACT-NATIVE-D)** `timers.load_locks_failed`
  (39 users, 123 events in total). 7 events are `42501`. The rest are offline errors, `57014`
  (18 events) and `PGRST303` (2 events).
- Also `42501` on
  [REACT-NATIVE-N](https://sofibaby.sentry.io/issues/REACT-NATIVE-N) `timers.lock_read_failed`,
  [REACT-NATIVE-X](https://sofibaby.sentry.io/issues/REACT-NATIVE-X)
  `timers.pending_lock_release_failed` and
  [REACT-NATIVE-11](https://sofibaby.sentry.io/issues/REACT-NATIVE-11)
  `timers.pending_start_edit_rejected`.
- All 42501 events:
  [Discover query](https://sofibaby.sentry.io/explore/discover/homepage/?dataset=errors&queryDataset=error-events&query=code%3A42501&project=4512061428334673&field=issue&field=message&field=release&field=os.name&field=user.id&field=timestamp&field=is_owner&field=activityType&sort=-timestamp&statsPeriod=30d).

Patterns in the events:

- **App-start burst.** One `timers.restore_failed` per activity type (sleep, feeding, pumping,
  tummy time) and one `timers.load_locks_failed`, all in the same second. So every timer call in
  that run failed together. This points to the whole session lacking access at that moment (login
  not ready, token expired, or not a member any more), not to one table rule.
- **Most of these events come from household owners** (`is_owner: true`) who have a user id.
- **The N, X and 11 events have `is_owner: false` and no user id.** That looks like a signed-out
  user, a removed member, or a login that never loaded. All five happened in the same few minutes
  on 2026-10-07 (03:37–03:44 UTC).
- **Android only, 4.9.16 only.** That version came from the 4.9 hotfix line, which Task 0103 has since
  merged into `main`. The household-timers code that hit the error is now on `main`.
- **Sentry does not keep the full Postgres message,** so it does not show which table or function
  was denied. The tags only show `code`. Open one event's "Extra Data → error" in Sentry to see the
  PostgREST message, if it has one.

Known limit: some `42501` events in the bursts on 2026-10-07 happened during the production
outage (09:27–09:50 UTC). The 2026-09-27 and 2026-10-06 events did not.

## Implementation work

- [ ] Reproduce `42501` for each covered call on the local Supabase stack. Use the situations in
      the table: login not ready, token expired, signed out, removed member, deleted baby. Record
      in this file which situation causes it. Proven by a failing test in the timer service and
      lifecycle tests, or by SQL tests against the local database.
- [ ] Every allowed situation in the table succeeds without `42501`. Proven in those same tests.
- [ ] A timer call waits for the login to be ready and runs once. With an expired token, the login is
      refreshed once before the call runs. Proven in the timer lifecycle and active-timers context tests.
- [ ] Signed-out users, guests, removed members, and deleted households or babies send no timer
      call to the server and report nothing to Sentry. Proven in the same tests.
- [ ] If a server access rule is the cause: add a new migration so household members can make
      every allowed call, and no one outside the household can. Proven by SQL tests that cover a
      member, a non-member, a removed member, and the anonymous role.
- [ ] A `42501` that still happens in an allowed case is reported to Sentry once per session, with
      the failing table or function name in the report. Proven in the observability tests.

## Human checkpoints

- [ ] [confirm-security] Approve any change to row-level security policies, grants, or login
      handling before it is merged.
- [ ] [verify] Run the household-timers Maestro flow on an Android emulator against local Supabase
      with two accounts (owner and member). Start timers, kill the app, cold start, sign out and back
      in, remove the member while a timer runs. · Expected: timers come back after each cold start;
      no `42501` in the app logs. · Failure: any `42501`, or a running timer missing after restart. ·
      Reason: login restore timing on a real Android cold start is not covered by unit tests.

## Acceptance criteria

- [ ] Every row of the decision table is covered by a passing automated test.
- [ ] The test that reproduced `42501` fails on `main` and passes on this branch.
- [ ] Any new migration applies cleanly to the local Supabase stack, and its SQL tests pass.
- [ ] Lint, type check, and the full unit test suite pass.
- [ ] The [verify] checkpoint is confirmed by the owner.
