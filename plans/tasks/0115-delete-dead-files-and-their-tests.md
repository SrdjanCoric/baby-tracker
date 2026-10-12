# Task 0115: Delete unused components, hooks and helpers with their tests

**Branch**: `feature/delete-dead-files`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit and dead-code check, conversation 2026-10-08 (`docs/usage/test-audit.md`, section 7) · **User stories**: a developer reading the code only finds code the app runs, and every test guards something users can hit.

## What to build

Remove whole source files that no production code can reach, together with their tests. The app behaves exactly as before.

Verified dead on `main` (no import from app, src, targets, supabase/functions or plugins; no barrel name imported; no route or deep link):

- Components: FeedingTypeMenu, InsightCard, OfflineBanner, SimpleBarChart, SyncStatusIndicator, TrendIndicator, Card (with PressableCard), QuickActionButton (with BreastfeedingButtons and DiaperButtons), TimerDisplay, TodaySummary, and the whole `components/error` folder (ErrorBoundary, ErrorFallback).
- Hooks and helpers: useAccessibility, utils/accessibility, types/accessibility, utils/error-handler, utils/insights, utils/trends, the theme reducer file, the sync data-migration module, validators/diaper, and the empty utils index file.
- In `types/error`, only the error-boundary and app-error types; the retry config stays.

Barrel files lose the matching export lines.

## Decided

- Dead code goes with its tests, after verifying it is dead. — Owner decision 2026-10-08.
- Before deleting each file, re-check on the branch that it still has no production importer; anything that gained one since 2026-10-08 is kept and reported. — The list was verified on `main` at planning time.

## Clarifications

## Non-goals

- Unused functions inside files that stay (next task).
- Unreachable screens (separate task).
- Adding an error boundary to the app (none exists today; separate decision).

## Context

The audit counted about 345 test cases in these files. The app has no error boundary, so deleting the unused ErrorBoundary component changes nothing a user can see. `utils/retry` uses the retry config in `types/error`.

## Implementation work

- [ ] Every listed file and its test file is deleted, and barrels no longer export them — proven by `npm run typecheck` and `npm run lint`
- [ ] `types/error` keeps only what production code uses — proven by `npm run typecheck`
- [ ] The app still builds and every remaining test passes — proven by `npm run check:code`

## Acceptance criteria

- [ ] `npm run check:code` passes.
- [ ] A search on the branch finds no remaining reference to any deleted file or export outside `docs/` and `plans/`.
- [ ] `docs/usage/test-audit.md` section 7 marks these files as removed.
