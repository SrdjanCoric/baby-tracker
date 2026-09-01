# Task 0089: Respect stored sleep type across sleep statistics and charts

**Branch**: `feature/respect-stored-sleep-type-in-sleep-statistics`
**Depends on**: none
**Source**: Conversation 2026-08-28 (production-data bug report, baby Sofija) · **User stories**: As a parent, the sleep statistics I see must match the sleep types I confirmed or logged, so a sleep I marked "back to sleep" never appears as a phantom nap.

## What to build

Sleep statistics and sleep-pattern charts classify every completed sleep by its stored `type`
instead of re-deriving the type from clock time, and the nap schedule attributes each nap to the
calendar day of its start — the same day daily totals use.

### Background (confirmed defect)

The sleep summary showed "Nap 4 — 3/7 days" although no day had a recognizable 4th nap. Verified
against production data (7-day window 2026-08-21..27, day window 07:00–21:00):

1. `calculateSleepSummary` in `src/utils/sleep-patterns.ts` ignores the stored `type` and
   reclassifies every sleep with `classifySleepByTimeRange` (main loop and the `nightSleeps`
   filter). A sleep 06:12–08:32 stored as `night` — the user explicitly answered "back to sleep"
   in the morning confirmation, which persists `type: "night"` plus
   `morningClassification: "confirmed_night_continuation"` — was reclassified as a nap.
2. The nap schedule keys each nap by its first segment's *sleep-day* key, so a nap starting
   before `dayStartHour` is attributed to the previous day's schedule, while daily totals key the
   same nap by *calendar* day. The reclassified 06:12 sleep therefore became a phantom "Nap 4" on
   the previous day.

The stored `type` is already the correct source of truth: at timer stop the app stores the user's
morning-confirmation answer when given, otherwise the `classifySleepByTimeRange` result; manual
entries and edits store the user's explicit choice. So reading the stored type preserves the
automatic classification as the fallback and only stops discarding user corrections.

### Decisions

- Stats and charts use stored `sleep.type`; no time-based reclassification in statistics paths.
- Naps belong to the calendar day of their start ("first nap is always for the calendar day") —
  nap schedule and daily totals must agree.
- Explicitly out of scope: no minimum-duration noise filter for short naps; no change to how the
  type is derived and stored at logging time.

## Implementation work

- [ ] `calculateSleepSummary`: classify each sleep by stored `type` (main loop and the
      `nightSleeps` filter for bedtime/wake/night-waking metrics); remove the
      `classifySleepByTimeRange` calls there (tdd skill, test-first).
- [ ] `calculateSleepSummary`: key nap-schedule slots by the calendar day of the nap's start
      (`localDateKey`), matching daily-total keying.
- [ ] `buildDayViewData` and `buildWeekViewData`: block `type` (nap/night coloring) comes from the
      stored `type`, not `classifySleepByTimeRange`.
- [ ] `buildDailySleepBars`: attribute each day-boundary segment's seconds to the night/nap bucket
      from the sleep's stored `type` (segments still split per day for totals), not from
      per-segment clock classification.

## Acceptance criteria

- [ ] A sleep 06:12–08:32 stored as `night` with `dayStartHour` 7 stays night everywhere: counts
      toward night sleep and wake-time averages, never appears in the nap schedule or nap counts,
      and renders night-colored in day/week charts and daily bars.
- [ ] A sleep stored as `nap` starting before `dayStartHour` is attributed to its own calendar day
      in the nap schedule; nap schedule and daily nap totals never place the same nap on
      different days.
- [ ] Regression test reproducing the reported scenario (three ordinal-4 contributions of which
      one was a reclassified stored-night sleep keyed to the prior day) shows no phantom nap slot
      after the fix.
- [ ] Summary fix holds for 7-, 14-, and 30-day periods (same code path, covered by at least one
      non-7-day test).
- [ ] Existing sleep-patterns and SummaryView test suites pass.
