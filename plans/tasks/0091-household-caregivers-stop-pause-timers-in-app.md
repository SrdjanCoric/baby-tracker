# Task 0091: Household caregivers stop/pause timers in-app

**Branch**: `feature/household-caregivers-stop-pause-timers-in-app`
**Depends on**: none
**Source**: `plans/allow-household-timer-control.md` (planning brief, 2026-09-01) · **User stories**: As a caregiver, I can stop or pause/resume a timer another household member started, from my own app, and exactly one activity record is saved.

## What to build

Today only the caregiver who started a timer can stop, pause, or resume it; other household members see a read-only hourglass card. After this task, any caregiver in the baby's household can stop and pause/resume any active timer from the app dashboard, end to end:

- Backend authorization widens from owner (`started_by = auth.uid()`) to household membership of the baby: `active_timers` UPDATE/DELETE RLS policies, `release_timer_lock`, and `toggle_timer_pause`. INSERT policy and `acquire_timer_lock` stay unchanged (`started_by` still records the starter). Non-household and unauthenticated callers stay denied (`42501` / RLS).
- Client service layer drops its own `started_by` filters on release/update paths.
- Dashboard card for a remote timer (`isLockedByOther`) becomes interactive: stop and pause/resume controls, while keeping the "started by <name>" attribution display.
- Stopping a remote timer saves an activity record owned by the stopper ("they logged it"), built from lock data (start, end, duration, type — per-side breastfeeding detail may be absent; accepted).
- **Deterministic record ID**: every timer-produced record (own-stop and remote-stop paths) derives its ID deterministically from `timerInstanceId` (recommended: UUIDv5 with a fixed app namespace). Concurrent or offline-replayed stops from multiple members converge into one record via the existing LWW/CRDT merge — a duplicate is impossible by construction.
- Starter's device, on detecting its lock vanished (realtime DELETE or foreground restore check), clears local timer state (AsyncStorage + dispatch) **without saving** — the stopper already saved.

Superseded design (do not resurrect, from the pre-2026 version of the plan file): duplicate prevention via `release_timer_lock` return-value gating or a `started_at` SELECT pre-check. Deterministic IDs replace both.

## Implementation work

- [ ] New migration (next free number): drop/recreate `active_timers` UPDATE and DELETE RLS policies scoped to household membership of the baby; rewrite `release_timer_lock` and `toggle_timer_pause` owner checks (currently raise `42501` for non-owner, added in migration 056) to household-membership checks, still raising `42501` for non-household callers.
- [ ] Extend `scripts/sql/active-timer-authorization-tests.sql`: household member CAN release/pause another member's timer; outsider and unauthenticated still denied; starter path unchanged.
- [ ] Remove client-side `.eq("started_by", userId)` filters in the active-timer service release/update paths (keep the param for logging).
- [ ] Deterministic record-ID derivation from `timerInstanceId`, applied in ALL timer-stop record-creation paths (feeding, sleep, pumping, tummy time; own and remote stop), with unit tests proving two independent stops of the same timer instance yield the same ID.
- [ ] `stopRemoteTimer`-style function per activity context: build stopper-owned record from lock data, save through the normal CRDT/sync path, release the lock.
- [ ] Remote pause/resume wired through `toggle_timer_pause` from the dashboard card.
- [ ] Starter-device external-lock-removal handling in each activity context: active local timer + lock gone → clear without saving; also on foreground timer restore, verify lock still exists before resuming.
- [ ] Dashboard card: replace hourglass/disabled state with stop + pause controls for remote timers; keep caregiver attribution badge/text.
- [ ] Extend `npm run e2e:household-timers` (two iOS accounts): A starts, B stops → one record (owned by B), A's timer clears; simultaneous stop → still one record.
- [ ] Unit/integration tests per context for remote stop, clear-without-save, and replay convergence (pending offline mutation replays after remote stop → no second record).

## Human checkpoints

- [ ] [confirm-security] Apply the RLS/RPC authorization widening from owner to household (user approved the decision in the 2026-09-01 planning discussion; confirm the concrete migration before it ships).
- [ ] [confirm-db] Run the new migration against the shared Supabase project.
- [ ] [decision] Mixed-version rollout: old app versions still save stop records with random IDs, so deterministic-ID dedup only protects updated clients. Decide whether to carry a temporary compat guard (e.g. skip save when a record with the same baby/type/`started_at` exists) or accept the transient duplicate risk during rollout (`talk-it-through`).

## Acceptance criteria

- [ ] SQL authorization suite passes: household member allowed, outsider denied, unauthenticated denied, for release and pause.
- [ ] Two-account E2E: B stops A's timer from the dashboard; exactly one record exists, owned by B; A's device shows no running timer and saved nothing.
- [ ] Simultaneous/replayed stops converge to exactly one record (deterministic-ID unit + integration tests green).
- [ ] B can pause and resume A's timer; state reflects on both devices.
- [ ] Starter stopping their own timer behaves exactly as before (regression: existing timer lifecycle and stop-provider tests green).
