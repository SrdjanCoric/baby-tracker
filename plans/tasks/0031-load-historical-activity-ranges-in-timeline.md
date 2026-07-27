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

- [ ] Define one strict, consistently named range contract and shared pagination/merge machinery; do not duplicate a subtly different paging loop for each activity table. Prove with lint and typecheck.
- [ ] Add deterministic service and component tests for the database boundary, local persistence, context state, and Timeline behavior without using production data or undocumented external services.
- [ ] Document the recent-data-first startup and demand-driven historical loading flow, including range reconciliation and offline behavior, in the relevant architecture documentation.

## Implementation work

- [ ] Use TDD to reproduce a Timeline date whose rows exist in Supabase but fall behind the unpaginated 1,000-row startup response and are therefore absent from context state.
- [ ] Introduce a typed half-open UTC range contract and shared deterministic pagination for all Timeline activity tables, accounting for their different timestamp columns and sleep interval overlap.
- [ ] Add lossless range reconciliation under the existing collection lock: replace the authoritative portion of a loaded interval while retaining out-of-range rows, pending local mutations, CRDT tombstones needed for reconciliation, and previously cached ranges.
- [ ] Keep startup pulls explicitly bounded and change their commit behavior where necessary so foreground refresh cannot erase historical records loaded on demand.
- [ ] Expose per-baby context range loaders with loaded/in-flight coverage, overlapping-request reuse, guest-mode handling, retryable errors, and stale scope or baby guards.
- [ ] Wire Timeline date selection and older-window expansion to request all activity ranges needed by the visible interval before presenting it as empty.
- [ ] Add or update loading, cached-refresh, error, and retry UI using the repository's existing theme, localization, and accessibility patterns.
- [ ] Update the relevant sync/history architecture documentation and README behavior summary, then run focused sync/context/Timeline tests and the canonical repository checks.

## Acceptance criteria

- [ ] Navigating Timeline to a date older than the startup response loads and displays every live feeding, sleep, diaper, pumping, growth, tummy-time, and health entry stored for that date.
- [ ] A requested interval containing more than 1,000 rows is completely retrieved in deterministic pages with no duplicate or skipped IDs.
- [ ] Sleep sessions overlapping a requested interval are available to Timeline summaries even when they began before that interval.
- [ ] Range loading preserves out-of-range cached records and pending local create, update, and delete operations; tombstoned rows remain hidden and cannot be resurrected.
- [ ] A foreground refresh does not discard historical ranges already loaded into local storage and context state.
- [ ] Repeated or overlapping requests reuse loaded or in-flight coverage, and a request completed after a baby or authenticated storage-scope change cannot write into the new scope.
- [ ] An uncached range shows loading, a failed read shows a retry path, and only a successfully loaded range with no live rows is presented as empty.
- [ ] Startup remains bounded rather than downloading complete activity history, and guest mode performs no authenticated range query.
- [ ] No database schema, RLS policy, export/report behavior, or unrelated activity UX changes.
