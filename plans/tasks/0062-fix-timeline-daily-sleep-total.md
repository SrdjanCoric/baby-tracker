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

- [ ] Add failing tests for `calculateDailySummary` covering: overlapping entries, duplicated
      entries, adjacent entries that split a night, a sleep crossing the day-start boundary,
      non-overlapping entries, a configured `dayEndHour` other than 19, and a running sleep.
      Assert the sleep total against `buildDayViewData` totals for the same fixtures.
- [ ] Union completed sleep intervals in `calculateDailySummary` before segmenting, so that the
      total and the nap and night counts all derive from the unioned set.
- [ ] Thread the configured `dayEndHour` from the Timeline screen through `DailySummaryCard` into
      `calculateDailySummary`, keeping 19 as the fallback when no wake-window config is loaded.
- [ ] Include the active sleep timer in the Timeline daily total using the same synthetic-entry
      approach the Statistics sleep container uses, including its baby binding and paused-time
      handling.
- [ ] Add or extend `DailySummaryCard` component tests proving the card renders the deduplicated
      total and the boundary-aware nap and night counts.

## Acceptance criteria

- [ ] For a day containing overlapping or duplicated sleep entries, the Timeline summary card total
      equals the Statistics day-view total for that day.
- [ ] Nap and night counts on the card count each unioned sleep once.
- [ ] With `dayEndHour` configured away from 19, an evening sleep is classified on the Timeline card
      the same way the Statistics screens classify it.
- [ ] While a sleep timer is running, the Timeline total for the current day includes the elapsed
      unpaused time, matching the Statistics day view.
- [ ] Days with no overlapping entries report exactly the totals they report today, proving the fix
      changes only the overlapping case.
- [ ] `calculateDailySummary` regression tests pass and cover every case listed above.
