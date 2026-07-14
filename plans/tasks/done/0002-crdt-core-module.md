# Task 0002: CRDT core: HLC + LWW-Map merge module

**Branch**: `feature/crdt-core-module`
**Depends on**: 0001 (shared: sync layer — one conflict-resolution story at a time)
**Source**: talk-it-through 2026-07-04 (CRDT conflict resolution) · **User stories**: "As a caregiver, edits I make offline must never silently erase my partner's edits to the same record"

## What to build

The pure-logic heart of the CRDT: a single sync-layer module (`src/services/sync/crdt.ts`, per the
master plan header) containing:

1. **HLC service** — issues hybrid logical clocks in the master plan's string format
   (`"<ISO-8601 UTC ms>-<4-digit counter>-<deviceId>"`). Ticks lazily: on local mutation
   (`tick()`) and on receiving a remote clock (`receive(remoteClock)` — take max, bump counter).
   Persists the last-issued clock to AsyncStorage so restarts never go backwards. Reuses the
   existing device-ID mechanism used for Realtime echo filtering.
2. **`stampChanges(prev, next)`** — diffs two versions of a record and returns `next` with a fresh
   HLC stamped into its `fieldClocks` map for each changed field only.
3. **`merge(a, b)`** — pure field-wise LWW merge of two record+clocks pairs: for each field, the
   value whose clock compares greater (lexicographic) wins; missing/empty clock entries compare as
   epoch (legacy rows lose to any clocked write). Deterministic, symmetric, no I/O.
4. **Shared test-vector file** — a JSON file of merge cases (inputs + expected merged output) that
   task 0003 will also run against the SQL implementation. Include: disjoint field edits, same-field
   conflicts, legacy (empty-clock) rows, tombstone flips both directions, exact-tie clocks resolved
   by deviceId.

