# Task 0009: Fix stale preference-driven UI and exports

**Branch**: `feature/reactive-preference-derived-ui`
**Depends on**: none
**Source**: production bug hunt 2026-07-14 · **User stories**: changing units, language, sleep day boundaries, theme activity colors, newborn nap settings, or timer-alert settings immediately updates every affected screen, statistic, report, export, and callback

## What to build

Remove the confirmed stale-closure and stale-memo defects reported by the hooks analyzer in production workflows. Preference-driven calculations and callbacks must use current values without requiring navigation, reload, or an unrelated state change. Cover dashboard labels, timeline quantities, health labels, exports/reports, sleep and diaper statistics, baby selection metadata, newborn nap settings, and timer alerts.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Resolve missing hook dependencies by correcting state flow, not by suppressing the analyzer.
- [x] Add behavior-focused tests for preference changes; do not add tests that merely assert dependency arrays.
- [x] Keep naming and equivalent derived-view patterns consistent.

## AFK tasks

- [x] Add failing tests for the user-visible stale cases that can be isolated at unit/component level.
- [x] Correct every current `react-hooks/exhaustive-deps` missing-dependency warning in production code, restructuring unstable values where necessary.
- [x] Verify changes to units, translations, day boundaries, colors, selected baby, nap opt-in, and timer-alert enablement take effect immediately.
- [x] Remove only analyzer suppressions made obsolete by the fixes; preserve intentional, documented exceptions.

## Acceptance criteria

- [x] Current unit settings are used by timeline display, reports, and exports immediately after change.
- [x] Current translation functions and labels are used by dashboard and health actions after language change.
- [x] Sleep/day-boundary and diaper color changes recompute statistics without unrelated state changes.
- [x] Disabling timer alerts prevents stale callbacks from scheduling new alerts.
- [x] Baby selection and newborn nap setting callbacks use current state and metadata.
- [x] ESLint reports no missing-dependency warnings in production code.
- [x] Focused tests, typecheck, and lint pass.

## Implementation log

- Added every missing production hook dependency identified by ESLint, including unit, translation, theme-color, sleep-boundary, auth-profile, baby metadata, newborn setting, and timer-alert values.
- Stabilized sleep goal confirmation options, widget activity toggles, and growth unit conversion so preference changes do not create avoidable callback or memo churn.
- Added component regressions for live unit changes in CSV/PDF generation, sleep reclassification after day-boundary changes, and timer-alert disablement without remounting; repaired the home component test isolation so the complete component suite runs.
- Review: no blocker, major, minor, or security findings; security lens skipped because the diff does not change a trust boundary.
- Verification: `npm run typecheck`; `npm run lint` (0 errors, 64 pre-existing non-missing warnings owned by task 0010); ESLint JSON audit (`NO_MISSING_DEPENDENCY_WARNINGS`); `npm run test:unit` (98 files, 2,208 tests); `npm run test:component` (44 suites, 533 tests).
