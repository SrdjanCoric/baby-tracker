# Task 0111: Make the widget and Watch activity snapshot cost independent of history length

**Branch**: `feature/bound-activity-snapshot-cost`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: production incident 2026-10-07 (database on Micro compute ran out of memory and disk
budget; Query Performance after the restart showed `get_baby_activity_snapshot` using 44.8% of
all database time, 847 calls in about two hours at about 275 ms each) · **User stories**: the iOS
widget and Watch load quickly, and the database load they cause stays flat as babies get older.

## What to build

A new migration `070` replaces the body of `public.get_baby_activity_snapshot(p_baby_id uuid,
p_timezone text)` and adds indexes, so that one call reads only the rows its output needs instead
of every record in the baby's history.

- For every input, the new function returns output identical to the current function from
  migration 061: the same JSON keys, values, ordering, and version fields, and the same errors for
  unauthorised, unknown, or deleted babies.
- One call's cost does not grow with the length of the baby's history: a baby with two years of
  records costs about the same per call as the same baby with one week of records.
- Every activity table the function reads has an index that serves "this baby's newest or
  today's non-deleted records" directly.
- The name, arguments, return type, security mode, search path, grants, and column-level grants
  stay exactly as in 061, so every installed app, widget, and Watch calls it unchanged.
- Applying 070 in production does not block reads or writes on the activity tables while indexes
  build. The migration's header states how the owner applies it in the SQL editor.

Equivalence must hold for at least these baby states: newborn with no records; one week of
records; two years of records; last record of a type older than the function's look-back (the
latest feeding, sleep, diaper, pumping, growth, and tummy time are still reported); a running or
paused timer of each type; deleted records; records spanning midnight in the given time zone and
across a daylight-saving change; morning-sleep classification inputs; nap continuation grouping.

## Decided

- Server-only fix: no app, widget, or Watch release is needed — owner, 2026-10-07.
- Migration 061 is never edited; 070 replaces the function in place. Number 069 is reserved by
  Task 0104; numbers may be applied with 069 absent.
- No agent connects to production; the owner pastes 070 into the production SQL editor.
- Production scale on 2026-10-07: 1,863 accounts, 817 active in 30 days, 247 babies logged in a
  day, about 420 snapshot calls an hour; per-baby history up to about a year.
- Rollback: re-running the 061 function definition restores the old body; the indexes may stay.

## Clarifications

- Owner approved an automated cost limit of at most twice the database work for two years versus one week. Measure complete authenticated snapshot shared-buffer accesses after warming both fixtures; also verify indexed activity reads do not visit the older history.

## Non-goals

- Live-update (`realtime.list_changes`) load, the app's table fetches, and the reminder jobs.
- Changing what the snapshot contains or how often the widget and Watch call it.
- Any change to `hotfix/4.9`; the function body there is identical to `main`'s.

## Context

The 061 body gathers all of a baby's non-deleted feedings and sleeps without a date bound, then
sorts and groups them; the activity tables are indexed only by `baby_id` (plus partial
`baby_id WHERE deleted = false` indexes from migration 052), so "latest" lookups read and sort the
baby's whole history. The widget calls the function about every 30 minutes and on app-requested
reloads; the Watch every 2 to 10 minutes while a timer runs. `scripts/sql/baby-activity-snapshot-tests.sql`
already covers the function's current behaviour and runs in `npm run test:sql`.

## Implementation work

- [x] The new function returns output identical to the 061 function for every baby state listed
      above — proven in `scripts/sql/baby-activity-snapshot-tests.sql`.
- [x] Per-call cost with two years of history stays within a small constant of the cost with one
      week, and every "latest" and "today" read is served by an index — proven in
      `scripts/sql/baby-activity-snapshot-cost-tests.sql`.
- [x] Signature, security mode, search path, and grants are unchanged — proven in
      `scripts/sql/baby-activity-snapshot-tests.sql`.

## Human checkpoints

- [ ] [confirm-db] Owner applies migration 070 in the production SQL editor as its header
      describes, then confirms the indexes exist and the function body matches 070.
- [ ] [verify] One hour after applying, open Query Performance (reset its statistics first). ·
      Expected: `get_baby_activity_snapshot` mean time under 20 ms and no longer the top entry;
      widget and Watch show the same data as before. · Failure: mean time still over 100 ms, or any
      widget or Watch value changed. · Reason: production traffic and devices.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
- [x] Migration 061 is byte-identical to `main` before this task.

## Implementation setup

