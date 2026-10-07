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

- [ ] The new function returns output identical to the 061 function for every baby state listed
      above — proven in `scripts/sql/baby-activity-snapshot-tests.sql`.
- [ ] Per-call cost with two years of history stays within a small constant of the cost with one
      week, and every "latest" and "today" read is served by an index — proven in
      `scripts/sql/baby-activity-snapshot-cost-tests.sql`.
- [ ] Signature, security mode, search path, and grants are unchanged — proven in
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
- [ ] Migration 061 is byte-identical to `main` before this task.
