# Task 0133: Bank pumping minutes per side while the timer runs

**Branch**: `feature/pumping-minutes-per-side`
**Depends on**: 0132
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-12 · **User stories**: a parent pumps 12 minutes on the left, switches, pumps 8 on the right and stops; the saved session says left 12, right 8, 20 minutes.

## What to build

A pumping entry gains `leftDurationSeconds` and `rightDurationSeconds` (`left_duration_seconds`, `right_duration_seconds` on the pumping sessions table), with the same meaning as on a breast feed: seconds the timer ran on that side. Switching sides on the running pumping timer banks the time spent so far on the side being left, exactly as the feeding timer does. "Both" banks the time on both sides at once. A resumed pause is added to neither side. Stopping while paused banks nothing after the pause moment.

| Timer | Saved sides |
| --- | --- |
| Ran only on the left | left = duration, right absent |
| Left then right | each side its own running time |
| "Both" the whole time | left = right = duration |
| Mixed, with a resumed pause | sides exclude the pause; left + right + pause = end − start (unless "Both" was used) |
| Manual entry | both absent unless the form supplies them (Task 0136) |
| Entry saved before this change | both absent |

The side picker on the running pumping screen keeps its look. The timeline row for a pumping session shows the side split the way a breast feed's row does when both sides have time. The sides survive sync, realtime, CSV export and import.

## Decided

- Pumping copies the breast feed's per-side model rather than inventing its own. — Owner decision 2026-10-12; the edit screen (Task 0136) is to match the breast feed's.
- Migration adds two nullable integer columns, no backfill. — Absent means "not tracked".

## Clarifications

## Non-goals

- Editing or manually logging the sides (Task 0136).
- Suggesting a next pumping side.
- Statistics by side for pumping.

## Context

The pumping timer already records which side is active and lets the caregiver switch; it does not bank time per side. The feeding context and adapter hold the working model to copy: accumulated seconds per side on the running timer, the current side's start moment, banking on switch and on pause. The pumping timer's lock payload on the server carries the timer data as JSON, so the new per-side fields travel with it without a schema change there.

## Implementation work

- [ ] Switching, pausing, resuming and stopping the pumping timer bank per-side seconds following the table — proven in `src/services/timer-adapters/pumping-timer-adapter.test.ts` and `app/pumping/index.component.test.tsx`
- [ ] Per-side seconds survive the running timer's local persistence and the server lock, including a stop issued from another phone — proven in `src/services/pumping-storage.test.ts` and `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Per-side seconds round-trip through sync, realtime, CSV export and import — proven in `src/services/activity-sync-lossless.test.ts` and `src/utils/csv-generator.test.ts`
- [ ] The timeline pumping row shows the side split when both sides have time — proven in `src/utils/timeline.test.ts`
- [ ] Migration `073` adds the two columns.

## Human checkpoints

- [ ] [confirm-db] Apply migration 073 (two nullable columns, no data change) to the hosted project before the PR merges.

## Acceptance criteria

- [ ] Every row of the table has a passing test.
- [ ] `npm run check:code` passes.
