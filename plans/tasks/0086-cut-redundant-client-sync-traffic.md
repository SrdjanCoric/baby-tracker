# Task 0086: Cut redundant client sync traffic

**Branch**: `feature/cut-redundant-client-sync-traffic`
**Depends on**: none
**Source**: Production incident diagnosis, 2026-08-12; review findings incorporated the same day ·
**User stories**: a caregiver logging an activity does not cause every household device to
re-download the family's full history; the app stays within the backend's request and disk-I/O
budget as the user base grows

## What to build

Production API-gateway logs and `pg_stat` data (2026-08-12, ~190K requests/day at 200 users, with a
Supabase disk-I/O budget warning) showed that most REST traffic is redundant. One app-open or one
logged activity produces repeated ~16-request full-refetch bursts across household devices, even
though the realtime channel already delivers the changed row. Four verified causes, fixed together
as one behavior: **an activity change reaches other devices as a single row delta, and a device
catch-up costs a handful of tiny cursor queries instead of eight full-table pulls.**

Table scope, fixed precisely: the CRDT sync set is **eight activity tables** — `feedings`,
`sleep_sessions`, `diapers`, `pumping_sessions`, `growth_measurements`, `tummy_time_sessions`,
`health_entries`, `milestone_responses` — plus `babies` (see `CRDT_TABLES`). `achievements` is
outside the cursor design: it has neither `updated_at` nor soft tombstones, and it does not
participate in the foreground refresh cascade. It keeps its current fetch shape.

1. **`selectedBaby` reference churn defeats the existing delta path.** Feeding inserts and
   qualifying sleep mutations fire database triggers that update `babies.last_fed_at` /
   `babies.last_sleep_ended_at`, which broadcasts a realtime `babies` UPDATE to the whole
   household. The baby context's `REMOTE_UPDATE` handler always replaces the selected-baby object,
   which changes the identity of every activity context's load callback, which re-runs every load
   effect: eight full-table refetches plus timer probes (~16 requests) per device per qualifying
   event. Fix — **reducer no-op**: the reducer skips the state replacement when the transformed
   baby is deep-equal to the current one, keeping `selectedBaby` referentially stable. (Keying
   load effects on the baby id alone is not equivalent and is not the chosen approach; the
   checklist requires referential stability.) Genuine baby edits (name, birth date) must still
   propagate. Do **not** add a generic `updated_at` bump trigger to `babies` — derived-timestamp
   updates would then always change `updated_at` and defeat the deep-equality check.

2. **Redundant per-type `active_timers` queries.** The active-timers provider fetches all timers
   for the selected baby in one unfiltered query (`getActiveTimersForBaby`), while the
   per-activity restore paths (timer lifecycle, timer-lock reconciliation) each issue a
   `.single()` query per activity type through `getActiveTimerLock`, producing constant 406
   responses when no timer exists. Because the providers load concurrently, reading current
   context state can race the shared query; instead introduce an **awaited, baby-keyed
   single-flight fetch** whose resolved snapshot all restore paths share — one `active_timers`
   request per burst. Callers where eliminating the query is unsafe (pending retries, race-safe
   release checks) keep `getActiveTimerLock`, but its fetch switches from `.single()` to
   `.maybeSingle()` so a missing row returns empty 200 instead of 406.

3. **Duplicate and unsafe foreground refresh.** The sync context bumps `foregroundRefreshKey` both
   on the AppState background→active transition and on the offline→online transition; a phone
   wake fires both, doubling the burst. A naive time-window throttle is not acceptable: if the
   app wakes offline and connectivity returns inside the window, suppressing the second pass
   would skip the catch-up that recovers events missed while offline (realtime does not replay
   them). Build a small **refresh coordinator** with a completion promise: it coalesces
   concurrent triggers into one in-flight pass that late triggers await, and it guarantees that
   an **online** catch-up runs for each wake cycle — a pass that ran offline does not satisfy the
   cycle, so a subsequent offline→online transition still runs one. A wake cycle whose online
   pass already succeeded runs nothing further.

   Completion must be real, not assumed: a bare `foregroundRefreshKey` bump is fire-and-forget
   and cannot tell the coordinator when — or whether — the providers finished. Invert control:
   each activity provider **registers its loader** with the coordinator, the coordinator invokes
   the registered loaders itself and settles them together (`Promise.allSettled` semantics). The
   pass's completion promise resolves when every loader has settled, and the wake cycle counts as
   satisfied **only if every loader succeeded**; any loader failure leaves the cycle unsatisfied
   so the next trigger retries. Without this, coalescing is fiction (an instantly-resolved
   promise joins nothing) or the cycle is marked satisfied over partial failures, silently
   suppressing catch-up for the failed tables until the next wake.

