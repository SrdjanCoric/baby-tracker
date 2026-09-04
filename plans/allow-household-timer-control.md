# Household Shared Timer Control

## Planning status
Ready for planning

All behavior, authorization, race-handling, and scope decisions are settled; remaining unknowns are implementation details discoverable during slicing.

> Supersedes the previous plan in this file (2025-era, pre-migration-056 design). Do not resurrect its mechanisms: its `releaseTimerLock`-return-value duplicate guard and `started_at` SELECT pre-check are replaced by deterministic record IDs; its migration numbering (039) is stale — repo is past 062.

## Problem and destination
When caregiver A starts a feeding/sleep/pumping/tummy-time timer, caregiver B in the same household sees it but cannot control it (hourglass, read-only). Destination: any household caregiver can stop, pause, and resume any timer for their baby from every surface — app, widget, Apple Watch — with exactly one activity record saved regardless of who stops or in what order devices sync.

## Current state
Verified against repo (2026-09-01):

- Timer starts already persist to `active_timers` (Supabase) with realtime replication; household members' devices already receive INSERT/DELETE events and display remote timers (`src/contexts/active-timers-context.tsx`, hourglass UI in `src/components/DashboardCard.tsx:505-518`).
- Single-owner control is enforced at five layers, all intentional:
  - RLS UPDATE/DELETE require `started_by = auth.uid()` (`supabase/migrations/020_add_active_timers.sql:48-55`)
  - `release_timer_lock` and `toggle_timer_pause` RPCs raise `42501` for non-owners (`supabase/migrations/056_authorize_active_timer_controls.sql:160-162, 240-242`)
  - Client filter `.eq("started_by", userId)` in `src/services/active-timer-service.ts` (releaseTimerLock ~line 309)
  - DashboardCard hides stop button when `isLockedByOther`
  - SQL authorization test suite asserts non-owner rejection (`scripts/sql/active-timer-authorization-tests.sql:641-653, 699-710`)
- Widget/Watch stop commands flow through a durable external command queue (`src/services/external-timer-command-service.ts`) into the same backend RPCs — no separate authorization path to widen.
- Watch already renders household-wide timers with `startedBy`/`isRemote` (`targets/watch/index.swift:90-93`); its stop would currently fail at the RPC.
- Silent APNS push already fires on `active_timers` INSERT/DELETE via `supabase/functions/send-widget-push`; push tokens tracked in `user_push_tokens`.
- Pause state lives in `timer_data` JSONB; changed only via `toggle_timer_pause`.
- Live Activity starts only on the starter's device (ActivityKit is device-local today).
- Offline conflict policy: LWW/CRDT with HLC timestamps and persistent offline queue (master plan).
- Wear OS is rolled back off main (`backup/wear-os-work` branch).

## Target behavior
- B sees A's running timer on dashboard, widget, and Watch with full controls: stop and pause/resume.
- B stopping saves the activity record immediately (visible in timeline), even if A is offline.
- A's device, on learning the timer ended remotely, clears local timer state without saving; A's still-ticking Live Activity is ended by an ActivityKit remote push even when A's app is backgrounded.
- Simultaneous or offline-replayed stops from multiple members converge to exactly one record.
- Offline behavior otherwise unchanged: last-write-wins as today; a member coming online sees the current timer state via realtime/refetch.

## Actors and permissions
- Actors: caregivers within one household; babies belong to the household.
- Authorization widening (user-approved in this discussion): UPDATE/DELETE on `active_timers`, and `release_timer_lock` / `toggle_timer_pause` RPCs, change from `started_by = auth.uid()` to household membership of the baby. INSERT policy and `acquire_timer_lock` unchanged — `started_by` still records the starter.
- Trust boundary: this is a deliberate RLS/RPC widening — security review required on the migration; SQL authorization test suite must be updated to assert household-member allow + outsider deny.

## Scenarios
### Happy path
A starts sleep timer on phone. B's dashboard/widget/Watch show it with stop + pause controls and "started by A" attribution. B taps stop; record saved by B, appears on both timelines; A's timer UI clears via realtime; A's Live Activity ends via push.

