# Task 0065: Add the Nap Schedule panel

**Branch**: `feature/add-nap-schedule-panel`
**Depends on**: 0064
**Source**: `plans/decision-maps/unified-timer-contract/decisions/resolved/014-per-nap-slot-statistics.md`
(resolved 2026-08-04) · **User stories**: As a caregiver, I want to see how long each individual nap
of the day usually runs and when it usually starts, so that I can read my baby's nap routine rather
than a single blended average.

## What to build

A `Nap Schedule` panel on the sleep summary screen, sitting below the existing `Averages` panel,
holding one row per nap slot.

A **slot** is the nth nap started within a sleep-day, counted forward from the start of the day. Each
row shows the average duration and the average start time for that slot, and carries the number of
days the slot actually occurred in the form `4 of 5 days`.

Both averages for a slot divide by that slot's own occurrence count — never by the number of napping
days and never by the range length. Average start time uses the existing `circularTimeMean`, so start
times straddling an hour boundary average correctly.

A row renders only when its slot occurred **at least 3 times** *and* on **at least 30% of the napping
days** in the range. Both bounds are inclusive. When no slot clears both tests, the panel does not
render at all.

The panel serves all three ranges (7, 14, 30) on both surfaces that render `SummaryView`: Statistics
under Sleep → Summary, and the Sleep Patterns tab.

### Why these rules

Chronological numbering matches how the caregiver already describes the day and needs no
per-age configuration. The count floor binds on the 7-day range, where 3 of 5 napping days is already
meaningful; the share test binds on the 30-day range, where 3 occurrences out of 24 napping days
would otherwise render a row that reads as routine. Dividing each slot by its own occurrence count
keeps a slot's average from being dragged toward zero by the days it did not happen.

### Accepted consequences

- On a day the first nap is skipped, the midday nap becomes slot 1 and pulls that row's average start
  time later. This is accepted; the per-row occurrence count shows the reader how large the sample
  behind each row was.
- Rows appear and disappear as the range changes, so the same baby can show three rows over 7 days
  and two over 30.
- Nothing caps the number of slots, so a baby with six naps a day renders six rows if each clears
  both tests.

### Current state of the computation

`calculateSleepSummary` in `src/utils/sleep-patterns.ts` builds a per-day structure and increments a
per-day nap count when `classifySleepByTimeRange` returns `nap`, visiting naps in the order they
start; `splitSleepAtDayBoundary` already assigns a nap to a day. No per-nap start time or per-day nap
ordinal is retained today, so the slot data must be accumulated in that same loop. `circularTimeMean`
already exists in the same module and is used for the bedtime and wake-time averages.

`AverageRow` in `src/components/sleep-patterns/MetricCard.tsx` renders a two-column label-and-value
row. A three-column row carrying duration and start time is new.

Task 0064 extends the same `SleepSummary` contract, the same `calculateSleepSummary` function, the
same `SummaryView` screen, and the same `sleepPatterns` locale namespace across the nine locale
files. Build on its merged output; do not reopen its decisions.

### Reference

Approved mock: `plans/decision-maps/unified-timer-contract/prototypes/nap-stats-mock.html`, markers B
and C. Marker B draws the row layout and the column headers (`Nap` · `Length` · `Starts`); marker C
gives the appearance test as a table of worked cases.

## Implementation work

**Implementation classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**:
yes. The task changes production calculation and rendering behavior, component and utility tests, and
locale resources.

- [x] Extend the `SleepSummary` contract with the per-slot data the panel needs — for each slot, its
      ordinal, average duration in seconds, average start time, and occurrence count — plus the
      napping-day count the share test divides by. Leave every existing field untouched.
- [x] Accumulate per-slot nap durations and start times inside the existing per-day loop in
      `calculateSleepSummary`, assigning each nap its slot from the order it starts within its
      sleep-day. Use the day assignment `splitSleepAtDayBoundary` already produces.
- [x] Compute each slot's average duration and average start time over that slot's own occurrence
      count, using `circularTimeMean` for the start time.