4. **Full-table catch-up pulls.** The eight activity fetchers issue `select("*")` with
   `limit 1000` and no incremental filter on every load. Introduce a per-table-per-baby cursor
   persisted locally. The cursor is **composite `(updated_at, id)`**, because `now()` is
   transaction-stable and multiple rows can share a timestamp; a timestamp-only cursor can skip
   rows. Catch-up queries order by `updated_at, id` ascending and continue lexicographically
   (`updated_at > c.ts OR (updated_at = c.ts AND id > c.id)`); the cursor advances to the raw
   server page boundary and **only after reconciliation and local persistence succeed**. Deletes
   are soft tombstones (`deleted = true` bumps `updated_at`), so they flow through the cursor and
   the existing `reconcilePulled` CRDT merge handles them. A previously visited baby **retains
   its cursor across baby switches**; a missing or deliberately invalidated cursor triggers
   bootstrap, never a silent single page.

   **Bootstrap must be a one-time fully paginated crawl, not one page.** Migration 064 backfills
   `updated_at` on the four newly-columned tables with a single value, so after upgrade every
   pre-existing row shares one timestamp; a bootstrap that stops after the first 1,000-row page
   would set the cursor past rows it never fetched, and any edit or tombstone that landed on
   those rows between the device's last legacy sync and the upgrade would be skipped
   **permanently** — stale or deleted entries surviving on one household device with no error and
   no repro trail. Bootstrap therefore pages with the same composite continuation until a short
   page, and only then installs the cursor. The existing paginated range-loader pattern already
   demonstrates the loop shape. Cursor state failing to persist mid-bootstrap must resume or
   restart the crawl, never install a partial cursor.

   Schema prerequisites (migration 064), scoped to the eight activity tables:
   - `diapers`, `pumping_sessions`, `growth_measurements`, and `tummy_time_sessions` have **no
     `updated_at` column today** — add `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` to those
     four, and correct their database transformers to read `data.updated_at` instead of
     fabricating it from `created_at` or the current time.
   - Audit that every server write path bumps `updated_at`, including the `merge_record` RPC and
     direct PostgREST updates; add `BEFORE UPDATE` triggers enforcing it on all eight tables
     (not on `babies` — see item 1).
   - Add `(baby_id, updated_at, id)` indexes to the eight tables so cursor queries are index
     scans. Without these, the cursor query re-creates the disk-I/O problem.

Also land in this task: commit the already-written migration
`supabase/migrations/063_bound_wake_window_reminder_scans.sql` (time-bounds the
`get_due_wake_window_reminders()` scans and adds three `sleep_sessions` indexes). It was applied to
production via the SQL editor as an emergency hotfix on 2026-08-12 and must exist in the repo so
local and CI schemas match production.

Out of scope, deliberately: the Watch 30-second `active_timers` poll (owner excluded it), realtime
WAL-poller cost, any watch/widget credential work (separate branch in flight), and any change to
`achievements` sync.

## Implementation work

- [ ] Test-first: a simulated realtime `babies` UPDATE carrying only derived-timestamp changes
      leaves `selectedBaby` referentially stable and triggers zero activity-context refetches; a
      genuine baby edit (name, birth date) still propagates.
- [ ] Implement the reducer deep-equal no-op in the baby context.
- [ ] Test-first: concurrent timer restore across all four activity types performs exactly one
      `active_timers` fetch via the awaited baby-keyed single-flight snapshot, with no race
      between the providers; restore behavior (own running timer resumes, other-user timer
      displayed, no timer clears state) is unchanged; remaining `getActiveTimerLock` callers
      return empty results without 406 (`.maybeSingle()`).
- [ ] Implement the single-flight timer snapshot and the `.maybeSingle()` fallback.
- [ ] Test-first for the refresh coordinator: AppState wake plus offline→online coalesce into one
      pass when the first pass ran online; a wake whose first pass ran offline still gets exactly
      one online catch-up when connectivity returns; late triggers await the in-flight pass's
      completion promise rather than starting another; the completion promise resolves only after
      every registered loader settles; a pass in which any loader fails leaves the wake cycle
      unsatisfied and the next trigger retries.