Nothing is wired into the sync engine yet (that's task 0004) — this slice is complete when the
module's behavior is fully specified and verified by its tests.

## AFK tasks

- [x] Add `fast-check` as a dev dependency
- [x] TDD the HLC: monotonicity (consecutive ticks strictly increase), causality (`receive` always
      produces a clock greater than the remote one, even with local wall-clock behind), restart
      safety (persisted clock never regresses), tie-break by deviceId
- [x] TDD `stampChanges`: only changed fields get new clocks; unchanged fields keep theirs;
      `fieldClocks` metadata itself is never treated as a data field
- [x] TDD `merge` with fast-check property tests: commutativity (merge(a,b) ≡ merge(b,a)),
      associativity, idempotence (merge(a,a) ≡ a), and convergence (any permutation of pairwise
      merges over N states yields the same result)
- [x] Write the replica simulation test: 2–3 in-memory "devices" applying random interleaved
      edits with offline periods and queue-flush ordering, asserting all replicas converge to
      identical state (incorporate the conflict scenarios harvested from the old ConflictResolver
      tests in task 0001)
- [x] Author the shared JSON test-vector file and a vitest runner that asserts the TS `merge`
      reproduces every vector

## Acceptance criteria

- [x] All property tests, vector tests, and the replica simulation pass in `npm run test:unit`
- [x] The module is pure TypeScript with no Supabase or React imports (AsyncStorage only, for HLC
      persistence, behind an injectable interface so tests run without native modules)
- [x] The test-vector file is a plain JSON artifact consumable by a non-TypeScript runner
- [x] Typecheck and lint pass; no `any`

## Implementation log

Implemented 2026-07-04 on branch `feature/crdt-core-module`.

**Files created**
- `src/services/sync/crdt.ts` — the pure CRDT core (zero imports). Exports: `HLC` class
  (`tick`/`receive`/`hydrate`), `formatClock`/`parseClock`/`compareClocks`, `stampChanges`,
  `merge`, `ClockedRecord`/`FieldClocks`/`HlcState`/`ClockStorage` types, `MemoryClockStorage`,
  `EMPTY_CLOCK`.
- `src/services/sync/crdt-storage.ts` — `AsyncStorageClockStorage` adapter (the only file that
  imports AsyncStorage), kept out of `crdt.ts` so the core and its tests never touch native
  modules. Versioned + corruption-resetting, user-scoped key `@crdt_hlc`.
- `src/services/sync/crdt-vectors.json` — 11 language-neutral merge vectors (`{fields, fieldClocks}`
  shape) for the TS `merge` and task 0003's SQL RPC to share.
- Tests: `crdt.test.ts` (HLC + monotonicity property), `crdt-stamp.test.ts`, `crdt-merge.test.ts`
  (unit + commutativity/associativity/idempotence/convergence properties), `crdt-vectors.test.ts`
  (vector + order-independence runner), `crdt-simulation.test.ts` (2–3 replica convergence, incl. a
  fast-check interleaving property), `crdt-storage.test.ts`.
- `src/services/sync/index.ts` — re-exports `./crdt` (pure). `crdt-storage` is imported directly by
  wiring, not via the barrel, so importing the barrel never pulls AsyncStorage.

**Key decisions**
- **Clock format & comparison**: fixed-width ISO (24 chars) + 4-digit counter make plain
  lexicographic string compare the logical order. `parseClock` reads by fixed offsets, not by
  splitting on `-`, because the deviceId (`device-<ts>-<rand>`) itself contains dashes.
- **HLC**: canonical hybrid-logical-clock tick/receive; counter overflow carries into millis to
  keep the 4-digit width; `receive` is guaranteed strictly greater than both prior local and remote
  clocks (causality holds under wall-clock skew). Persistence is behind the injectable
  `ClockStorage`; `hydrate()` seeds the later of persisted vs current state so restarts never
  regress.
- **merge**: per-field max over a total order — ABSENT is bottom (a field present on only one side
  survives); among present, order by clock string; on a byte-identical clock tie (same origin, or
  two legacy empty-clock rows) fall back to a deterministic canonical-value comparison. This makes
  merge commutative, associative, and idempotent for *any* inputs, which the property tests assert.
  `deleted` is an ordinary LWW field — tombstone set/undelete fall out with no special cases.
- **Device ID (flag for task 0004)**: the module takes `deviceId` by injection, faithful to
  "reuse the existing device-ID mechanism." Recon found the existing `RealTimeSync.getDeviceId()`
  is **in-memory and regenerated every process** (not persisted). That does not affect correctness
  here (millis+counter dominate; deviceId only breaks exact ties, and a differing deviceId never
  produces an equal clock string). **Recommendation for 0004**: persist a stable device id (e.g. in
  the App Group / AsyncStorage) and pass it to both the HLC and Realtime echo filtering, for
  cleaner and stable tie-break semantics across restarts.

**Verification**: `npm run typecheck` clean; `npm run lint` clean (no `any` in production);
`npm run test:unit` → 85 files / 2116 tests pass.

**Post-review fixes** (from `reviews/0002-crdt-core-module-review.md`, applied test-first + verified):
- `merge` now deep-clones the winning field value (Hermes-safe `deepClone`) — no more
  shared-reference aliasing of nested arrays/objects between inputs and output.
- `crdt-storage.ts` uses a **device-global** key (dropped `getUserScopedKey`) — the per-device
  HLC state no longer resets to 0 on an account switch, which would let a fixed deviceId re-issue
  clocks it already handed out.
- `crdt-vectors.json` `description` now fully documents the merge rules (clock winner, empty-clock
  bottom sentinel, exact-tie canonical-value tiebreak compared **as strings**) so task 0003's SQL
  twin is pinned; added numeric and object-valued exact-tie vectors.
- The edit-vs-delete simulation now asserts merged values (`deleted === true && notes === "v2"`),
  not just replica convergence.
- Deferred by agreement: `persist()` crash-window, `valuesEqual` NaN churn, orphan-fieldClocks
  idempotence, vector-count assertion, redundant JSDoc, and stable-device-ID reuse (→ task 0004).

## Harvested conflict scenarios (from the deleted ConflictResolver tests, task 0001)

Semantic cases from `src/services/sync/conflict-resolver.test.ts` (deleted in task 0001), to be
re-expressed as merge/vector/simulation cases here. Original entries were feeding-like records
(`babyId`, `type`, `notes`, `amountMl`, `side`) keyed by `updatedAt`; in the CRDT they translate
to per-field HLC semantics:

1. **Divergence detection**: local and remote versions differ → merge must resolve (old:
   `detectConflict` true on differing `updatedAt`); identical versions → merge is identity.
2. **Update/update, remote newer** → remote's field values win (old: `KEEP_REMOTE`).
3. **Update/update, local newer** → local wins (old: `KEEP_LOCAL`).
4. **Exact timestamp tie** → deterministic winner (old: always `KEEP_REMOTE`; new: tie-break by
   counter then deviceId in the HLC string).
5. **Disjoint field edits** (local changed `notes`, remote changed `amountMl`) → merged record
   keeps both changes (old 3-way `MERGE`; new: per-field LWW gives this without a base version).
6. **Same-field edit on both sides** → newer clock wins for that field only.
7. **Multi-field mixed edit** (local: `notes`; remote: `amountMl` + `side`) → every
   non-overlapping change from both sides survives.
8. **Edit vs delete (both directions)** → old resolver made edits beat deletes
   (`UPDATE_DELETE`→`KEEP_LOCAL`, `DELETE_UPDATE`→`KEEP_REMOTE`). New semantics: `deleted` is an
   ordinary LWW field — whichever write (the edit's field stamps vs the tombstone's
   `deleted: true` stamp) carries the greater clock wins per field. Add vectors for both
   orderings, including un-delete.
9. **Create/create (two devices create entries offline)** → both kept as separate records
   (old: `KEEP_BOTH`). In the CRDT this is trivial — different record IDs never merge — but the
   replica simulation should assert no cross-record interference.
10. **Clock skew tolerance** (old: 5-minute skew smoke test) → HLC must stay monotonic and
    converge even when a device's wall clock is minutes behind (covered by the HLC causality
    property: `receive()` always exceeds the remote clock).
11. **Field diff excludes bookkeeping** (old `getChangedFields` ignored `updatedAt`) →
    `stampChanges` must never stamp `fieldClocks` itself and should treat sync metadata as
    non-data fields.

Deliberately not carried over: the old "conflict logging" case (every resolution set
`conflictLogged: true`). It asserted a flag on the superseded `ConflictResolution` result shape,
which no longer exists — per-field LWW has no resolution object to flag. If merge observability
is wanted, add it as a logging concern in task 0004 (sync wiring), not as a merge semantic here.
