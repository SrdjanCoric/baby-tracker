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

- [ ] Reuse the typed range API and equivalent loading-state conventions from 0031 instead of adding view-specific database reads; prove with lint and typecheck.
- [ ] Add deterministic component and integration tests that verify requested intervals, cache reuse, asynchronous completion, failures, empty results, and selected-baby isolation.
- [ ] Update user-facing or architecture documentation to state when each statistics period is loaded and how unavailable historical data is represented.

## Implementation work

- [ ] Use TDD to reproduce a historical sleep day or week that calculates as empty because its database records are older than startup context data.
- [ ] Wire Sleep Statistics and Sleep Patterns day, week, and summary controls to request the exact interval required by the active view, including sleep overlap at interval boundaries.
- [ ] Wire feeding, diaper, pumping, and tummy-time Statistics views to confirm the active Today or 7 Days interval before final calculation.
- [ ] Load complete paginated growth and health history only when their all-history Statistics categories become active.
- [ ] Reuse loaded and in-flight coverage when controls rerender or compatible views request the same interval; do not trigger render loops or duplicate reads.
- [ ] Add consistent cached-refresh, initial-loading, verified-empty, error, and retry presentation without clearing valid statistics already on screen.
- [ ] Guard asynchronous completion across category navigation and selected-baby changes so one baby's result cannot complete another baby's view.
- [ ] Update the relevant Statistics/Sleep Patterns documentation and README behavior summary, then run focused component/integration tests and the canonical repository checks.

## Acceptance criteria

- [ ] Selecting an older Sleep Statistics or Sleep Patterns day or week loads all sleep sessions needed for that interval and then renders the correct non-empty result.
- [ ] Sleep 7-, 14-, and 30-day summaries and feeding, diaper, pumping, and tummy-time period views calculate from a server-confirmed complete interval rather than whatever happened to load at startup.
- [ ] Opening Growth or Health Statistics retrieves all available rows in deterministic pages at that time, including histories larger than 1,000 rows, without moving that work to startup.
- [ ] Repeated renders and overlapping period requests reuse loaded or in-flight coverage instead of issuing duplicate database reads.
- [ ] Cached statistics remain visible during refresh; an unconfirmed interval shows loading, a failed request offers retry, and only a confirmed interval can show zero or empty results.
- [ ] Changing babies or leaving a category while a request is active cannot write or display stale results for the new selection.
- [ ] Existing statistical formulas, sleep overlap-union semantics, activity logging, Timeline behavior, and guest/local-only behavior remain unchanged.
- [ ] No new historical controls, export/report loading, database schema changes, or full-history startup download are introduced.
