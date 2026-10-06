# Task 0102: Clear a household timer lock in the same server step that saves the stopped activity

**Branch**: `hotfix/4.9.23-atomic-timer-completion`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). Not `main`.
**Source**: conversation 2026-10-06 — household report, reproduced on two simulators against local
Supabase · **User stories**: when one caregiver stops a timer, the other caregiver's phone shows
the timer as stopped (for sleep: the prediction, not "<baby> is sleeping") the next time it opens
the app.

## What to build

Applies to all four timers: sleep, feeding, pumping, and tummy time. The queued save of an activity
that came from a stopped timer carries the stopped timer's identity (its timer instance id and its
start time). The server applies that save and the lock clearing in one transaction: both commit or
neither does. A stop that is saved is therefore never left with that timer's lock on the server,
whether the save lands immediately or later from the queue.

The server decides the lock for the baby and that activity type with this table. Unless a row says
otherwise, the completed record is saved under the existing merge rules.

| Caller authorised for the record | Lock for baby and activity type | Lock started by caller | Lock matches stopped timer | Result |
| --- | --- | --- | --- | --- |
| no, or not signed in | any | any | any | Reject; nothing saved; lock unchanged |
| yes | none | — | — | Save; nothing cleared |
| yes | present | no | any | Save; lock kept |
| yes | present | yes | yes: instance id equal | Save; lock cleared |
| yes | present | yes | lock has no instance id and its start equals the stopped timer's start | Save; lock cleared |
| yes | present | yes | no: different instance id, or no instance id and a different start | Save; lock kept |
| yes | any | any | queued save carries no timer identity | Save; lock unchanged |

"Matches" is the same rule the existing lock release applies. Replaying the same queued save
(retry after a network failure, app restart) produces the same end state and no error.

The app keeps its existing direct release attempt on stop as an early clear. If that attempt fails,
the lock is still cleared when the queued save lands.

## Decided

- Save and lock clearing commit in one transaction — two separate writes is the defect.
- The lock clearing rides the queued save, not a second retry queue — the save queue already
  survives offline stops, restarts, and suspension.
- The existing direct release on stop stays as a backup — owner's choice; it is a no-op when the
  lock is already gone.
- Older app versions keep working unchanged: the existing merge write and lock release functions
  keep their signatures and behaviour — households run mixed app versions during rollout.
- The new server function clears only a lock the caller started for the stopped timer, and checks
  household membership the way the existing merge write does — no widening of who may clear a
  lock.
- The new server function runs with elevated rights and a fixed search path, like the existing
  merge write — RLS would otherwise block the combined write; this needs security review.
- Sleep, feeding, pumping, and tummy time ship together in one task — owner's choice.
- Ships as patch 4.9.23 from this branch and is fast-forwarded into `hotfix/4.9` after release —
  4.9 hotfix line policy.

## Clarifications

- 2026-10-06: Owner instructed implementation to continue without the prerequisite planning PR.
- Classification: `code`; validation tier: `canonical`; TDD applicable: `true`.

## Non-goals

- Making the activity record itself the single source of "timer is running" (removing the separate
  lock) — owner rejected for this hotfix.
- Letting a caregiver stop or clear a timer another caregiver started.
- Changes to the home-screen widget, Watch, Live Activity, or the widget push function.
- Viewer-side logic that hides a lock whose activity is already saved.
- Changing when the foreground retry of pending releases runs.
- Two-caregiver device scenarios for feeding, pumping, and tummy time; the device suite stays
  sleep-only, as it is today.

## Context

Stopping a sleep timer today makes two independent server writes: the completed sleep goes through
the offline save queue, and the household lock is released by a separate call. When the second
write fails or the app is suspended between them, the lock stays on the server. The other
caregiver's prediction header and sleep card then say the baby is sleeping until the stopping
caregiver opens the app again.