### Repeat use and idempotency
Stop is idempotent: record ID is derived deterministically from `timerInstanceId`, so a replayed or duplicate stop upserts/merges into the same row via existing LWW/CRDT — never a second record.

### Failure and retry
- Remote end-push (Live Activity) not delivered: A's Live Activity ends on next app foreground/realtime reconnect (existing restore logic verifies lock existence). Acceptable residual.
- RPC failure on B's stop: existing durable command queue retry (widget/Watch) and pending-mutation retry (app) apply unchanged.

### Cancellation, resume, and cleanup
- Pause/resume by any member goes through the widened `toggle_timer_pause`; pause state syncs via realtime as today.
- A's device detecting its lock vanished (stopped remotely): clear AsyncStorage timer state, dispatch stop, save nothing.
- 12-hour stale-lock cleanup unchanged.

### Relevant edge cases
- **Race / offline replay**: A stops offline (queued), B stops online. Both devices eventually write; deterministic ID makes second write merge into the first via LWW. Loser's field values may overwrite by timestamp — accepted as harmless.
- **Detail-poor remote stop**: B stopping A's breastfeeding timer can only build a basic record from lock data (start, end, type — no per-side breakdown). Accepted.
- **Mixed app versions during rollout**: old-version A device still saves on stop with its own record ID. Deterministic-ID dedup only protects new-version writers; rollout scenario needs a migration/compat note during slicing (see Unresolved checkpoints).
- **iOS < 17.2** (fast-follow only): no push-to-start Live Activity; app/widget/Watch still work.

## Decisions
### Shared control scope
- **Decision**: Any household member can stop AND pause/resume any timer.
- **Reason**: Symmetric UX; one authorization widening covers both.
- **Important alternatives**: Stop-only — rejected as asymmetric UX for little saved work.
- **Consequences**: Both `release_timer_lock` and `toggle_timer_pause` widen; UI shows full controls on remote timers.

### Record attribution
- **Decision**: The stopper owns the saved record ("they logged it").
- **Reason**: User preference; also simplest — the saving device saves as itself.
- **Important alternatives**: Starter-as-caregiver with `stopped_by` metadata — initially chosen, then reversed by user.
- **Consequences**: Per-caregiver statistics attribute the activity to whoever stopped, not who performed it. No metadata field needed.

### Duplicate prevention
- **Decision**: Deterministic record ID derived from `timerInstanceId`; concurrent/replayed saves converge via existing LWW/CRDT merge.
- **Reason**: Duplicate impossible by construction; no winner-detection edge-case code; fits existing sync architecture.
- **Important alternatives**: Winner-writes gated on `release_timer_lock` return (needs replay guard anyway); server-side record creation inside the RPC (big refactor out of client CRDT path, stop-time data would have to pass through RPC). Both rejected.
- **Consequences**: All stop paths (own and remote, app/widget/Watch) must derive the record ID the same way (e.g., UUIDv5 of timerInstanceId — exact scheme chosen during slicing).

### Live Activity remote end (v1)
- **Decision**: End A's Live Activity via ActivityKit remote push (per-activity push token), extending the existing `send-widget-push` edge function on `active_timers` DELETE.
- **Reason**: Correct, reliable mechanism; infra exists.
- **Important alternatives**: Best-effort silent push wake — rejected (no delivery guarantee, stale ticking timer).
- **Consequences**: Live Activity push token must sync to backend; edge function gains a `liveactivity` push type.

### Live Activity push-to-start (fast-follow, not v1)
- **Decision**: Mirroring A's timer as a Live Activity on B's device via ActivityKit push-to-start (iOS 17.2+) is a separate fast-follow task (~3 days).
- **Reason**: Keeps v1 slice small and provable; push-to-start has its own token type (`pushToStartTokenUpdates`), update-token round-trip for later end, and real-device-only testing.
- **Important alternatives**: Include in v1 — rejected for PR size.
- **Consequences**: v1's end-push design should not preclude ending remotely-started activities later.

### Offline policy
- **Decision**: Unchanged — last-write-wins as today; no offline coordination attempted.
- **Reason**: User directive; no sound way to coordinate offline.
- **Important alternatives**: None recorded.
- **Consequences**: Timer appearing to others only once starter is online is accepted behavior.

