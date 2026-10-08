# Task 0112: Subscribe each phone only to its own household's live updates

**Branch**: `feature/scope-live-updates-to-household`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: production incident 2026-10-07 (Query Performance after restart: `realtime.list_changes`
used 32% of database time, 15,848 calls in about two hours; dashboard showed Realtime at 98.8%
errors) · **User stories**: caregivers keep seeing each other's entries live, and the live-update
cost per saved record stops growing with the number of phones online across all households.

## What to build

The app's live-update subscription (one channel per household, listening to 14 tables) asks
Supabase only for rows that belong to the signed-in user's household, instead of every row of
every table. Each listener carries a server-side filter:

| Table | Filter |
| --- | --- |
| feedings, sleep_sessions, diapers, pumping_sessions, growth_measurements, tummy_time_sessions, active_timers, wake_window_preferences, activity_goals, milestone_responses, health_entries | `baby_id` in the household's current non-deleted babies |
| babies | `household_id` equals the household |
| households | `id` equals the household |
| users | none (kept unfiltered, so remaining members still see a caregiver leave; this table changes rarely) |

| Situation | Result |
| --- | --- |
| Household has no babies | Baby-scoped listeners are not created; babies, households, and users listeners still run |
| A baby is added or restored by any member | The subscription is replaced with one that includes it; that baby's changes arrive live from then on |
| A baby is deleted | The subscription is replaced without it |
| More than 100 babies | Split across listeners of at most 100 ids each (Supabase's `in` limit) |
| Insert, update, tombstone update, or hard delete of a row in the household | Delivered as today |
| Any change to another household's rows | Never delivered to this phone |
| Replacing the subscription | No change in the household is lost: the app catches up after a replaced subscription becomes active |

The client-side ownership check stays as a second line of defence. Behaviour for guests, sign-out,
and household switching is unchanged.

## Decided

- App-only change: no migration, no production action — the tables already use replica identity
  full, which Supabase requires to filter delete events.
- Installed older versions keep their unfiltered subscriptions until updated; load falls as users
  update.
- Supabase Broadcast is out of scope; revisit if concurrent phones approach thousands.
- Development and tests use local data and the local Supabase stack; no agent touches production.

## Clarifications

- 2026-10-08: Owner approved the household data boundary and required existing behavior to
  keep working without breaking changes.

## Implementation classification

- Expected change class: `code`; actual: `mixed` (app code and isolated local-stack test
  configuration); validation tier: `canonical`; TDD applicable: `true`.

## Non-goals

- Moving to Broadcast, changing Realtime settings, or changing which tables are published.
- The app's table fetches and the widget snapshot (Task 0111).

## Context

Supabase checks every Postgres change against every subscriber, on a single thread that larger
compute does not speed up; filtered listeners are checked only for subscribers whose filter matches
([Postgres Changes limitations](https://supabase.com/docs/guides/realtime/postgres-changes)).
Supabase does not apply RLS to delete events, so today a hard delete in any household (for
example an `active_timers` row) reaches every connected phone with its old row; the filter also
closes that. Production on 2026-10-07: 817 accounts active in 30 days, mostly one or two phones
per household.

## Implementation work

- [x] Every listener carries the filter in the first table, and every situation row holds —
      proven in `src/services/sync/real-time-sync.test.ts`.
- [x] Against the local Supabase stack, a phone receives its household's inserts, updates, and
      deletes and none of another household's — proven in
      `src/services/sync/real-time-sync.integration.test.ts`.

## Human checkpoints

- [x] [confirm-security] Approve the change to which rows each phone receives (household data
      boundary; delete events bypass RLS).
- [ ] [verify] Run `npm run e2e:household-timers:clean` with two iOS simulators and local
      Supabase. · Expected: every scenario passes, including live updates between the phones. ·
      Failure: any step, or a change that appears only after reopening the app. · Reason: needs
      simulators, Maestro, and Docker.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.

## Implementation evidence

- Branch: `feature/scope-live-updates-to-household`.
- `real-time-sync.test.ts` proves all 14 table registrations, empty rosters, 100-ID chunks,
  roster replacement, equivalent roster deduplication, obsolete event/status callbacks,
  sign-out, existing household-switch behavior, and empty `new` records on hard deletes.
- `baby-context-household-refresh.component.test.tsx` proves the production roster producer:
  local adds/deletes, remote inserts/tombstones/restores, catch-up, and household switching
  without applying the old household's babies to the new subscription.
- `realtime-catchup.component.test.tsx` uses the real refresh coordinator to prove pending saves
  flush before pulls and overlapping replacements coalesce into one waiting catch-up pass.
  Coordinator tests additionally prove a new activation waits for an older foreground pull.
  Household component tests prove catch-up reloads membership and respects a changed household.
- RED/GREEN observed for filters, lifecycle callbacks/delete payloads, roster propagation,
  activation catch-up, fresh coordinator passes, and membership catch-up. Local integration
  sensitivity was proved by temporarily removing server filters: the foreign timer delete
  arrived and the assertion failed. Filters were restored before passing validation.
- Focused validation passed: 264 Vitest tests across sync and refresh coordination; 9 Jest
  component tests across roster, membership and catch-up; TypeScript; affected-file ESLint.
- `npx vitest run --config vitest.realtime.config.ts` passed against local Supabase with two
  generated households. It proves timer insert/update/hard-delete delivery and diaper
  insert/tombstone-update/hard-delete delivery, without foreign activity events. Fixtures are
  cleaned up. The dedicated config follows the existing local import-test convention so
  ordinary unit tests do not require a running database.
- Derived facts: BabyProvider already owns the reconciled non-deleted roster; use it rather
  than add another roster query. Existing activity refresh loaders also reload wake-window
  preferences and activity goals. Realtime connection callbacks previously only logged status;
  this task adds the required post-activation catch-up using those existing loaders plus baby
  and household loaders, without changing table-fetch implementations.
- Boundaries: `babies.id` and `household_id` are UUIDs in the schema; Realtime payloads and
  delete filtering were exercised through the real installed Supabase client/local server.
  Empty INSERT/DELETE payload sides are normalized to null. The documented `in` limit is
  100 and delete filters require replica identity FULL:
  <https://supabase.com/docs/guides/realtime/postgres-changes>.
- Deferred proof: full `npm run check` and the two-simulator clean timer gate belong to
  `finish-task` after manual review. No README, release, production, or PR action performed.
- Out-of-scope work discovered: None. Unrequested flags, environment variables, data sources,
  heuristics or fallbacks: None. The security approval above is the only clarification.