Reproduced 2026-10-06 on two simulators against local Supabase. Making only the lock delete fail on
the local database (a temporary trigger on lock deletes) left the completed sleep saved with an end
time while one lock row remained. The member phone, reopened from the background, showed
"E2E Baby is sleeping" in both the prediction header and the sleep card. The lock disappeared, and
the member phone switched to the prediction, only after the owner phone came to the foreground.
That foreground start runs the pending-release retry. With no failure injected, the same steps
leave no lock and the member phone is correct.

The completed sleep reaches the server through the save queue's call to the merge write function.
In the reproduction, the queued save landed within seconds while online. Locks are unique per baby
and activity type and record who started them. Their timer data carries the timer instance id and
activity id for timers started by current app versions; older locks may lack the instance id.

### Fast local simulator loop

Everything below runs on the developer's Mac against local Supabase only.

1. Start Docker Desktop (`open -a Docker`) and wait until `docker info` succeeds.
2. Start local Supabase: `npx supabase start`. If the storage service fails its own migration
   (`duplicate key value violates unique constraint "migrations_name_key"`), timers do not need
   it: `npx supabase start -x storage-api,imgproxy,studio`.
3. The full gate `npm run e2e:household-timers:clean` resets the local database, seeds fixtures,
   builds the app once, and runs the suite. When the E2E app is already installed and the database
   is migrated, `npm run e2e:seed` then `npm run e2e:household-timers` takes about four minutes.
4. The suite uses the named simulators `SofiBaby Owner` and `SofiBaby Member`. Boot both
   beforehand with `xcrun simctl boot "SofiBaby Owner"` and `xcrun simctl boot "SofiBaby Member"`
   so the run skips cold boot.
5. For a hand-driven check: start Metro with the local env the runner uses
   (`SOFIBABY_E2E_LOCAL_ENV=1`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
   `npx supabase status -o env`, `EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS=0`, then
   `npx expo start --dev-client --port 8081 --clear`). Log each simulator in with
   `maestro --device <udid> test -e E2E_EMAIL=e2e-owner@test.local e2e/flows/household-timers/login.yaml`
   (use `e2e-member@test.local` on the other).
6. The prediction header shows "Set up sleep predictions" until day boundaries are saved on that
   device. Tap **Set up**, then **Save**, on the member before checking the header for
   "E2E Baby is sleeping".
7. To send the member app to the background without killing it:
   `xcrun simctl launch <member udid> com.apple.Preferences`. Reopen it with
   `xcrun simctl launch <member udid> com.sofibaby.app`.
