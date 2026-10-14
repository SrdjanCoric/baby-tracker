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

- Q: The app has no reader for its own CSV, so what does "survive CSV export and import" mean? — A (owner, 2026-10-13): The sides survive sync and realtime. CSV export adds two columns to the pumping file, `Left (seconds)` and `Right (seconds)`, empty when a side is absent. Import of the app's own CSV is out of scope.
- Q: Nara and Huckleberry exports give pump volume per side and one duration, never time per side. How do imported pump rows fill the sides? — A (owner, 2026-10-13): When only one side has volume and a duration is known, that side gets the whole duration and the other side stays absent. When both sides have volume, or no duration is known, both sides stay absent. Existing import behaviour must not break. Proven in `src/services/import/nara-reader.test.ts` and `src/services/import/huckleberry-reader.test.ts`.
- Q: Widget and Lock Screen pauses go through the server function `toggle_timer_pause`, which banks per-side seconds for breast feeds only. How does pumping keep per-side time across a server-side pause? — A (owner, 2026-10-13): Copy breast feeding fully. Migration 076 adds the two columns and replaces `toggle_timer_pause` so pumping banks per-side seconds on pause and resume exactly as feeding does. The [confirm-db] checkpoint therefore covers the function replacement as well as the two columns. Proven by SQL vectors run with `npm run test:sql`.
- Q: Should the widget and Watch summary function (`get_baby_activity_snapshot`) return the per-side seconds? — A (owner, 2026-10-13): No. Neither the widget nor the Watch shows a pumping side today, so the function stays unchanged.
- Stale references corrected from code (2026-10-13): migrations 073–075 already exist, so the migration is `076`. Pumping timeline rows are built in `app/(tabs)/timeline.tsx`, so the row test lives in `app/(tabs)/timeline.component.test.tsx`, not `src/utils/timeline.test.ts`.

## Non-goals

- Editing or manually logging the sides (Task 0136).
- Suggesting a next pumping side.
- Statistics by side for pumping.

## Context

The pumping timer already records which side is active and lets the caregiver switch; it does not bank time per side. The feeding context and adapter hold the working model to copy: accumulated seconds per side on the running timer, the current side's start moment, banking on switch and on pause. The pumping timer's lock payload on the server carries the timer data as JSON, so the new per-side fields travel with it without a schema change there.

## Implementation work

- [x] Switching, pausing, resuming and stopping the pumping timer bank per-side seconds following the table — proven in `src/services/timer-adapters/pumping-timer-adapter.test.ts` and `app/pumping/index.component.test.tsx`
- [x] Per-side seconds survive the running timer's local persistence and the server lock, including a stop issued from another phone — proven in `src/services/pumping-storage.test.ts` and `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [x] Per-side seconds round-trip through sync, realtime, CSV export and import — proven in `src/services/activity-sync-lossless.test.ts` and `src/utils/csv-generator.test.ts`
- [x] The timeline pumping row shows the side split when both sides have time — proven in `app/(tabs)/timeline.component.test.tsx`
- [x] Migration `076` adds the two columns and replaces `toggle_timer_pause`.

## Human checkpoints

- [x] [confirm-db] Apply migration 076 (two nullable columns, no data change, plus the `toggle_timer_pause` replacement) to the hosted project and run `npm run test:sql` before the PR merges.

## Acceptance criteria

- [ ] Every row of the table has a passing test.
- [ ] `npm run check:code` passes.

- skipped (minor): PS-5 — moving the start time later after two or more side switches subtracts the span from the wrong side — owner: matches feeding behaviour
- skipped (minor): PS-6 — per-segment flooring loses up to one second per switch or pause — owner: matches feeding behaviour
