# Task 0132: Save breast feeds, pumping and tummy time without resumed pauses

**Branch**: `feature/exclude-pauses-from-non-sleep-records`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: user request and conversation 2026-10-12 · **User stories**: a mother nurses 1 minute right, pauses 3 minutes for a diaper, nurses 5 minutes left and stops; the saved feed is 6 minutes with right 1 and left 5, and the app suggests right next time.

## What to build

When a breast feeding, pumping or tummy time timer is stopped, the saved entry's duration is the time between start and end minus every pause the caregiver resumed from. The entry also stores that pause total in a new `pausedSeconds` field (`paused_seconds` column on the feedings, pumping sessions and tummy time sessions tables). Sleep keeps today's rule: a resumed pause counts, and sleep entries get no pause field.

| Timer state at stop | Saved end | Saved duration | Saved pausedSeconds |
| --- | --- | --- | --- |
| Running, never paused | stop time | end − start | 0 |
| Running, paused earlier and resumed | stop time | end − start − resumed pauses | resumed pauses |
| Paused right now | the pause moment | pause moment − start − earlier resumed pauses | earlier resumed pauses (the open pause is not billed and not stored) |
| Manual entry | as entered | as entered | 0 |
| Entry saved before this change | unchanged | unchanged | absent, read as 0 |

A breast feed's left and right seconds are the time spent on each side while the timer was running. A resumed pause is added to neither side (today it is added to the side the feed finished on). The side suggestion therefore compares nursing time only.

The pause total survives sync: it is written to the server, read back from the server, exported and imported with the entry, and present on realtime updates. Everything that shows or sums a saved duration (timeline rows, daily summaries, statistics, CSV, PDF report, widget tiles) shows the new value without change.

## Decided

- Sleep is the only timer where a resumed pause counts. — Owner decision 2026-10-12; a sleeping baby is still asleep while the parent is away from the phone, a nursing baby is not.
- The pause total is stored on the entry, never recomputed from the timer. — The edit screens (later tasks) must show it after the timer is gone.
- Stopping while paused still ends the entry at the pause moment. — Unchanged rule; an open pause bills nothing.
- Old entries keep their stored duration and are not backfilled. — No way to know whether a gap was a pause.
- Migration adds one nullable integer column to three tables, no backfill, no default. — Smallest change; absent reads as 0.

## Clarifications

## Non-goals

- The running readout, Home card, Live Activity, widget or Watch (Task 0134).
- Edit screens and manual logging (Tasks 0135, 0136, 0137).
- Pumping minutes per side (Task 0133).
- Sleep in any way.

## Context

The shared timer lifecycle computes every saved duration in one function that today ignores the pause total it is handed. Each type's adapter builds the saved entry from the timer payload; the feeding adapter is the one adding resumed pauses to a side. The pause total already lives on the running timer and in the server lock's timer data; nothing saves it on an entry. Existing tests across adapters, providers and consumers assert the opposite rule for the three types and must flip. The usage doc `docs/usage/timers.md` has one line stating the pause rule; it must now state both rules.

## Implementation work

- [ ] The feeding, pumping and tummy time adapters save the table above; the sleep adapter is unchanged — proven in `src/services/timer-adapters/feeding-timer-adapter.test.ts`, `src/services/timer-adapters/pumping-timer-adapter.test.ts`, `src/services/timer-adapters/tummy-time-timer-adapter.test.ts`, `src/services/timer-adapters/sleep-timer-adapter.test.ts`
- [ ] A breast feed's sides exclude the pause, and the mother's example suggests right next — proven in `src/utils/feeding-sessions.test.ts`
- [ ] Every provider's saved entry follows the table, including the paused-now row — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Consumers of saved durations show the new value — proven in `src/__tests__/recorded-timer-duration-consumers.integration.test.tsx`
- [ ] `pausedSeconds` round-trips through server sync, realtime, CSV export and import, and old rows read as 0 — proven in `src/services/activity-sync-lossless.test.ts` and `src/utils/csv-generator.test.ts`
- [ ] Migration `072` adds `paused_seconds` to the three tables.
- [ ] `docs/usage/timers.md` states the sleep rule and the other rule, each marked with its test.

## Human checkpoints

- [ ] [confirm-db] Apply migration 072 (three nullable columns, no data change) to the hosted project before the PR merges.

## Acceptance criteria

- [ ] Every row of the table has a passing test for each of the three types.
- [ ] No sleep test changes.
- [ ] `npm run check:code` passes.