8. Inspect locks and the last sleep with `psql` on `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   against `active_timers` and `sleep_sessions`.

## Implementation work

- [x] The server applies the decision table in one transaction for each of the four activity
      types, including replay and rejection rows — proven in
      `scripts/sql/active-timer-completion-tests.sql` (new, run by `npm run test:sql`).
- [x] When the save is rejected or fails partway, the lock is unchanged and nothing is saved —
      proven in `scripts/sql/active-timer-completion-tests.sql`.
- [x] Each of the four stop flows queues its completed save with the stopped timer's identity, and
      the queue sends that save through the new server function; saves without a timer identity
      use the existing merge write unchanged — proven in `src/services/sync/sync-engine-crdt.test.ts`.
- [x] A queued completion retried after a network failure or an app restart keeps its timer
      identity and reaches the same end state — proven in `src/services/sync/sync-engine-crdt.test.ts`.
- [x] Stopping each of the four timers while the direct release fails still leaves no lock once the
      queued save lands — proven in `src/contexts/timer-stop-completion.component.test.tsx` (new).
- [x] The two-caregiver suite gains a scenario: the owner stops sleep while the direct release is
      made to fail on the local server; the member, reopened from the background without a
      restart, shows the prediction header and an unlocked sleep card, and the database holds no
      sleep lock — proven in `e2e/scripts/run-household-timers.mjs`.

## Human checkpoints

- [ ] [confirm-security] Approve the new elevated-rights server function after the
      `security-reviewer` pass: its membership check, the only-own-matching-lock rule, its search
      path, and its execute grant.
- [ ] [confirm-db] Approve applying the new migration to production Supabase before the 4.9.23
      build ships. The app must not call the function before the migration exists in production.

## Acceptance criteria

- [x] Every row of the decision table, plus replay, holds for all four activity types in
      `npm run test:sql`.
- [ ] `npm run check:code` passes with no new failures.
- [x] `npm run e2e:household-timers` passes, including the new blocked-release scenario and every
      existing step of the two-caregiver handoff.
- [x] The existing release and merge write functions keep their signatures, proven by the existing
      SQL tests passing unchanged.


## Implementation evidence

- Implemented migration `065_atomic_timer_completion.sql`, preserving both existing merge
  signatures and the existing release paths. The new owned RPC merges and clears the matching
  caller-owned lock in one transaction, with legacy start-time matching at JavaScript millisecond
  precision. Cleanup also runs on acknowledged replay.
- All four provider stops and offline-conflict completion saves carry the completion journal's
  timer instance and accepted start in queue metadata, outside the activity's CRDT columns.
  Manual saves and older queued operations continue through `merge_record`.
- RED/GREEN evidence: SQL failed with the function absent, then passed the four-type decision
  matrix; five queue expectations failed on the old RPC route, then passed; two provider tests
  failed with the pre-fix identity propagation, then passed online and offline; four conflict
  completion expectations failed without metadata, then passed.
- Focused unit validation: 314 tests in 22 files passed, covering sync, lifecycle, and durable
  activity saves. Provider validation: 55 tests in two files passed. Affected-file lint,
  TypeScript, and 15 household-runner tests passed.
- The new two-simulator scenario verified a blocked direct delete using a nontransactional
  sequence, a saved sleep with zero locks, and a member background/foreground transition showing
  the prediction header and unlocked sleep card without restarting the member app.
- Security-reviewer pass: no actionable security findings. Caller identity, household membership
  before replay cleanup, owner/instance matching, empty search path, authenticated-only grant,
  and transaction rollback were reviewed. Owner security approval remains a human checkpoint.
- Derived facts and boundaries: identity matching follows `active-timer-service.ts`'s string-ID
  or millisecond-start comparison; replay follows migration 055's acknowledgement contract;
  restart fixtures are serialized by the real `SyncQueue.persist` and restored by its reader;
  provider fixtures capture timer data produced by the real start flows and exercise real activity
  saves and queue dispatch. SQL tests exercise the actual Postgres functions and activity schemas.
- Actual change class: `mixed` (code plus the task's 4.9.23 release configuration); validation tier:
  `canonical`; TDD applicable: `true`. `npm run check:code` remains the final proof owned by
  `finish-task` after the manual review loop.
- Production additions outside the task: None. Clarifications beyond the planning-PR override:
  None. Unrelated code changes: None. The existing E2E seed's broad local grants affect unrelated
  SQL privilege checks; those fixture grants were left unchanged.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/1a96c1d17b47`.

- Final integration proof: `npm run e2e:household-timers` passed the entire sleep handoff,
  blocked-release/background-return scenario, native snapshot assertions, and date-picker check.
  After resetting only the local test database, all 67 migration files applied, including migration 065 and `npm run test:sql`
  passed, including the new matrix and unchanged legacy merge/release tests. This clean SQL run
  reset the seeded E2E fixtures; seed them before the next fast simulator run.
- Backward-compatibility fact check: migration 065 only adds a distinct RPC and its grants;
  existing merge/release definitions, table schema, RLS policies, and direct clients are unchanged.
  Creation and grant restriction publish in one transaction. Older clients and older queued saves
  retain their existing route. Apply migration 065 to production before shipping the 4.9.23 app.
- Ready for manual `task-review`; the master-plan pointer remains in progress. No task review,
  README update, production migration, or PR was performed in this implementation workflow.
