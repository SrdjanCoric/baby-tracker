# Task 0064: Add the Avg Nap Time card

**Branch**: `feature/add-avg-nap-time-card`
**Depends on**: none
**Source**: `plans/decision-maps/unified-timer-contract/decisions/resolved/012-daily-nap-total-average.md`
(resolved 2026-08-04) · **User stories**: As a caregiver, I want to see how much my baby naps on a
day he naps, so that I can compare it against age guidelines.

## What to build

A new `Avg Nap Time` metric card on the sleep summary screen, showing total daytime nap seconds in
the selected range divided by the number of days in that range holding at least one nap.

Days with only an overnight logged, and days with nothing logged, are excluded from **both** halves
of the fraction. The card carries its divisor as a subtitle in the form `per napping day · 5 of 7`,
where the second number is the selected range length. It renders in a half-width slot below the
existing metric cards, and serves all three ranges (7, 14, 30) on both surfaces that render
`SummaryView`: Statistics under Sleep → Summary, and the Sleep Patterns tab.

### Why this divisor

Age guidelines state how much a baby naps on a day they nap. Dividing by days with any sleep logged
would count a night-only day as a zero-nap day — the same distortion that already stops
`avgTotalSleepSeconds` from answering the question. Dividing by every calendar day would read a gap
in logging as a drop in napping.

### Current state of the computation

`calculateSleepSummary` in `src/utils/sleep-patterns.ts` already accumulates `totalNapSeconds` from
`daysWithData`, but divides it by `totalNaps` to produce `avgNapDurationSeconds`, which is per nap,
not per day. `daysWithData` is filtered on `totalSeconds > 0` — any sleep — and its length feeds
`activeDays`, the divisor behind `avgTotalSleepSeconds`, `avgNightSleepSeconds`, and `avgNapsPerDay`.

The new metric needs its own day count, filtered on `napSeconds > 0`. `daysWithData` is a safe base
for that filter, because `napSeconds > 0` implies `totalSeconds > 0`.

### Reference

Approved mock: `plans/decision-maps/unified-timer-contract/prototypes/nap-stats-mock.html`, marker A.
The card sits in a `cardrow` with a spacer occupying the other half.

## Implementation work

**Implementation classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**:
yes. The task changes production calculation and rendering behavior, component and utility tests, and
locale resources.

- [x] Extend the `SleepSummary` contract with the new average (seconds) and the napping-day count
      that the subtitle needs, leaving every existing field untouched.
- [x] Compute both in `calculateSleepSummary`: sum nap seconds over days holding at least one nap,
      divide by the count of those days, and return `0` for the average and `0` for the count when
      the range holds no naps at all. Do not reuse `activeDays`.
- [x] Render the `Avg Nap Time` card in `SummaryView` in a half-width slot below the existing metric
      cards, with a spacer filling the other half, matching the mock.
- [x] Format the subtitle as `per napping day · <napping days> of <range length>`, taking the range
      length from the period `SummaryView` already receives. Do not add a new prop for it.
- [x] Add the card label and subtitle keys under `sleepPatterns` to all nine locale files (`de`,
      `en`, `es`, `es-ES`, `fr`, `it`, `pt-BR`, `pt-PT`, `sr`), with real translations rather than
      copies of the English string.

## Acceptance criteria

- [x] `calculateSleepSummary` over a range mixing napping days, night-only days, and empty days
      returns total nap seconds divided by the napping-day count only; the night-only and empty days
      change neither the numerator nor the divisor.
- [x] A range holding no naps returns `0` for the average and `0` for the napping-day count, and the
      card renders its divisor as `0 of 7`.
- [x] A nap spanning the day boundary contributes to the day that the existing
      `splitSleepAtDayBoundary` assigns it to, and its day counts as a napping day.
- [x] A component test asserts the card renders its divisor subtitle, and that its value differs
      from `Avg Total Sleep` on data where the two divisors diverge.
- [x] A locale test asserts both new keys are present and non-empty in all nine locales, and differ
      from English in the non-English ones, following the existing per-feature locale-test pattern.
- [x] `Avg Total Sleep`, `Avg Naps/Day`, `Avg Nap Duration`, and nap-versus-night classification are
      unchanged, proved by the existing `calculateSleepSummary` tests continuing to pass unmodified.

## Implementation evidence

- RED/GREEN calculation cycle: the new mixed-day expectation failed with an undefined average, then
  passed after adding the dedicated napping-day divisor. Night-only and day-boundary cases also pass
  (`calc-red.log`, `calc-green.log`, `calc-cases.log`).
- RED/GREEN component cycle: the card-label assertion failed before rendering was added, then passed
  with the half-width card and interpolated divisor. The stable component file passes 3 tests,
  including the `0 of 7` state (`component-red.log`, `component.log`).
- RED/GREEN locale cycle: all nine locales initially failed on missing keys, then all nine passed
  with localized label and subtitle copy (`locales-red.log`, `locales-green.log`).
- Focused pre-review proof: the sleep-summary and locale unit files pass 109 tests; the component
  file passes 3 tests; targeted warning-free lint, repository typecheck, and `git diff --check` pass.
  Logs are retained in `/tmp/agent-workflows/e2f8af45fd34/799711673604`.

## Non-goals

- No change to nap versus night classification, to `Avg Total Sleep`, to `Avg Naps/Day`, or to
  `Avg Nap Duration`, including their labels. Whether `Avg Nap Time` and the adjacent
  `Avg Nap Duration` label need renaming is unresolved and stays out of this task.
- No age-band comparison, target, or goal range on the new card.
- No new range beyond 7, 14, and 30 days.
- No per-nap-slot statistics; that is decision
  `plans/decision-maps/unified-timer-contract/decisions/resolved/014-per-nap-slot-statistics.md`.
