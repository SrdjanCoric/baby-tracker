# Task 0009: Fix stale preference-driven UI and exports

**Branch**: `feature/reactive-preference-derived-ui`
**Depends on**: none
**Source**: production bug hunt 2026-07-14 · **User stories**: changing units, language, sleep day boundaries, theme activity colors, newborn nap settings, or timer-alert settings immediately updates every affected screen, statistic, report, export, and callback

## What to build

Remove the confirmed stale-closure and stale-memo defects reported by the hooks analyzer in production workflows. Preference-driven calculations and callbacks must use current values without requiring navigation, reload, or an unrelated state change. Cover dashboard labels, timeline quantities, health labels, exports/reports, sleep and diaper statistics, baby selection metadata, newborn nap settings, and timer alerts.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Resolve missing hook dependencies by correcting state flow, not by suppressing the analyzer.
- [ ] Add behavior-focused tests for preference changes; do not add tests that merely assert dependency arrays.
- [ ] Keep naming and equivalent derived-view patterns consistent.

## AFK tasks

- [ ] Add failing tests for the user-visible stale cases that can be isolated at unit/component level.
- [ ] Correct every current `react-hooks/exhaustive-deps` missing-dependency warning in production code, restructuring unstable values where necessary.
- [ ] Verify changes to units, translations, day boundaries, colors, selected baby, nap opt-in, and timer-alert enablement take effect immediately.
- [ ] Remove only analyzer suppressions made obsolete by the fixes; preserve intentional, documented exceptions.

## Acceptance criteria

- [ ] Current unit settings are used by timeline display, reports, and exports immediately after change.
- [ ] Current translation functions and labels are used by dashboard and health actions after language change.
- [ ] Sleep/day-boundary and diaper color changes recompute statistics without unrelated state changes.
- [ ] Disabling timer alerts prevents stale callbacks from scheduling new alerts.
- [ ] Baby selection and newborn nap setting callbacks use current state and metadata.
- [ ] ESLint reports no missing-dependency warnings in production code.
- [ ] Focused tests, typecheck, and lint pass.
