# Task 0031: Load historical activity ranges on demand in Timeline

**Branch**: `feature/load-historical-activity-ranges-in-timeline`
**Depends on**: 0007, 0021
**Source**: Read-only production diagnosis and conversation 2026-07-27 · **User stories**: caregivers can navigate Timeline to any recorded date and see all stored activities; opening the app does not download the baby's full history

## What to build

Add a shared, typed range-loading path for feeding, sleep, diaper, pumping, growth, tummy-time, and health records. Keep authenticated startup recent-data-first: startup pulls remain bounded and must not paginate through the baby's complete database history. When Timeline selects a date or expands its older visible window, request the missing UTC interval for the selected baby, page through every server row in that interval, and merge the result into the existing context and user-scoped local collection.

A range merge must preserve records outside the requested interval, queued local creates and updates, pending deletes, CRDT tombstone behavior, and records loaded by an earlier request. It must run through the existing serialized storage and sync reconciliation rather than bypassing contexts or replacing their collections. A later foreground startup pull must not discard cached historical ranges. Track loaded and in-flight range coverage per baby so repeated or overlapping Timeline renders do not issue redundant reads, and reject stale completion after the user or selected baby changes.

Use each table's real activity timestamp and a deterministic timestamp-plus-ID order. Page until the requested interval is exhausted even when it contains more than Supabase's 1,000-row response limit. Sleep loading must include sessions that overlap an interval, including a session that starts before the interval and ends within or after it. Convert Timeline's local calendar boundaries to explicit UTC instants before querying.

Timeline must distinguish an unverified range from a verified empty range. Keep already cached entries visible while refreshing; when an uncached range is loading, show progress instead of an empty day, and provide a retryable error state if the range cannot be read. Guest/local-only behavior remains local and must not attempt Supabase reads.

Do not add Statistics consumers, export/report loading, new date controls, database schema changes, or full-history startup synchronization in this task.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Define one strict, consistently named range contract and shared pagination/merge machinery; do not duplicate a subtly different paging loop for each activity table. Prove with lint and typecheck.
- [x] Add deterministic service and component tests for the database boundary, local persistence, context state, and Timeline behavior without using production data or undocumented external services.
- [x] Document the recent-data-first startup and demand-driven historical loading flow, including range reconciliation and offline behavior, in the relevant architecture documentation.

## Implementation work

- [x] Use TDD to reproduce a Timeline date whose rows exist in Supabase but fall behind the unpaginated 1,000-row startup response and are therefore absent from context state.
- [x] Introduce a typed half-open UTC range contract and shared deterministic pagination for all Timeline activity tables, accounting for their different timestamp columns and sleep interval overlap.
- [x] Add lossless range reconciliation under the existing collection lock: replace the authoritative portion of a loaded interval while retaining out-of-range rows, pending local mutations, CRDT tombstones needed for reconciliation, and previously cached ranges.
- [x] Keep startup pulls explicitly bounded and change their commit behavior where necessary so foreground refresh cannot erase historical records loaded on demand.
- [x] Expose per-baby context range loaders with loaded/in-flight coverage, overlapping-request reuse, guest-mode handling, retryable errors, and stale scope or baby guards.
- [x] Wire Timeline date selection and older-window expansion to request all activity ranges needed by the visible interval before presenting it as empty.
- [x] Add or update loading, cached-refresh, error, and retry UI using the repository's existing theme, localization, and accessibility patterns.
- [x] Update the relevant sync/history architecture documentation and README behavior summary, then run focused sync/context/Timeline tests and the canonical repository checks.

## Acceptance criteria

- [x] Navigating Timeline to a date older than the startup response loads and displays every live feeding, sleep, diaper, pumping, growth, tummy-time, and health entry stored for that date.
- [x] A requested interval containing more than 1,000 rows is completely retrieved in deterministic pages with no duplicate or skipped IDs.
- [x] Sleep sessions overlapping a requested interval are available to Timeline summaries even when they began before that interval.
- [x] Range loading preserves out-of-range cached records and pending local create, update, and delete operations; tombstoned rows remain hidden and cannot be resurrected.
- [x] A foreground refresh does not discard historical ranges already loaded into local storage and context state.
- [x] Repeated or overlapping requests reuse loaded or in-flight coverage, and a request completed after a baby or authenticated storage-scope change cannot write into the new scope.
- [x] An uncached range shows loading, a failed read shows a retry path, and only a successfully loaded range with no live rows is presented as empty.
- [x] Startup remains bounded rather than downloading complete activity history, and guest mode performs no authenticated range query.
- [x] No database schema, RLS policy, export/report behavior, or unrelated activity UX changes.

## Completion record

### Implementation and decisions

- `src/services/activity-sync-service.ts` defines the seven-table range map, timestamp rules, sleep overlap query, timestamp-plus-ID cursor pagination, bounded startup reads, and locked reconciliation.
- `src/services/activity-range-loader.ts` tracks loaded, failed, and in-flight half-open ranges. `src/hooks/useActivityRangeLoader.ts` keeps that coverage per baby and authentication scope and rejects stale completion.
- The seven activity contexts expose typed range loaders and status readers. `app/(tabs)/timeline.tsx` converts the visible local calendar window to UTC and requests every activity range before showing an empty state.
- Cursor pagination replaced offset pagination during task review because deleting an earlier row between pages could otherwise skip an existing row.
- No schema, RLS, export, report, Statistics, or date-control changes were made.

### TDD and verification

Observed RED and GREEN cycles covered the missing public range API, lossless interval replacement, sleep overlap, bounded startup preservation, overlapping in-flight reuse, Timeline range requests, uncached loading, per-baby coverage reuse, and cursor pagination under a page-boundary mutation.

Focused proof:

- `npx vitest run src/services/activity-range-loader.test.ts src/services/activity-range-sync.test.ts src/services/activity-sync-lossless.test.ts src/services/activity-sync-tombstone.test.ts`
- `npx jest --runTestsByPath './app/(tabs)/timeline.component.test.tsx' src/hooks/useActivityRangeLoader.component.test.tsx --runInBand`
- `npm run lint`
- `npm run typecheck`

Highest-level proof: `npm run check` passed after review remediation and the README update. It ran 2,306 unit tests, 655 component tests, 103 security tests, 244 sync tests, 49 CI contract tests, 26 SQL vectors in both directions, 49 merge assertions, authorization checks, and concurrency checks against reset local Supabase. No production system or data was used.

### Repository guidelines and documentation

Implement and review modes loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, `references/02-testing.md`, and `references/03-documentation.md`. Strict typing and naming are proved by typecheck and zero-warning lint. Service, hook, context, storage, and Timeline behavior are covered by deterministic tests at controlled boundaries.

`docs/ACTIVITY_HISTORY.md` documents startup bounds, timestamps, pagination, reconciliation, range coverage, and offline behavior. README section `Offline-First Sync Engine` links to it. The documentation and README write-well audits completed in two passes with no remaining findings.

### Task review

Review used `base=main` and ran Standards, Spec, Bug, and Security lenses. One remediation pass fixed a major page-boundary correctness bug by replacing offset paging with a timestamp-plus-ID cursor. It also removed new NativeWind dark variants from the rapid-update Timeline states, following the repository's navigation-context guidance. The second panel was clean. Security review covered the new Supabase reads, internal filter construction, and scoped AsyncStorage reconciliation; it found no unresolved risk.

Manual device verification was not required because the behavior is covered through the public service, hook, context, and Timeline component interfaces. No security risk was accepted.
