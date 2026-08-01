# Task 0056: Keep an active timer lock reclaimable

**Branch**: `feature/keep-active-timer-locks-reclaimable`
**Depends on**: 0055
**Source**: Task 0052 native/sync audit, 2026-08-01 · **User stories**: a household can always start an activity timer, because no lock can be parked beyond the point where stale-lock cleanup reclaims it

## What to build

`active_timers` holds one lock per `(baby_id, activity_type)`. Migration 056 routed timer control
through authorized RPCs but also re-granted `SELECT, UPDATE, DELETE` on the table directly to
`authenticated`, and the row policy from migration 020 is `USING (started_by = auth.uid())` with no
`WITH CHECK`. The implicit check is that same expression, so it constrains `started_by` and nothing
else.

Confirmed locally against a synthetic fixture: reassigning the lock to another caregiver was
rejected by row-level security, but the holder setting `started_at = now() + interval '100 years'`
was accepted. `cleanup_stale_timer_locks()` only deletes rows where `started_at` is older than twelve
hours, so a lock parked in the future is never reclaimed and no caregiver in that household can start
that baby's timer for that activity again.

Constrain the direct-table path so a caller cannot write a `started_at` that escapes the cleanup
horizon — a `WITH CHECK` on the UPDATE policy, or dropping the direct UPDATE grant and forcing writes
through the migration 056 RPCs. Pause, resume, release and stale cleanup must keep working exactly as
056 intends.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Apply and verify on local Supabase only; the release owner applies to production.
- [ ] Cover the rejection and the legitimate timer-control paths in the same vector run.
- [ ] Keep credentials and endpoints synthetic and local.

## Implementation work

- [ ] Establish which direct writes to `active_timers` the application actually performs, so removing or constraining the grant does not break a real path.
- [ ] Add migration `062` constraining the UPDATE path so `started_at` cannot be set into the future and `started_by` stays pinned, or dropping the direct grant in favor of the RPCs.
- [ ] Extend `scripts/sql/active-timer-authorization-tests.sql`: as the lock holder, a future `started_at` write is rejected; `cleanup_stale_timer_locks()` still reclaims a genuinely stale lock; acquire, pause, resume and release through the RPCs are unaffected; a second caregiver still cannot take over a held lock.
- [ ] Run `npm run test:sql`, `npm run test:edge:timer` and `npm run test:security`.

## Human checkpoints

- [ ] [confirm-security] Approve the chosen approach — constrained policy or revoked grant — before it is implemented, since it changes an authorization boundary the app writes through.
- [ ] [verify] After deployment, confirm two caregivers can still hand off a timer normally · Steps: start a timer as one caregiver, stop it, then start the same activity's timer as the other caregiver · Expected: the handoff succeeds and no lock is left behind · Failure: a caregiver is blocked from starting a timer, or a stale lock survives past twelve hours · Reason: multi-caregiver handoff depends on real household accounts and real timing.

## Acceptance criteria

- [ ] A lock holder cannot set `started_at` beyond the stale-lock horizon.
- [ ] `cleanup_stale_timer_locks()` reclaims a genuinely stale lock.
- [ ] Acquire, pause, resume, release and cross-caregiver rejection all still behave as migration 056 intends.
- [ ] SQL vectors cover the rejection and every legitimate path above.