## Domain language
- **Timer lock / active timer**: row in `active_timers`, unique per (baby, activity_type); `started_by` = starter, now informational for control purposes.
- **Remote timer**: an active timer whose `started_by` is not the local user (`isRemote` / `isLockedByOther`), now controllable, still attributed visually.
- **timerInstanceId**: stable identity of one timer run; seed for the deterministic record ID.

## State and external dependencies
- `active_timers` schema unchanged; only policies/RPCs widen (new migration, next free number).
- Activity records (feedings/sleeps/pumpings/tummy_times): no schema change expected; record ID becomes deterministic for timer-produced records.
- APNS: existing widget silent push plus new ActivityKit end-push; per-activity Live Activity push tokens stored server-side (table or extension of `user_push_tokens` — decided during slicing).
- Wear OS: out of scope (off main).

## Interfaces and seams
- `release_timer_lock(baby_id, activity_type, user_id)` / `toggle_timer_pause(...)`: signatures unchanged; authorization semantics change from owner to household member. `42501` still raised for non-household callers.
- External command queue (`ExternalTimerCommand`): unchanged shape; commands for remote timers now succeed.
- Contexts (feeding/sleep/pumping/tummyTime): gain remote-stop capability and external-lock-removal detection (clear-without-save).
- `send-widget-push` edge function: gains Live Activity end-push branch on DELETE.
- Invariant: every stop path converges on one deterministic record per timerInstanceId.

## Testing decisions
- **Observable behaviors**: cross-member stop/pause from app, widget command path, Watch command path; single record under stop races and offline replay; starter's device clears without saving; Live Activity ends on remote stop; non-household caller still rejected.
- **Primary seams**: SQL authorization suite (`scripts/sql/active-timer-authorization-tests.sql`) for policy/RPC widening; `src/__tests__/external-timer-stop-providers.integration.test.tsx` for widget/Watch/app stop providers; context unit tests for remote-stop and lock-removal clearing.
- **Existing precedent**: `npm run e2e:household-timers` (two iOS accounts) already covers ownership/unlock propagation — extend for cross-member stop.
- **Highest-level proof**: two-account E2E — A starts, B stops (app and widget), one record, A clears.
- **Manual proof**: Live Activity end-push and (fast-follow) push-to-start require real devices — simulator cannot receive ActivityKit pushes. Two-device manual pass: A starts, backgrounds; B stops; A's Live Activity ends.

## Security and data checkpoints
- RLS/RPC widening from owner to household is user-approved (this discussion) but must go through security review and updated SQL authorization tests (household allow / outsider deny / unauthenticated deny).
- No destructive data migration.

## Out of scope
- Offline coordination or conflict UX beyond existing LWW.
- Live Activity push-to-start mirroring (fast-follow task).
- Wear OS surfaces.
- Editing/enriching a basic remote-stop record with the starter's local detail after the fact.

## Research evidence
- ActivityKit remote push (end/update via per-activity push token) and push-to-start (iOS 17.2+, `pushToStartTokenUpdates`) — Apple ActivityKit documentation; asserted from model knowledge, verify exact payload (`apns-push-type: liveactivity`, `event: start|end`) against current Apple docs during the fast-follow task.
- All other claims verified in-repo (pointers in Current state).

## Unresolved checkpoints
- None blocking. During slicing decide: exact deterministic-ID scheme (UUIDv5 namespace + timerInstanceId recommended) and the mixed-version rollout note (old clients save with random IDs; deterministic dedup only protects updated clients — decide whether a `started_at`-based compat guard is worth carrying temporarily).

## Planning constraints
- Slice order: (1) migration + SQL auth tests (security-reviewed), (2) service/context/UI remote stop + clear-without-save + deterministic ID, (3) widget + Watch enablement, (4) Live Activity end-push, then fast-follow push-to-start task.
- Each slice independently verifiable; E2E extension lands with slice 2 or 3.
- High priority: defer other planned tasks (user directive, 2026-09-01).

## Source coverage
- This planning conversation (2026-09-01) — all decisions.
- Repository reconnaissance digests (migrations 020/056/062, active-timer service/contexts, widget/Watch code, send-widget-push, master plan CRDT sections).
- Prior version of this file (superseded design, retained only via the note above).
