# Task 0004: Wire the sync engine to the CRDT merge

**Branch**: `feature/crdt-sync-wiring`
**Depends on**: 0002, 0003
**Source**: talk-it-through 2026-07-04 (CRDT conflict resolution) · **User stories**: "As two caregivers editing the same entry — one offline — we both end up seeing the same merged result, with neither edit lost"

## What to build

Connect the client CRDT module (0002) and the server RPC (0003) into the live sync path, replacing
the clobbering writes. This is the slice where the reported conflict bugs actually die. Three touch
points, all in the sync layer — contexts keep dispatching the same actions and learn nothing new:

1. **Stamp on save**: when an activity/baby/milestone record is created or edited, the sync layer
   calls `stampChanges(prev, next)` before local persist and queue push. Centralized in the
   storage/sync-service save paths, not per-context.
2. **Push via merge RPC**: the sync engine's push path and the activity sync service's per-type
   upserts stop calling raw insert/update/upsert for the 9 in-scope tables and call the merge RPC
   instead, sending the record with its `field_clocks`. Offline-queue entries carry the clocks;
   queue retry logic is unchanged.
3. **Merge on receive**: incoming Realtime events (and rows fetched by foreground pull) are merged
   against the local copy via the pure `merge` before dispatching `REMOTE_UPDATE`/`REMOTE_INSERT`
   — no more blind overwrite of local state. The HLC `receive()` is fed every remote clock so local
   causality is maintained. Existing echo filtering and push-before-pull foreground ordering are
   preserved.

Out of scope here: delete flows stay hard deletes (task 0005 converts them to tombstones).

## AFK tasks

- [x] TDD stamp-on-save: every save path for the 9 record types produces correct per-field clocks
      (only changed fields re-stamped), including first-create (all fields stamped)
- [x] TDD the push path: sync engine and activity sync service call the merge RPC with clocks for
      in-scope tables; out-of-scope tables (timers, tokens, goals) keep their existing paths
- [x] TDD merge-on-receive: a Realtime UPDATE older per-field than local optimistic state does not
      regress local fields; a newer one wins; mixed wins merge field-wise
- [x] TDD the offline queue round-trip: queued entries preserve clocks across app restart and
      flush through the RPC in order
- [x] Extend the replica simulation from task 0002 to drive the real sync-layer entry points
      (with Supabase mocked at the RPC boundary) and assert convergence for the originally
      reported conflict scenario: offline edit vs concurrent remote edit of the same record
- [x] Update edge functions and widget/Watch REST write paths that write to in-scope tables to use
      the merge RPC (audit all writers, not just the primary app flow — per the project's
      cross-cutting-feature lesson) — audit found **no** in-scope writes there (edge functions only
      read `babies`; widget/Watch write no in-scope tables), so no-op; documented.

## Human-in-the-loop tasks

- [ ] [verify] Two real devices in one household: edit the same feeding's different fields while
      one device is offline, reconnect, confirm both devices converge to the merged entry — live
      Supabase Realtime + the mixed-version RPC path cannot run in CI (project decision: no new
      E2E for conflicts) — **DEFERRED by task owner**

## Acceptance criteria

- [x] No raw insert/update/upsert remains for the 9 in-scope tables anywhere in app code, edge
      functions, or extension write paths (grep-verified)
- [x] The extended replica simulation converges for offline/concurrent-edit interleavings
- [x] Push-before-pull foreground ordering and Realtime echo filtering behave as before (untouched)
- [x] Full test suite (2157 pass), typecheck, and lint (0 errors) pass
- [ ] Manual two-device conflict scenario converges (the `[verify]` above) — **DEFERRED**

## Implementation log

Built the CRDT wiring as a self-contained sync-layer with **no changes to contexts** and **no
per-type snake↔camel conversion of data values** (the #1 data-safety risk). New modules:

- `src/services/sync/crdt-sync.ts` — `CrdtSync` coordinator: owns the HLC + a per-record "shadow"
  of last-seen clocked rows (stored in the wire/snake representation). `stampWrite` (diff vs shadow,
  stamp changed fields, return clocks), `reconcileRemote` (feed HLC via `receiveMany`, merge vs
  shadow), `reconcileRemoteChange`, `reconcilePulledRows`, `forget`, `getShadow`. Shadow is kept
  **only for locally-edited records** to bound growth.
- `src/services/sync/crdt-sync-instance.ts` — `AsyncStorageShadowStore` (per-record
  `@crdt_shadow:<table>:<id>` keys, shape-validated), hydrated `getCrdtSync()` singleton,
  `reconcilePulled` wrapper.
- `src/services/sync/device-id.ts` — persisted stable device id (`@crdt_device_id`) for the HLC.
- `src/services/sync/merge-record-write.ts` — direct `merge_record` write for non-queued paths.

Wiring:
- `sync-engine.ts` — `stampOperation` stamps in-scope enqueues (embeds `field_clocks` in op data);
  `executeOperation` routes in-scope CREATE/UPDATE to `supabase.rpc('merge_record', …)`; in-scope
  DELETE stays a hard delete (0005 does tombstones) and drops the shadow.
- `sync-queue.ts` — `optimize()` unions per-field clocks instead of shallow-clobbering.
- `sync-context.tsx` — Realtime events reconciled through `reconcileRemoteChange` before dispatch,
  serialized on a promise chain to preserve per-record ordering; contexts unchanged.
- `activity-sync-service.ts` / `baby-sync-service.ts` — the fallback path, 6 guest-migration
  upserts, all baby writes go through `merge_record`; **all 8 in-scope activity fetches + the babies
  fetch reconcile pulled rows** (`reconcilePulled`) so foreground pull merges against local state.
- `crdt.ts` — added `HLC.receiveMany` (fold many clocks, persist once) for efficient pull receive.

Decisions made (no `[decision]` items in the task; defaults dictated by spec/acceptance):
- Stamp at save time (needs `prev`), centralized at `SyncEngine.enqueueOperation` + `mergeRecordWrite`.
- Clocks are canonical in snake_case (matching the RPC + `field_clocks` column); the sync-layer
  shadow stores wire rows verbatim, so data values are never key-converted.
- Persisted stable device id shared conceptually with the HLC (Realtime echo filtering left as-is).
- Foreground-pull reconcile added after review flagged it as a spec gap (see
  `reviews/0004-crdt-sync-wiring-review.md`).

Verification: `npm run typecheck` clean · `npm run test:unit` 2157 pass (added ~40 tests incl.
convergence simulation + offline-queue round-trip + foreground-pull integration) · `npm run lint`
0 errors. Grep confirms no raw insert/update/upsert to the 9 tables remains. Review generated at
`reviews/0004-crdt-sync-wiring-review.md`; worst finding (foreground-pull) fixed and re-verified.
