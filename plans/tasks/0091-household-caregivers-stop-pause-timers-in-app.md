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

- [x] New migration (next free number): drop/recreate `active_timers` UPDATE and DELETE RLS policies scoped to household membership of the baby; rewrite `release_timer_lock` and `toggle_timer_pause` owner checks (currently raise `42501` for non-owner, added in migration 056) to household-membership checks, still raising `42501` for non-household callers.
- [x] Extend `scripts/sql/active-timer-authorization-tests.sql`: household member CAN release/pause another member's timer; outsider and unauthenticated still denied; starter path unchanged.
- [x] Remove client-side `.eq("started_by", userId)` filters in the active-timer service release/update paths (keep the param for logging).
- [x] Deterministic record-ID derivation from `timerInstanceId`, applied in ALL timer-stop record-creation paths (feeding, sleep, pumping, tummy time; own and remote stop), with unit tests proving two independent stops of the same timer instance yield the same ID.
- [x] `stopRemoteTimer`-style function per activity context: build stopper-owned record from lock data, save through the normal CRDT/sync path, release the lock.
- [x] Remote pause/resume wired through `toggle_timer_pause` from the dashboard card.
- [x] Starter-device external-lock-removal handling in each activity context: active local timer + lock gone → clear without saving; also on foreground timer restore, verify lock still exists before resuming.
- [x] Dashboard card: replace hourglass/disabled state with stop + pause controls for remote timers; keep caregiver attribution badge/text.
- [x] Extend `npm run e2e:household-timers` (two iOS accounts): A starts, B stops → one record (owned by B), A's timer clears; simultaneous stop → still one record.
- [x] Unit/integration tests per context for remote stop, clear-without-save, and replay convergence (pending offline mutation replays after remote stop → no second record).

## Human checkpoints

- [x] [confirm-security] Apply migration 065 server-first: widen active-timer UPDATE/DELETE and the release/pause RPCs to authenticated household members while strengthening the direct-update trigger so only the starter may change `started_at` and nobody may change timer identity. RPC signatures, INSERT, and acquisition stay unchanged; outsiders and unauthenticated callers remain denied (owner approved 2026-09-01).
- [ ] [confirm-db] Run the new migration against the shared Supabase project.
- [x] [decision] Mixed-version rollout: accept the transient duplicate risk from overlapping stops involving an older app during rollout. Do not add a `started_at` compatibility query: it is race-prone, can suppress legitimate records, adds a network dependency to stopping, and would revive the superseded duplicate-guard design (owner approved 2026-09-01).

## Review decisions

- skipped (minor): TR-11 — Remote stop omits own-stop duration and ordering guards — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-12 — Legacy queued release can delete a newer timer — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-13 — Baby switching can clear the newly selected baby's timer — owner limited this remediation pass to TR-1 through TR-10.
- accepted (security): TR-14 — Household timer data can carry forged pause timestamps — owner accepted the risk for this PR and limited remediation to TR-1 through TR-10.
- skipped (minor): TR-15 — Offline replay convergence lacks integration coverage — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-16 — E2E test asserts runner source text — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-17 — E2E duplicate check compares primary-key counts — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-18 — Remote pause test omits payload assertions — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-19 — Timer service failure logs omit acting caregiver — owner limited this remediation pass to TR-1 through TR-10.
- skipped (minor): TR-20 — Maestro runner can close its log descriptor twice — owner limited this remediation pass to TR-1 through TR-10.
- accepted (security): TR-21 — Authenticated users can self-assign a known household UUID — owner accepted the risk for this PR; deferred Task 0055 continues to track the pre-existing membership trust-boundary fix.

## Acceptance criteria

- [ ] SQL authorization suite passes: household member allowed, outsider denied, unauthenticated denied, for release and pause.
- [ ] Two-account E2E: B stops A's timer from the dashboard; exactly one record exists, owned by B; A's device shows no running timer and saved nothing.
- [ ] Simultaneous/replayed stops converge to exactly one record (deterministic-ID unit + integration tests green).
- [ ] B can pause and resume A's timer; state reflects on both devices.
- [ ] Starter stopping their own timer behaves exactly as before (regression: existing timer lifecycle and stop-provider tests green).
