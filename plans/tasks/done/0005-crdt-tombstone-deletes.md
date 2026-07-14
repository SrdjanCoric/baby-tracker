# Task 0005: Tombstone deletes + read-path audit

**Branch**: `feature/crdt-tombstone-deletes`
**Depends on**: 0004 (delete must flow through the stamp/merge path)
**Source**: talk-it-through 2026-07-04 (CRDT conflict resolution) · **User stories**: "As a caregiver, deleting an entry while my partner edits it offline resolves deterministically — whoever acted later wins — instead of the entry resurrecting or the edit vanishing"

## What to build

Convert hard deletes to CRDT tombstones for the 9 in-scope tables, and sweep every read path so
tombstoned rows never surface. Per the master plan: `deleted` is an ordinary LWW field — delete is
a field write (`deleted: true` with a fresh HLC) flowing through the same stamp → RPC → merge path
as any edit; no special cases in the merge; un-delete is the same mechanism in reverse (mechanism
only — no undo UI in this slice).

The blast radius is the read side. Every consumer of these tables must filter `deleted = false`:
- App: contexts' load/fetch paths, timeline, stats/charts, duplicate detection, export service
- Server: edge functions that read activities (feeding reminders, wake-window reminders, activity
  notifications, widget push payload assembly)
- Extensions: the iOS widget's Supabase REST reads and the Watch direct-REST fallback

Remote `DELETE` handling changes shape: deletes now arrive as Realtime UPDATE events with
`deleted: true`, which the receive path must translate to the contexts' existing removal behavior
(`REMOTE_DELETE`-equivalent) so UI code stays unchanged.

## AFK tasks

- [x] TDD the delete flow: deleting a record produces a `deleted: true` field write with a fresh
      clock through the standard sync path; local state hides it immediately (optimistic)
- [x] TDD conflict semantics via the replica simulation: delete-vs-edit races converge to
      later-clock-wins on all replicas, both orderings
- [x] TDD receive-side translation: an incoming row with `deleted: true` removes the record from
      context state; `deleted: false` on a locally-hidden record restores it
- [x] Enumerate every read path (grep-driven audit across app, edge functions, widget Swift REST
      queries, Watch service) and apply the tombstone filter; add the shared test vectors for
      tombstone merges to both TS and SQL vector runs if not already present from 0002/0003
- [x] Update the export service so exports exclude tombstoned rows
- [x] Verify stats/aggregation queries and duplicate detection ignore tombstoned rows via unit
      tests with seeded deleted entries

## Human-in-the-loop tasks

- [ ] [verify] On a real device with a dev build: delete an entry, then confirm the iOS widget
      timeline and Watch app no longer show it after refresh — the Swift extension read paths are
      outside TypeScript test coverage

## Acceptance criteria

- [x] No hard `DELETE` remains for the 9 in-scope tables in app code or edge functions
      (remaining `.delete()` calls are guarded by `isCrdtTable` and only reachable for non-CRDT
      tables or legacy unstamped ops — "never worse")
- [x] Delete-vs-edit convergence proven in the replica simulation and in the shared TS/SQL vectors
- [x] Audit checklist of read paths committed with the PR (each path listed and marked filtered)
- [x] Reminders/notification edge functions never fire for tombstoned activities (unit-tested with
      seeded data)
- [ ] Full test suite, typecheck, and lint pass; widget/Watch `[verify]` confirmed
      (AFK gates green; widget/Watch `[verify]` pending manual confirmation)

## Implementation log

Server-side tombstone support already shipped in task 0003 (migration 052: `deleted` columns,
partial indexes, `merge_record` treats `deleted` as an ordinary LWW field), so this task was
**client-side plus a wake-window SQL read-path fix**.

**Send side (deletes → tombstones):**
- `sync-engine.ts` — `stampOperation` turns a CRDT `DELETE` into a stamped `{deleted:true}` write;
  `executeOperation` routes it through `merge_record`. A legacy unstamped delete (`data===null`)
  falls through to the old hard delete ("never worse" for pre-tombstone queued ops).
- `activity-sync-service.ts` — direct-write fallback `DELETE` → `mergeRecordWrite(table,id,{deleted:true})`.
- `baby-sync-service.ts` — `deleteBabyFromDatabase` → `mergeRecordWrite("babies",id,{deleted:true})`.

**Read filters (choke point):** `dropTombstoned()` after `reconcilePulled` in all 8 activity
fetches + `deleted !== true` filter in the baby fetch. Filtering is post-reconcile so tombstone
clocks still fold into the local shadow (offline convergence).

**Receive side:** new pure helpers `tombstonedId` + `upsertById` (`src/services/sync/tombstone.ts`),
wired into all 9 context subscriptions; `REMOTE_UPDATE` reducers now upsert so a restore re-adds a
hidden record.

**Server SQL (migration 053):** wake-window reminders read `sleep_sessions` directly — the
`get_due_wake_window_reminders` CTEs and the `update_baby_last_sleep_ended_at` denorm trigger now
filter `deleted = false`, and the trigger fires on `UPDATE OF deleted` so deleting the latest sleep
recomputes. Feeding reminders unaffected (`last_fed_at` is monotonic, never recomputed on delete).
`send-activity-notification` fires `AFTER INSERT` only, so tombstone UPDATEs never trigger it.

**Tests:** `sync-engine-crdt.test.ts` (tombstone push), `baby-sync-service.test.ts` (baby delete +
pull filter), `activity-sync-tombstone.test.ts` (8-table fetch filter, seeded deleted rows),
`tombstone.test.ts` (translation + upsert), `crdt-simulation.test.ts` (delete-vs-edit both
orderings + restore), `scripts/sql/tombstone-reminder-tests.sql` (denorm recompute + RPC nap count).
Read-path audit: `docs/tombstone-read-path-audit.md`.

Results: unit 2179 pass, typecheck clean, lint clean (2 pre-existing warnings in baby-context),
component 517 pass (1 suite env-blocked by missing Supabase env vars — pre-existing), SQL suite
green including the tombstone reminder + missing-row no-op assertions.

**Review-fix round (task-review panel, `reviews/0005-...-review.md`):**
- Migration 054: `merge_record` no-ops (`RETURN NULL`) a tombstone delete of a row that never
  reached the server (no existing row + no ownership key + `deleted:true`), instead of raising
  `<key> is required to insert` and quarantining the op. SQL assertion #11 added.
- `send-activity-notification`: added `if (record.deleted === true) return 200` guard — migration
  012 moved these off DB triggers to an out-of-repo Database Webhook, so the guard enforces
  no-push-on-tombstone in code regardless of webhook config.
- `dropTombstoned` hoisted to `tombstone.ts` (shared by activity-sync + baby-sync) with a test.
- Audit doc corrected (export reads AsyncStorage; downstream tombstone-unrepresentable rationale).
- Re-review: Bug/Spec clean; Security one nit (pre-existing existence oracle, not worsened).
- Deferred (argued in review): guest direct-write DELETE swallow (consistent with CREATE/UPDATE
  best-effort), context-wiring reducer test (RN can't import under vitest — pure helpers tested).
