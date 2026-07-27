# Task 0029: Warn and safely calculate overlapping manual sleep

**Branch**: `feature/warn-union-overlapping-manual-sleep`
**Depends on**: 0028
**Source**: Production sleep diagnosis and talk-it-through session 2026-07-26 · **User stories**: caregivers are warned before logging past sleep over an existing session; caregivers may deliberately continue; overlapping records do not double-count or shorten derived sleep

## What to build

Add a non-blocking overlap check to the Log Past Sleep workflow. When the proposed interval intersects an existing completed sleep for the selected baby, show a localized warning with Cancel and Continue anyway. Cancel leaves data unchanged; Continue anyway preserves both raw records and completes the ordinary durable add flow.

Because overlap remains permitted, prediction and statistics preprocessing must treat overlapping records as one interval from the earliest start to the latest end. It must not double-count overlap or shorten a longer sleep when a contained record ends earlier. Preserve raw records and existing live-timer household locking. Do not automatically delete, merge, or rewrite persisted sessions.

This task follows 0028 to serialize changes to the shared sleep-processing module.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`

- [x] Reuse or repair the repository's existing sleep duplicate-detection and confirmation patterns instead of creating an inconsistent warning path; prove with lint and typecheck.
- [x] Test interval overlap by start and end boundaries, containment, partial overlap, adjacency, Cancel, Continue anyway, and downstream union calculations.

## Implementation work

- [x] Test-first, extend completed-sleep duplicate detection to compare full intervals rather than only start-time proximity.
- [x] Wire the check into Log Past Sleep using the selected baby's current completed sleeps.
- [x] Add localized Cancel and Continue anyway warning copy; Cancel must not save, while Continue must execute the normal durable add exactly once.
- [x] Correct sleep preprocessing so overlapping intervals use the maximum end time and their union is counted once.
- [x] Preserve existing below-threshold continuation semantics for non-overlapping sessions and existing live-timer lock behavior.
- [x] Run focused duplicate-detection, manual-entry component, and sleep-processing tests, then canonical lint and typecheck.

## Acceptance criteria

- [x] A manual sleep intersecting an existing completed sleep shows a non-blocking warning.
- [x] Cancel writes nothing, and Continue anyway stores the proposed sleep once without altering the existing record.
- [x] Two partially overlapping intervals contribute only their union to predictions and statistics.
- [x] A contained overlap cannot shorten the containing sleep.
- [x] Adjacent non-overlapping sessions are not reported as overlaps.
- [x] Live-timer locking and persisted raw sleep history are unchanged.

## Completion record

### Implementation

- `app/sleep/manual.tsx` checks the proposed completed interval against the selected baby's completed sleep records before calling the existing `addSleep` path.
- `src/services/duplicate-detection.ts` uses strict interval intersection for completed sleeps, so touching endpoints remain adjacent rather than overlapping.
- `src/components/DuplicateConfirmationDialog.ts` and all nine locale files provide the overlap-specific warning and Continue anyway action.
- `src/utils/sleep-intervals.ts` computes a non-mutating interval union. Prediction and statistics paths use it while persisted records remain separate.
- The sleep context and timer-lock services were not changed. The manual component test confirms that an in-progress timer is excluded from the completed-sleep warning.

No product, architecture, database, or security decision was needed beyond the task contract.

### TDD evidence

Observed RED then GREEN for each behavior slice:

- `npx vitest run src/services/duplicate-detection.test.ts`: partial completed overlap failed because no candidate was returned, then passed after interval comparison.
- `npx vitest run src/utils/__tests__/sleepPredictions.test.ts`: a contained interval shortened the result, then passed after maximum-end merging.
- `npx vitest run src/utils/sleep-patterns.test.ts`: day totals, summary averages, and daily bars initially double-counted overlap, then passed with interval-union preprocessing.
- `npx vitest run src/utils/statistics.test.ts`: rolling and general sleep totals initially double-counted overlap, then passed with union preprocessing.
- `npx jest app/sleep/manual.component.test.tsx --runInBand`: Cancel initially saved without an alert, and the generic dialog copy failed the overlap-copy assertion. Both passed after wiring the existing confirmation path and specialized copy.

### Repository guidelines and review

Loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, and `references/02-testing.md` in implement and review modes. Evidence consists of strict TypeScript, warning-free ESLint, deterministic Vitest/Jest coverage of the declared boundaries, and the canonical non-device check.

Task review against `main` at `3d1a293449b3733f2b079ff9734ec0e09ffc2cc3` found no standards, spec, or bug findings. Security was skipped because the diff does not touch a trust boundary. No remediation pass or accepted risk was needed.

### Documentation

Updated the README **Sleep Predictions** section to describe the manual overlap warning, preservation of both entries, and interval-union calculations. The write-well audit completed in one pass with no remaining findings.

### Proof

- Focused unit proof: 307 tests passed across duplicate detection, predictions, sleep patterns, and statistics.
- Focused component proof: 3 manual-entry tests passed for Cancel, Continue anyway, record preservation, exactly-once add, and in-progress timer exclusion.
- Locale proof: all locale JSON parsed and all nine locale files contained the three overlap-warning keys.
- `npm run check:code` passed: lint, typecheck, 2,287 unit tests, 647 component tests, 103 security tests, 244 sync tests, and 49 CI-contract tests.
- No separate manual verification is required. The component test drives both native Alert actions through the screen's public interface, and this task does not change native provisioning or device-only behavior.
