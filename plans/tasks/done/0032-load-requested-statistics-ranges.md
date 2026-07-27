# Task 0032: Load requested ranges before calculating statistics

**Branch**: `feature/load-requested-statistics-ranges`
**Depends on**: 0031
**Source**: Read-only production diagnosis and conversation 2026-07-27 · **User stories**: caregivers see complete statistics for the date or period they request even when its records were not part of startup data; statistics do not force a full-history startup download

## What to build

Use the range-loading contract from 0031 whenever Statistics or Sleep Patterns needs activity data outside confirmed context coverage. A view must request the complete interval represented by its active controls before treating the corresponding calculation as complete or displaying an empty state.

Sleep day and week navigation must load the selected interval, including overlapping sleep sessions. Sleep summaries must load their selected 7-, 14-, or 30-day interval. Feeding, diaper, pumping, and tummy-time Today or 7 Days views must confirm their displayed intervals when their category or period becomes active. Growth and health statistics currently summarize the baby's complete recorded history, so opening those categories must request that history in deterministic pages at that point, not during app startup.

Reuse cached and in-flight range coverage across rerenders and compatible views. Keep cached statistics visible during refresh; if the requested interval has no confirmed data, show loading rather than a false zero or empty chart. Failed range reads must expose retry behavior without replacing previously confirmed data. Requests and results remain selected-baby scoped.

Do not add historical date navigation to categories that currently expose only Today or 7 Days, change statistical formulas, alter sleep interval-union behavior from 0029, wire exports/reports, or introduce full-history startup synchronization.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Reuse the typed range API and equivalent loading-state conventions from 0031 instead of adding view-specific database reads; prove with lint and typecheck.
- [x] Add deterministic component and integration tests that verify requested intervals, cache reuse, asynchronous completion, failures, empty results, and selected-baby isolation.
- [x] Update user-facing or architecture documentation to state when each statistics period is loaded and how unavailable historical data is represented.

## Implementation work

- [x] Use TDD to reproduce a historical sleep day or week that calculates as empty because its database records are older than startup context data.
- [x] Wire Sleep Statistics and Sleep Patterns day, week, and summary controls to request the exact interval required by the active view, including sleep overlap at interval boundaries.
- [x] Wire feeding, diaper, pumping, and tummy-time Statistics views to confirm the active Today or 7 Days interval before final calculation.
- [x] Load complete paginated growth and health history only when their all-history Statistics categories become active.
- [x] Reuse loaded and in-flight coverage when controls rerender or compatible views request the same interval; do not trigger render loops or duplicate reads.
- [x] Add consistent cached-refresh, initial-loading, verified-empty, error, and retry presentation without clearing valid statistics already on screen.
- [x] Guard asynchronous completion across category navigation and selected-baby changes so one baby's result cannot complete another baby's view.
- [x] Update the relevant Statistics/Sleep Patterns documentation and README behavior summary, then run focused component/integration tests and the canonical repository checks.

## Acceptance criteria

- [x] Selecting an older Sleep Statistics or Sleep Patterns day or week loads all sleep sessions needed for that interval and then renders the correct non-empty result.
- [x] Sleep 7-, 14-, and 30-day summaries and feeding, diaper, pumping, and tummy-time period views calculate from a server-confirmed complete interval rather than whatever happened to load at startup.
- [x] Opening Growth or Health Statistics retrieves all available rows in deterministic pages at that time, including histories larger than 1,000 rows, without moving that work to startup.
- [x] Repeated renders and overlapping period requests reuse loaded or in-flight coverage instead of issuing duplicate database reads.
- [x] Cached statistics remain visible during refresh; an unconfirmed interval shows loading, a failed request offers retry, and only a confirmed interval can show zero or empty results.
- [x] Changing babies or leaving a category while a request is active cannot write or display stale results for the new selection.
- [x] Existing statistical formulas, sleep overlap-union semantics, activity logging, Timeline behavior, and guest/local-only behavior remain unchanged.
- [x] No new historical controls, export/report loading, database schema changes, or full-history startup download are introduced.

## Completion record

- **Implementation**: `src/utils/statistics-ranges.ts` defines the half-open calendar, sleep, summary, and fixed all-history ranges. `StatisticsActivityRange.tsx`, `SleepStatsContainer.tsx`, and `app/(tabs)/sleep-patterns.tsx` request those ranges through the existing context API. `ActivityRangeBoundary.tsx` handles loading, cached refresh, failure, retry, and confirmed empty presentation.
- **Decisions**: Growth and health use the fixed UTC interval from year 0001 through year 9999 so every valid recorded row is paged. Tummy Time Today requests seven calendar days because the view displays a rolling seven-day comparison. Sleep calculations retain their existing formulas and interval-union behavior.
- **TDD evidence**: Component tests first failed with no sleep range requests, no unverified loading state, and stale previous-baby data. Unit tests first failed before the range helpers existed. Each slice passed after the corresponding implementation. Tests now cover day and week navigation, 7-, 14-, and 30-day summaries, every non-sleep category, duplicate-render suppression, asynchronous historical completion, retry presentation, pagination above 1,000 rows, and baby switching.
- **Repository guidelines**: Loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, `references/02-testing.md`, and `references/03-documentation.md`. Lint, strict type checking, deterministic Vitest and Jest tests, the canonical gate, and current architecture documentation provide the required evidence. Unrelated repository-wide formatter, coverage, and pre-commit gaps remain outside this task.
- **Review**: `task-review` compared the branch with `main`. One bug finding was fixed: contexts can retain the previous baby's rows during a selection change, so statistics now filter cache and sleep state by the selected baby and suppress an old active timer. The remediation panel found no remaining standards, spec, bug, or security findings. No security risk was accepted.
- **Documentation**: Updated the Offline-First Sync Engine section in `README.md` and added Statistics and Sleep Patterns range behavior to `docs/ACTIVITY_HISTORY.md`. The write-well audit completed in two passes.
- **Proof**: Focused range and component suites passed. `npm run check` passed 2,310 unit tests, 664 component tests, 103 security tests, 244 sync tests, 41 CI contract tests, 26 SQL vectors in both directions, 49 merge RPC assertions, and the remaining SQL authorization and concurrency checks. The local Supabase database was reset and all 59 migrations applied. Manual verification was not required because the active controls, asynchronous states, pagination, and baby switching are covered by component and integration tests.
