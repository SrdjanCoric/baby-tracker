# Task 0070: Guard `active_timers.started_at` against out-of-horizon writes

**Branch**: `feature/guard-active-timer-start-bounds`
**Depends on**: none
**Change class**: `code`
**Validation tier**: `focused`
**TDD applicable**: yes
**Source**: `plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md` and its member
`decisions/resolved/007-running-timer-start-time-edit.md` (resolved) · **User stories**: As a
caregiver, I want a household to always be able to start an activity timer, so that no timer lock can
be written with a start time that puts it beyond the reach of stale-lock cleanup.

## What to build

A database-level guard on `public.active_timers.started_at` that rejects a start time in the future or
more than twelve hours in the past, binding every writer of that column.

### The rule

A write of `active_timers.started_at` is accepted only when the value satisfies both:

- `started_at <= now()` — a start in the future is nonsense, and
- `started_at >= now() - INTERVAL '12 hours'` — a start rewound past the cleanup horizon.

The guard fires on `INSERT`, and on `UPDATE` **only when `started_at` actually changes**
(`NEW.started_at IS DISTINCT FROM OLD.started_at`). That condition is load-bearing: a `timer_data`
write to a lock that stale cleanup has not yet swept — a pause, a resume, or a widget update on a lock
older than twelve hours — must still succeed. A guard that fired on every `UPDATE` would collaterally
reject those.

### Why twelve hours

`cleanup_stale_timer_locks` is `DELETE FROM public.active_timers WHERE started_at <
pg_catalog.now() - INTERVAL '12 hours'` in `supabase/migrations/056_authorize_active_timer_controls.sql`.
A start rewound past that horizon makes a live timer's lock immediately eligible for deletion, leaving
a running timer with no lock while every other household device stops seeing it. A start parked in the
future is never reclaimed at all, so no caregiver in that household can start that baby's timer for
that activity again. Matching the bound to the cleanup horizon closes both by construction. The cost is
only sessions longer than twelve hours, which no timer here plausibly records.

### Why a trigger and not an RPC

`active_timers` is in the offline sync allowlist at `src/services/sync/sync-engine.ts`, and the engine
writes allowlisted tables generically, so a queued timer operation replays as a **direct table write**
regardless of what the app calls. Migration `056` also re-granted `SELECT, UPDATE, DELETE` on the table
directly to `authenticated`. An RPC would therefore be an authority the replay path bypasses, while a
trigger binds every writer: the `acquire_timer_lock` RPC (migrations `045`, `046`), the app's direct
writes in `src/services/active-timer-service.ts`, the widget and Watch REST writes in
`targets/widget/index.swift` and `targets/watch/index.swift`, and offline replay.

### What this task absorbs

This guard closes the defect Task 0056 was written for. That task was deferred and unplanned, claimed
migration `062` while the tree's head is `059`, and its own finding records that reassigning a lock to
another caregiver is already rejected by row-level security — so the future-`started_at` write was the
only live hole it named. The owner removed Task 0056 on 2026-08-05 in favor of this task. Nothing else
from 0056's scope is carried forward.

### What does not change

- **No row-policy change.** The policy from `supabase/migrations/020_add_active_timers.sql` stays
  `USING (started_by = auth.uid())`. The household timer control cut of 2026-08-05 means one caregiver
  never writes a timer another started, and that policy already enforces it. The household-wide
  `SELECT` policy also stays, which is why a second phone keeps displaying a timer it cannot touch.
- **No RPC signature change.** `acquire_timer_lock`, `release_timer_lock`, `toggle_timer_pause`, and
  `cleanup_stale_timer_locks` keep their signatures, their grants, and their behavior.
- **Backward-compatible client contract.** Existing clients keep using the same direct table writes
  and RPC call shapes. In particular, `acquire_timer_lock` calls that omit `p_started_at` continue to
  default to the server's current time, and pause, resume, release, cleanup, and `timer_data`-only
  updates remain valid. Only a future start or a start beyond the existing twelve-hour cleanup
  horizon is newly rejected.
- **No client change.** No screen, service, or validator is touched. The picker bounds that keep a
  caregiver from ever offering a rejected value are Task 0071.
- **No change to the cleanup horizon itself.**

### The previous-activity floor is not enforced here