- Owner requested implementation on `feature/household-stop-clears-lock-in-save`, alongside the completed Task 0104 implementation; its original branch value is superseded for this run.
- Classification: `code`; validation tier: `canonical`; TDD applicable: yes (executable SQL).
- Focused proof: local SQL equivalence, authorization/metadata checks, and cost/index tests. Full `npm run check` belongs to finish-task after manual review.

## Pre-review implementation evidence

- Migration 070 adds seven concurrent partial indexes and replaces only the snapshot body.
  Shared visibility/completed-sleep CTEs inline; selected-baby predicates, scalar morning
  bounds, and separate latest/day consumers avoid gathering the full history. The morning
  recursion, transitive nap grouping, JSON construction, and installed RPC contract remain
  unchanged. Its header explains separate SQL-editor statements and rollback to 061.
- `baby-activity-snapshot-tests.sql` compares every existing snapshot assertion to the real
  immutable 061 function through a transaction-local oracle. Shared history fixtures add
  one week/two years, years-old latest records, a very old overnight start, populated DST
  and midnight states, all four running/paused timers, and deleted history. Existing cases
  cover newborn/empty babies, denied/unknown/deleted babies, morning classification,
  continuation grouping, and activity rows hidden by matching timers.
- Function signature, volatility, security mode, search path, and function/relation/column
  grants are checked against 061. The anonymous execution test still calls the real RPC.
  Migration 061 is byte-identical to local `main` (`git diff --exit-code main -- ...`).
- `baby-activity-snapshot-cost-tests.sql` runs the complete authenticated function against
  one week then two years, warms each, and checks the approved 2x shared-buffer limit.
  Expanded generic parameterized plans must use indexes for all six activity tables and
  cannot visit more than the fixture's 56-row week per scan. All seven indexes must be
  ready/valid. The suite is wired into `npm run test:sql`.

### TDD and validation

- RED: `snapshot-cost-red.log` — 061 scanned all 5,840 feeding rows rather than using an
  indexed bounded read. Intermediate plans also identified unbounded morning-sleep scans.
- GREEN: `snapshot-final-local.log` — the full migration chain and final equivalence/cost
  suites passed; one week used 302 shared-buffer accesses, two years used 296.
- `npm run test:sql` passed, including all existing SQL and concurrency tests
  (`snapshot-sql.log`); before sharing the fixture between the named equivalence and cost
  suites, its cost measurement was 281 versus 290 accesses.
- JavaScript syntax, focused ESLint, and `git diff --check` passed (`snapshot-static.log`).
  Final syntax/diff checks also passed after the test-fixture extraction.
- Local provisioning initially encountered a starting container. A later run encountered
  drifted local grants while another workflow was updating this branch. Reapplying the
  isolated local migration chain restored the expected state; the final focused suites
  passed. No unrelated product code was changed for these local-state failures.
- Full `npm run check` remains the finish-task proof after review. Production application
  and the one-hour Query Performance/device checkpoint remain owner work.

### Derived facts, boundaries, and scope

- The existing date bounds, latest ordering and ID tie-breaks, timer exclusions, morning
  recursion, and running maximum for nap continuation come from migration 061. No new
  look-back or production heuristic was introduced.
- The row boundary is the real local PostgreSQL schema from migrations 001 through 070;
  both the 061 oracle and candidate read the same database-produced rows under authenticated
  RLS. JSON is compared end to end, including nested arrays and version fields.
- The plan/buffer boundary is PostgreSQL 17's `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.
  Real complete-function plans supply buffer totals; expanded generic plans supply relation
  scans. The recursive reader follows the real `Plans` arrays rather than fabricated plans.
- The bulk history fixture disables only the two reminder-cache update triggers inside its
  rollback-only transaction. They update baby fields the snapshot never reads (061's
  `authorized_baby` projection); otherwise thousands of unvacuumable baby row versions
  distort the history comparison. Production triggers are unchanged.
- Clarification: owner approved at most twice the database work for two years versus one week.
- Additions outside the task: None. Out-of-scope product work deliberately left undone: None.
  Unrelated concurrent task commits and Watch icon edits were preserved.
- Actual classification: `code / canonical / TDD applicable`. Ready for manual task-review;
  no README update, final completion status, PR, or production access was performed.

## Completion

- 2026-10-07: owner requested local squash/merge to `main` and task closeout together.
- Implementation is complete. Production checkpoints remain owner work.
- Full `npm run check` was not run. The clean two-simulator E2E retry was stopped during validation at the owner’s request to close out; no passing E2E result is claimed.
