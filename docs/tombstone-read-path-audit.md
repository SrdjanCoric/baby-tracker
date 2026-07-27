# Tombstone read-path audit (Task 0005)

Deletes for the 9 CRDT tables (`feedings`, `sleep_sessions`, `diapers`, `pumping_sessions`,
`growth_measurements`, `tummy_time_sessions`, `health_entries`, `milestone_responses`, `babies`)
are now tombstones: a `deleted: true` field write merged through `merge_record`, landing as an
UPDATE rather than a hard `DELETE`. User-facing reads must exclude `deleted = true` rows; milestone
sync persistence retains them internally to preserve stable response identity. This is the audit of
every read path and its status.

## Write / delete paths (now tombstones, not hard deletes)

| Path | File | Status |
|------|------|--------|
| Queued delete (all 9) | `sync-engine.ts` `stampOperation` / `executeOperation` | ✅ stamps `{deleted:true}`, pushes via `merge_record` |
| Direct-write fallback delete | `activity-sync-service.ts` `writeDirectlyToDatabase` | ✅ CRDT `DELETE` → `mergeRecordWrite(table, id, {deleted:true})` |
| Baby delete | `baby-sync-service.ts` `deleteBabyFromDatabase` | ✅ `mergeRecordWrite("babies", id, {deleted:true})` |
| Legacy unstamped delete (pre-tombstone queued op, `data===null`) | `sync-engine.ts:executeOperation` DELETE arm | ⚠️ intentionally falls through to hard delete — "never worse" for old queued ops |
| Non-CRDT delete arm | `activity-sync-service.ts:writeDirectlyToDatabase` switch | ⚠️ unreachable for the 9 tables (guarded by `isCrdtTable`); retained for non-CRDT callers |
| Tombstone delete of a row the server never saw | `merge_record` (migration 054) | ✅ no-op (`RETURN NULL`) instead of raising `<key> is required to insert` — matches the old hard-delete-of-missing-row semantics, so the op isn't quarantined |
| Milestone response revival and alternate-ID recovery | `merge_record` (migration 057) | ✅ serializes by `(baby_id, milestone_id)` and redirects a queued alternate UUID to the canonical row without weakening household authorization |

## Client DB reads (the choke point)

The only code that reads these tables from Supabase. Each filters tombstones **after**
`reconcilePulled` (so tombstone clocks still fold into the local HLC/shadow — required for
offline convergence) and **before** building the stored list, via `dropTombstoned()` (activity)
or an inline `deleted !== true` filter (babies).

| Fetch | File | Status |
|-------|------|--------|
| `fetchFeedingsFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchDiapersFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchSleepFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchPumpingFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchGrowthFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchTummyTimeFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchMilestoneResponsesFromDatabase` | `activity-sync-service.ts` | ✅ retains tombstones only in milestone persistence so the canonical `(baby_id, milestone_id)` row can be revived; context selectors hide them |
| `fetchHealthFromDatabase` | `activity-sync-service.ts` | ✅ `dropTombstoned` |
| `fetchAndSyncHouseholdBabies` | `baby-sync-service.ts` | ✅ `deleted !== true` filter |

Tested: `activity-sync-tombstone.test.ts` (seven filtered activity types plus milestone
retention), `baby-sync-service.test.ts` (babies).

## Receive-side (Realtime)

A tombstone arrives as a Realtime UPDATE carrying `deleted: true`. Translation is centralized in
`tombstonedId(change)` and wired into all 9 context subscriptions; the record is removed via the
existing `REMOTE_DELETE` reducer path. An un-delete/restore arrives as an UPDATE with
`deleted: false` for a previously-hidden record — `REMOTE_UPDATE` reducers now `upsertById` so the
record is re-added rather than dropped.

| Context | Status |
|---------|--------|
| feeding, diaper, sleep, pumping, growth, tummyTime, health, baby | ✅ `tombstonedId` + `upsertById` |
| milestones | ✅ persists Realtime tombstones, retains them as hidden context state, and deduplicates live responses by `milestoneId`, preserving the canonical row ID for recheck and restart |

Tested: `tombstone.test.ts` (translation + upsert), `crdt-simulation.test.ts` (delete-vs-edit and
restore convergence, both orderings).

## Downstream in-memory consumers (inherit filtering from the choke point)

For eight activity types, a tombstone is **never written to local storage or context state**: a
local delete removes the row optimistically, a pulled tombstone is dropped by `dropTombstoned`
before persistence, and the corresponding `Stored*` types carry no `deleted` field.

Milestones are the deliberate exception. `(baby_id, milestone_id)` has one stable response row, so
`StoredMilestoneResponse` retains its `deleted` flag and canonical UUID across clear, pull,
Realtime, and restart. `MilestonesProvider` exposes only live responses and every state/progress
selector filters `deleted=true`. Rechecking writes `deleted=false` with a new HLC. If an older app
already queued a create under another UUID, pull recovery compares the queued and canonical HLCs,
then durably queues a canonical revival only when the selection is newer. Migration 057
acknowledges the alternate operation against the same canonical row, leaving one active response,
no retry loop, and no regression of a newer caregiver clear.

- `export-service.ts` — reads local AsyncStorage (`FeedingStorageService.getAllFeedings(babyId)`
  etc.), then filters by date. Activity storage holds only live rows, while milestones are not part
  of activity export.
- `duplicate-detection.ts` — pure functions over passed-in `Stored*` arrays (no `deleted` field).
- Stats/timeline/sleep-pattern components — consume context state (tombstone-free).
- `widget-data-service.ts` — builds the widget blob from context state.
- `watch-service.ts` — forwards context-derived objects; no DB reads.

## Server-side reads

| Path | Reads the 9 tables? | Status |
|------|---------------------|--------|
| `send-activity-notification` (edge fn) | No (reads `babies`/`users`/tokens) | ✅ invoked by an out-of-repo Supabase Database Webhook (migration 012 dropped the old `AFTER INSERT` triggers), so it now has a code-level guard: `if (record.deleted === true) return 200` — never pushes for a tombstone regardless of webhook config |
| `check-feeding-reminders` (edge fn) | No — reads `babies.last_fed_at` denorm | ✅ `last_fed_at` is monotonic (GREATEST on INSERT); never recomputed on delete, pre- or post-tombstone → unchanged |
| `get_due_wake_window_reminders` (RPC) | Yes — night-sleep + nap CTEs read `sleep_sessions` | ✅ migration 053 adds `deleted = false` to both CTEs |
| `update_baby_last_sleep_ended_at` (trigger/denorm) | Yes — recomputes `MAX(ended_at)` | ✅ migration 053: fires on `UPDATE OF deleted`, recompute filters `deleted = false` |
| `send-widget-push` (edge fn) | Reads `babies` by id for routing | ➖ reads a single baby for push routing, not activity lists; baby tombstones are rare and out of the reminder blast radius |
| Widget Swift REST (`targets/widget/index.swift`) | No — reads only `active_timers` | ✅ not in scope |
| Apple Watch (`watch-service.ts`) | No DB reads | ✅ not in scope |

Tested: `scripts/sql/tombstone-reminder-tests.sql` (denorm recompute + RPC nap count exclude
tombstones), run by `npm run test:sql`.

## Verified on-device ([verify])

Swift widget timeline and Watch app read paths are outside TypeScript coverage — confirmed by the
task's manual `[verify]` step (delete an entry, confirm it disappears from widget + watch after
refresh).
