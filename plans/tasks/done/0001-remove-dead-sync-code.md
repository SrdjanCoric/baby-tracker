# Task 0001: Remove dead sync code (ConflictResolver + PowerSync)

**Branch**: `feature/remove-dead-sync-code`
**Depends on**: none
**Source**: talk-it-through 2026-07-04 (CRDT conflict resolution) · **User stories**: n/a (cleanup prerequisite)

## What to build

Delete the two abandoned conflict/sync experiments so the codebase has exactly one
conflict-resolution story before the CRDT layer lands:

1. **`ConflictResolver`** (`src/services/sync/conflict-resolver.ts`) — instantiated in the sync
   engine but its `resolve()`/`detectConflict()` are never called from production code. Its
   three-way merge requires a base version nothing stores.
2. **PowerSync** — `@powersync/common` and `@powersync/react-native` in package.json plus the
   never-initialized integration (`setDatabase()` is never called from app code): the connector,
   the PowerSync schema, the syncable-storage base class, the test mock, and the PowerSync half of
   `baby-storage-sync.ts`. These are native-module-bearing dependencies riding in every build for
   nothing.

The result is a leaner dependency tree and a clean diff surface for the CRDT work (task 0002).

## AFK tasks

- [x] Map every import/reference of `ConflictResolver` and the PowerSync modules (including tests
      and mocks) before deleting, so nothing is orphaned or half-removed
- [x] Delete `ConflictResolver`, its instantiation in the sync engine, and its test file — first
      harvesting the conflict *scenarios* from those tests into notes inside task 0002's test plan
      (the scenarios are good; the implementation is superseded)
- [x] Delete the PowerSync integration files, the mock, and the PowerSync-dependent code paths in
      `baby-storage-sync.ts`; remove both `@powersync/*` packages from package.json and the lockfile
- [x] Verify `npm run typecheck`, `npm run lint`, and `npm run test:all` pass with everything
      removed
- [x] Verify iOS/Android prebuild still succeeds without the PowerSync native modules

## Acceptance criteria

- [x] No source file, test, or mock references PowerSync or `ConflictResolver`
- [x] `@powersync/common` and `@powersync/react-native` are gone from package.json and lockfile
- [x] Typecheck, lint, and the full test suite pass — 79 vitest files (2051 tests) and 531 jest
      tests pass; the single failing jest suite (`app/(tabs)/index.component.test.tsx`, missing
      Supabase env vars at import) fails identically on clean `main` — pre-existing, unrelated
- [x] App builds for both platforms (prebuild succeeds; zero PowerSync/quick-sqlite pods)

## Implementation log (2026-07-04)

Branch `feature/remove-dead-sync-code`.

**Deleted whole files**: `src/services/sync/conflict-resolver.ts` (+ its test),
`src/services/sync/powersync-connector.ts`, `src/services/sync/schema.ts`,
`src/services/sync/syncable-storage.ts`, `src/services/baby-storage-sync.ts` (+ its test),
`src/__mocks__/powersync.ts`. Recon showed `baby-storage-sync.ts` was PowerSync top-to-bottom
(not "half" as guessed here): its `setDatabase()` was only called from its own test, and its
`SyncedBaby` types had no other importers — deleted entirely.

**Surgical edits**: `src/services/sync/index.ts` (dropped 4 dead barrel exports),
`src/services/sync/sync-engine.ts` (removed `ConflictResolver` import/field/instantiation —
its only three references), `jest.setup.js` (dropped the `@powersync/react-native` mock block
and the `ConflictResolver` key), `service-unavailability.edge-case.test.ts` (describe string
renamed "PowerSync…"→"Sync…"; the test exercises the live SyncEngine).

**Six `*-storage-sync.ts` files** (feeding/sleep/diaper/growth/pumping/tummyTime) extended the
deleted PowerSync base class but their singletons were never imported; only their `Synced*Entry`
interfaces are live (used by `useDuplicateCheck.ts` and `duplicate-detection.ts`). Each stripped
to just that interface, import paths unchanged.

**Dependencies removed**: `@powersync/common`, `@powersync/react-native`, and — per user decision
during implementation — `react-native-quick-sqlite` (PowerSync's SQLite driver, zero imports
anywhere). Lockfile updated via `npm uninstall`.

**Harvest**: 11 conflict scenarios from the old ConflictResolver tests recorded in task 0002's
file under "Harvested conflict scenarios", translated to per-field HLC semantics.

**Review fixes applied (user-approved, 2026-07-04)**: all 7 findings from
`reviews/0001-remove-dead-sync-code-review.md` fixed — CLAUDE.md sync-architecture bullets for
`conflict-resolver.ts` and `baby-storage-sync.ts` removed and the Tech Stack line reworded;
`deno.lock`'s workspace dependency mirror cleaned of the three removed packages (deno not
installed locally, so the three entries were hand-removed — the lock has no resolved-npm
section, so this matches what regeneration would produce); `ConflictResolutionModal.tsx`, its
component test, its barrel export, and the orphaned `ConflictType`/`ConflictScenario`/
`ResolutionStrategy`/`ConflictResolution` types in `sync/types.ts` deleted; a note added to task
0002's harvest about the deliberately-dropped conflict-logging case. Housekeeping: `reviews/`
added to `.gitignore` (task-review scaffolding, per the review workflow — ephemeral,
branch-scoped, never committed).

**Post-fix re-review residue (also fixed)**: deleting the modal orphaned 21 `sync.*` i18n keys
(its 18 `t()` calls plus pluralized `conflictCount_one/_other`) — removed from all 9 locale
files as pure line deletions (verified: zero code consumers; `sync.tableLabels.*` and the sync
status keys kept).

**Flagged for later** (out of scope, untouched): the duplicate-detection chain
(`useDuplicateCheck`) appears unused by any screen. Also `deno.lock`'s workspace mirror is
missing four packages that exist in package.json (`expo-build-properties`,
`expo-linear-gradient`, `expo-store-review`, `react-native-date-picker`) — pre-existing on
`main` (dates from PR #104), not introduced here; regenerate `deno.lock` with deno installed in
a follow-up.