- [x] Apply the appearance test in the computation: keep a slot only when its occurrence count is at
      least 3 **and** its share of napping days is at least 30%, both inclusive. Return an empty slot
      list when none qualifies.
- [x] Add a three-column row component for the panel alongside the existing `AverageRow`, showing the
      slot label with its occurrence count, the average duration, and the average start time.
- [x] Render the `Nap Schedule` panel in `SummaryView` below the `Averages` panel, with the column
      headers from the mock, and render nothing when the slot list is empty.
- [x] Format durations and clock times with the existing shared time helpers, honoring the
      `timeFormat` `SummaryView` already receives.
- [x] Add the panel title, slot label, the two column headers, and the occurrence-count keys under
      `sleepPatterns` to all nine locale files (`de`, `en`, `es`, `es-ES`, `fr`, `it`, `pt-BR`,
      `pt-PT`, `sr`), with real translations rather than copies of the English string.

## Acceptance criteria

- [x] Over a range where every day holds the same nap count, each slot's average duration and average
      start time are computed over all those days, and each row's occurrence count equals the range's
      napping-day count.
- [x] Over a range where one day skips its first nap, that day's later naps shift up a slot, and the
      resulting slot averages and occurrence counts reflect the shift.
- [x] A slot at exactly 3 occurrences and exactly 30% of napping days renders — both bounds are
      inclusive.
- [x] A slot passing the share test but failing the count test does not render, and a slot passing
      the count test but failing the share test does not render.
- [x] Average start time is correct for a slot whose start times straddle an hour boundary, proved
      against `circularTimeMean` semantics.
- [x] A component test asserts a failing slot renders no row, that the panel is absent entirely when
      no slot qualifies, and that each rendered row shows its occurrence count.
- [x] A locale test asserts every new key is present and non-empty in all nine locales and differs
      from English in the non-English ones, following the existing per-feature locale-test pattern.
- [x] `Avg Naps/Day`, `Avg Nap Duration`, `Avg Nap Time`, `Avg Total Sleep`, and nap-versus-night
      classification are unchanged, proved by the existing `calculateSleepSummary` tests continuing
      to pass unmodified.

## Implementation evidence

- Calculation RED/GREEN: the first slot assertion failed on a missing `napSchedule`, then passed with
  per-slot duration/start accumulation and filtering (`unit-slot-red.log`, `unit-slot-green.log`). A
  second RED/GREEN cycle separated the new sleep-day slot grouping from Task 0064's unchanged
  calendar-day nap metrics (`unit-sleep-day-red.log`, `unit-sleep-day-green.log`).
- Rendering RED/GREEN: the component could not find the `Nap Schedule` panel before it was added;
  the completed component file passes all 5 tests, including a filtered row, occurrence divisor,
  shared duration/time formatting, and the absent-panel state (`component-schedule-red.log`,
  `component.log`).
- Localization RED/GREEN: all nine locales initially failed on missing keys, then passed with
  localized panel, header, slot, and occurrence copy (`locales-red.log`, `locales-green.log`).
- Focused pre-review proof: the sleep-summary suite passes 113 utility tests and 13 component tests;
  all 9 locale cases, targeted warning-free lint, repository typecheck, and `git diff --check` pass.
  Logs are retained in `/tmp/agent-workflows/e2f8af45fd34/da1ea81f56d7`.
- Current-code reconciliation: Task 0064 intentionally keeps legacy nap metrics on calendar dates.
  Task 0065 therefore uses a separate `splitSleepAtDayBoundary` sleep-day counter for slot ordering
  and its appearance-test denominator, leaving every existing summary field's behavior unchanged.

## Non-goals

- No change to `Avg Naps/Day` or `Avg Nap Duration`, both of which stay in the `Averages` panel
  computed as they are today, and no change to the `Avg Nap Time` card from Task 0064.
- No wake-window figure between slots. No chart. No per-slot trend over time. No age-band comparison.
- No user control over the appearance thresholds.
- No upper bound on the number of slots. Whether newborns need one is recorded as open fog in the
  source decision and stays out of this task.