`decisions/resolved/007-running-timer-start-time-edit.md` also floors a start edit at the previous
saved same-type activity's end. That floor is **presentation only** and is deliberately never enforced
server-side — it is a picker bound in Task 0071. This trigger enforces the twelve-hour horizon and the
future bound alone.

## Implementation work

- [x] Add migration `060` creating the validation function and the trigger on `public.active_timers`,
      firing on `INSERT` and on `UPDATE` gated by `NEW.started_at IS DISTINCT FROM OLD.started_at`,
      raising on a future value and on a value older than `now() - INTERVAL '12 hours'`.
- [x] Extend `scripts/sql/active-timer-authorization-tests.sql` with vectors covering: a future
      `started_at` write is rejected; a `started_at` more than twelve hours back is rejected; a
      `started_at` inside the window is accepted; a `timer_data`-only `UPDATE` on a lock whose
      `started_at` is older than twelve hours still succeeds; `acquire_timer_lock` with a valid
      `p_started_at` still succeeds, its legacy omitted-`p_started_at` call shape still succeeds, and
      an out-of-range value is rejected; `toggle_timer_pause`, `release_timer_lock`, and
      `cleanup_stale_timer_locks` are unaffected; a second caregiver still cannot write a lock they
      did not start.
- [x] Run `npm run test:sql`, `npm run test:edge:timer`, and `npm run test:security`.
- [x] Apply and verify the migration on local Supabase only.

## Human checkpoints

- [x] [confirm-security] Approve the trigger's shape and its rejection semantics before implementation
      — whether it raises an exception or silently clamps, and that it leaves the migration `020` row
      policy and the migration `056` grants untouched. This changes a write path on an authorization
      boundary that the app, both native targets, and offline replay all write through.
      **Confirmed by owner 2026-08-06:** use one trigger function with explicit `22023` rejection,
      preserve the policies, grants, and RPC signatures, and keep existing client call shapes and
      legitimate timer operations backward compatible.
- [ ] [verify] On local Supabase, start a timer, leave it running, and confirm normal operation is
      unaffected · Steps: acquire a lock, pause it, resume it, then release it · Expected: every step
      succeeds and no lock is left behind · Failure: any legitimate timer-control step is rejected by
      the new trigger · Reason: the RPC paths run against a live local database with real auth
      fixtures, and a regression here would be a caregiver unable to use a timer at all.

## Acceptance criteria

- [x] A write setting `active_timers.started_at` in the future is rejected, whether issued through the
      `acquire_timer_lock` RPC or as a direct table write.
- [x] A write setting `active_timers.started_at` more than twelve hours in the past is rejected on the
      same paths.
- [x] A `timer_data`-only `UPDATE` on a lock whose `started_at` is older than twelve hours still
      succeeds, proving the guard fires on `started_at` changes alone.
- [x] `acquire_timer_lock`, `release_timer_lock`, `toggle_timer_pause`, and `cleanup_stale_timer_locks`
      behave exactly as migration `056` intends.
- [x] A caregiver who did not start a timer still cannot write its row.
- [x] SQL vectors cover every rejection and every legitimate path above, and `npm run test:sql`,
      `npm run test:edge:timer`, and `npm run test:security` pass.
- [x] No row policy, no RPC signature, and no client file changed.
- [x] Existing client call shapes remain valid, including `acquire_timer_lock` with omitted
      `p_started_at`; only out-of-range timestamp writes newly fail.
- [ ] Both checkpoints confirmed by the owner.

## Non-goals

- Any client-side control, label, or picker bound. That is Task 0071.
- The previous-same-type-activity floor, which stays presentation-only by decision.
- Changing the twelve-hour cleanup horizon.
- Widening or narrowing `active_timers` row access in any direction.
- Anything else from the removed Task 0056, including `started_by` pinning, which row-level security
  already rejects.

## Review decisions

- skipped (minor): TR-7 — The grandfathered-lock pause vector does not assert the resulting row — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-8 — No vector exercises a full-row offline-replay update with an unchanged out-of-horizon start — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-9 — The implementation commit also amended the task specification — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-10 — The client-call-shape acceptance criterion lacks complete proof — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-11 — The SQL vector fixture depends on `session_replication_role = replica` — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-12 — The twelve-hour horizon is duplicated — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-13 — The trigger and function share the same identifier — User requested remediation only for TR-1–TR-6.
- skipped (minor): TR-14 — The trigger function has no explicit privilege block — User requested remediation only for TR-1–TR-6.