- [ ] Implement the refresh coordinator in the sync context with provider loader registration,
      replacing the bare `foregroundRefreshKey` bumps.
- [ ] Migration 064: add `updated_at` to the four tables lacking it, add enforcing
      `BEFORE UPDATE` triggers to all eight activity tables, add `(baby_id, updated_at, id)`
      indexes; SQL vector tests prove `merge_record` and direct updates bump `updated_at` on all
      eight tables and that the cursor query plan uses the new index (`EXPLAIN`).
- [ ] Correct the four transformers to read `data.updated_at`.
- [ ] Test-first for cursor catch-up: composite `(updated_at, id)` continuation returns every row
      across pages of more than 1,000 changes, including batches where many rows share one
      `updated_at`; tombstones apply; the cursor advances only after reconciliation and local
      persistence succeed; a revisited baby reuses its stored cursor; offline round-trip and CRDT
      merge tests stay green.
- [ ] Test-first for bootstrap: an existing installation with more than 1,000 rows — all sharing
      the migration-064 backfill timestamp — and an old tombstone outside the first page ends the
      crawl with every row and the tombstone applied locally, and the cursor installed only after
      the final short page; an interrupted bootstrap does not install a partial cursor and
      resumes or restarts on the next pass.
- [ ] Implement the cursor store and switch the eight activity fetchers to cursor catch-up.
- [ ] Commit migration 063 unchanged.
- [ ] Run `npm run test:sync`, `npm run test:unit`, `npm run test:component`, and the SQL vector
      suite (`npm run test:sql:setup && npm run test:sql`); finish with `npm run check`.

## Human checkpoints

- [ ] [confirm-db] Apply migrations 063 (already live in production via SQL-editor hotfix —
      confirm repo copy matches what was executed) and 064 (four `updated_at` columns,
      `BEFORE UPDATE` triggers on eight tables, eight `(baby_id, updated_at, id)` indexes) to the
      hosted database.
- [ ] [verify] After the release ships, watch the production API gateway for ten minutes of normal
      traffic · Expected: one refetch burst per app-open at most, zero 406 `active_timers`
      responses, catch-up queries carrying composite-cursor filters, and a materially lower
      request rate · Failure: repeated bursts from a single device within seconds, per-type 406s,
      or unfiltered `select=*` catch-up queries from devices with a stored cursor · Reason:
      request-volume behavior of the released build under real multi-device traffic cannot be
      reproduced by automated tests.

## Acceptance criteria

- [ ] A logged activity on one device updates other household devices through the realtime row
      delta alone — no full-table refetch burst appears in the gateway log.
- [ ] One app-open produces at most one online catch-up pass; an app that woke offline still
      catches up exactly once when connectivity returns; a pass with any failed loader leaves the
      wake cycle unsatisfied and is retried on the next trigger.
- [ ] Catch-up queries use the composite `(updated_at, id)` cursor except during bootstrap; a
      revisited baby reuses its cursor; a device without a cursor completes a fully paginated
      bootstrap (proven against >1,000 same-timestamp rows with an out-of-page tombstone) before
      any cursor is installed.
- [ ] `active_timers` restore issues exactly one query per burst; no 406 responses remain from
      timer reads.
- [ ] All eight activity tables have `updated_at`, enforcing triggers, and
      `(baby_id, updated_at, id)` indexes; SQL vector tests prove every write path bumps
      `updated_at` and `EXPLAIN` shows index scans for cursor queries; `babies` has no generic
      `updated_at` trigger.
- [ ] The four previously-fabricating transformers read `data.updated_at`.
- [ ] Migrations 063 and 064 are committed; local reset (`npm run test:sql:setup`) applies them
      cleanly.
- [ ] `npm run check` passes.

## Review decisions

- skipped (minor): TR-19 — The sync-context wiring of the refresh coordinator has no test — user limited this pass to TR-1–TR-18.
- skipped (minor): TR-20 — Stale `useSync` mocks plus optional registration skip loader coverage — user limited this pass to TR-1–TR-18.
- skipped (minor): TR-21 — Activity-history startup-pull documentation contradicts the implementation — user limited this pass to TR-1–TR-18.
- skipped (minor): TR-22 — Duplicate coordinator join branches can spawn redundant failure retries — user limited this pass to TR-1–TR-18.
- skipped (minor): TR-23 — Single-flight cleanup and per-baby keying lack direct tests — user limited this pass to TR-1–TR-18.
