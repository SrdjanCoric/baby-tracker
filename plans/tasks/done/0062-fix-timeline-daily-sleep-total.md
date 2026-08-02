# Task 0062: Fix the Timeline daily sleep total

**Branch**: `feature/fix-timeline-daily-sleep-total`
**Depends on**: none
**Source**: Conversation 2026-08-02 (Timeline sleep total diagnosis) · **User stories**: As a caregiver, I want the Timeline daily summary sleep total to report the same amount of sleep the Statistics screens report for that day, so that I can trust either screen.

## What to build

The Timeline daily summary card reports the same sleep total, nap count, and night count for a
selected day as the Statistics sleep screens report for that same day.

Three defects produce today's divergence, all in the Timeline daily-summary path
(`calculateDailySummary` in `src/utils/timeline.ts` and its caller `DailySummaryCard`):

1. **Overlapping sleeps are counted twice.** Every Statistics path unions completed sleep
   intervals through `unionCompletedSleepIntervals` before summing segments —
   `buildDayViewData`, `calculateSleepSummary`, `buildDailySleepBars`, and the statistics
   aggregates. `calculateDailySummary` iterates the raw sleep entries instead. Task 0029 added
   the union for the sleep-pattern and statistics surfaces; the Timeline surface was missed.
   Overlaps are permitted by design — the app only warns before logging one — so duplicate
   phone/Watch entries and edited entries inflate the Timeline total on any day they occur.

   Measured against fixtures: two entries covering 10:00–11:30 and 10:05–11:35 yield a Timeline
   total of 180 minutes against a Statistics total of 95 minutes. Non-overlapping, adjacent, and
   cross-midnight fixtures already agree, so day-boundary segmentation is not at fault; only the
   missing union is.

   The same raw iteration inflates `napCount` and `nightSleepCount`, which dedupe by entry id and
   therefore still count each overlapping entry separately.

2. **The configured day/night boundary is ignored.** `DailySummaryCard` has no `dayEndHour` prop,
   so `calculateDailySummary` always falls back to hour 19 while the Statistics screens pass
   `wakeWindowConfig.dayEndHour`. This does not change the total — splitting at that boundary
   produces two segments carrying the same sleep-day key — but it misclassifies naps as night
   sleep, and the reverse, whenever the caregiver has moved the boundary away from 19.

3. **A running sleep is missing from today's total.** The Statistics container injects a synthetic
   entry for the active timer so the current sleep is reflected in the day. `calculateDailySummary`
   drops entries without an end, because `splitSleepAtDayBoundary` returns no segments for them, so
   the Timeline total lags for as long as a sleep is running. Match the Statistics behavior.

`calculateDailySummary` has no test coverage today. Regression tests are part of this task.

Leave `buildWeekViewData` alone: it produces positioned blocks for the week overlay rather than a
reported daily total, and changing its block set would change what the overlay draws.

## Implementation work

- [x] Add failing tests for `calculateDailySummary` covering: overlapping entries, duplicated
      entries, adjacent entries that split a night, a sleep crossing the day-start boundary,
      non-overlapping entries, a configured `dayEndHour` other than 19, and a running sleep.
      Assert the sleep total against `buildDayViewData` totals for the same fixtures.
      → `src/utils/timeline.test.ts` (10 cases, each asserting parity with `buildDayViewData`).
- [x] Union completed sleep intervals in `calculateDailySummary` before segmenting, so that the
      total and the nap and night counts all derive from the unioned set.
      → `src/utils/timeline.ts:120-138`.
- [x] Thread the configured `dayEndHour` from the Timeline screen through `DailySummaryCard` into
      `calculateDailySummary`, keeping 19 as the fallback when no wake-window config is loaded.
      → `app/(tabs)/timeline.tsx`, `src/components/timeline/DailySummaryCard.tsx`.
- [x] Include the active sleep timer in the Timeline daily total using the same synthetic-entry
      approach the Statistics sleep container uses, including its baby binding and paused-time
      handling.
      → new shared helper `src/utils/ongoing-sleep.ts`, used by the Timeline screen and by
      `SleepStatsContainer` (its inline copy was removed).
- [x] Add or extend `DailySummaryCard` component tests proving the card renders the deduplicated
      total and the boundary-aware nap and night counts.
      → `src/components/timeline/DailySummaryCard.component.test.tsx`.

## Acceptance criteria

- [x] For a day containing overlapping or duplicated sleep entries, the Timeline summary card total
      equals the Statistics day-view total for that day.
- [x] Nap and night counts on the card count each unioned sleep once.
- [x] With `dayEndHour` configured away from 19, an evening sleep is classified on the Timeline card
      the same way the Statistics screens classify it.
- [x] While a sleep timer is running, the Timeline total for the current day includes the elapsed
      unpaused time, matching the Statistics day view.
- [x] Days with no overlapping entries report exactly the totals they report today, proving the fix
      changes only the overlapping case.
- [x] `calculateDailySummary` regression tests pass and cover every case listed above.

## Decisions

- **Adjacent entries stay two sleeps.** The spec listed "adjacent entries that split a night" as a
  fixture without prescribing a count. `unionCompletedSleepIntervals` merges strict overlaps only
  (`sleepStart >= previousEnd` is treated as non-overlapping), so adjacent entries remain two
  unioned intervals — which is also what `buildDayViewData` and `calculateSleepSummary` report.
  The regression test asserts `nightSleepCount` 2.
- **A sleep straddling the boundary is classified once, as a whole.** Segmenting produced one nap
  segment and one night segment for a single 18:00–20:00 sleep with `dayEndHour` 19, so the card
  showed "Naps 1× / Night 1×" where the Statistics screens show one nap. Counts now come from
  `classifySleepByTimeRange` over the whole unioned interval; seconds still come from the day's
  segments.
- **The running sleep is emitted with a pause-adjusted start.** Every surface that totals sleep
  measures `endedAt - startedAt` and ignores `durationSeconds`, so subtracting pauses from
  `durationSeconds` alone left the total inflated — and because `totalPausedMs` only accumulates on
  resume (`src/contexts/sleep-context.tsx:257-268`), the total kept growing during an open pause.
  `buildOngoingSleepEntry` now shifts `startedAt` by `totalPausedMs` plus any open pause and keeps
  `endedAt` at now, matching the existing `effectiveStartTime` idiom at `sleep-context.tsx:836`.
  The day-view block still reaches the current time, and the interval carries unpaused time only.
  This corrects the same defect on the Statistics surfaces, which share the helper.
- **The Timeline refresh tick is gated on a running timer.** `useTimeRefresh` now accepts `null` to
  stop refreshing; the Timeline passes `null` unless a sleep is running, so the screen no longer
  re-renders its whole list once a minute for nothing.
- **The summary unions a three-day window, not the whole history.** Timeline pagination can load
  months of entries; only sleeps overlapping [day − 1, day + 2) at the day-start hour can put
  seconds in the selected day, and any entry that would union with one of those overlaps the same
  window.

## Deferred

- **A stale active timer from a previously selected baby can be attributed to the new baby**
  (review finding BUG-3, minor). `ActiveSleepTimer` carries no `babyId`, so the ownership guard can
  only check the provider binding. On a local-only account with no household, switching babies while
  a timer runs leaves the previous baby's timer in state. This is pre-existing behavior shared with
  the Statistics sleep screens; fixing it means carrying the owning `babyId` on the timer, which is
  a context change outside this task. Worth its own task.
