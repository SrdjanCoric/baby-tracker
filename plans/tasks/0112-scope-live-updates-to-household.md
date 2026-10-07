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
| Replacing the subscription | No change in the household is lost: the app catches up after the new subscription is active, as it does after a reconnect today |

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

- [ ] Every listener carries the filter in the first table, and every situation row holds —
      proven in `src/services/sync/real-time-sync.test.ts`.
- [ ] Against the local Supabase stack, a phone receives its household's inserts, updates, and
      deletes and none of another household's — proven in
      `src/services/sync/real-time-sync.integration.test.ts`.

## Human checkpoints

- [ ] [confirm-security] Approve the change to which rows each phone receives (household data
      boundary; delete events bypass RLS).
- [ ] [verify] Run `npm run e2e:household-timers:clean` with two iOS simulators and local
      Supabase. · Expected: every scenario passes, including live updates between the phones. ·
      Failure: any step, or a change that appears only after reopening the app. · Reason: needs
      simulators, Maestro, and Docker.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
