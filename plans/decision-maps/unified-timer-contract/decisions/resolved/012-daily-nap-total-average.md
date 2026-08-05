# Decision: average daily nap total

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** standalone
**Cluster:** none
**Depends on:** none
**Claim:** none

## Question

What does "daily average of nap time" mean to the caregiver who asked for it, and which days count
toward the average?

## Context

A caregiver wants to check their son's nap total against what is typical for his age. Avg Total Sleep
cannot answer that, because they do not log every overnight, so the metric mixes days that include a
night with days that do not. Avg Nap Duration divides by the number of naps rather than by days, so it
answers a different question.

Three readings fit the request, and they produce different numbers on the same data:

- total nap seconds divided by days holding at least one nap;
- total nap seconds divided by every day with any sleep logged, matching how `avgTotalSleepSeconds`
  already works;
- total nap seconds divided by every calendar day in the selected range.

The owner put all three to the caregiver on 2026-08-04 and they chose the first.

Where it lands is not in question. `SleepStatsContainer.tsx` line 147 renders the same `SummaryView`
as the Sleep Patterns tab, so one computation and one card serve Statistics under Sleep, Summary and
the Sleep Patterns tab across all three ranges.

## Evidence

- `src/utils/sleep-patterns.ts` line 486 already accumulates `totalNapSeconds` from `daysWithData`.
  Line 555 divides it by `totalNaps` to produce `avgNapDurationSeconds`, which is per nap. Line 552
  divides total sleep by `activeDays` to produce `avgTotalSleepSeconds`.
- `src/components/sleep-patterns/SummaryView.tsx` renders Avg Total Sleep at line 227, Avg Naps/Day at
  390, and Avg Nap Duration at 395. Avg Night Sleep at 384 is hidden for newborns.
- `src/components/stats/sleep/SleepStatsContainer.tsx` line 147 renders `SummaryView`, with
  `SleepSummaryPeriod` typed `7 | 14 | 30` at line 56 and the range built by `getSleepSummaryRange`.
- `src/utils/sleep-patterns.ts` line 472 builds `daysWithData` by filtering on `totalSeconds > 0`,
  which is any sleep rather than any nap. The new divisor needs its own filter on `napSeconds > 0`.
- Mock of the resulting screen:
  [`prototypes/nap-stats-mock.html`](../../prototypes/nap-stats-mock.html), marker A. Published at
  <https://claude.ai/code/artifact/92e0f3c6-a3d2-44e2-87e3-6430d1585af2>. The card sits below the
  existing metric cards, in a half-width slot, with `per napping day · 5 of 7` as its subtitle.

## Resolution

- **Decision:** Add one card, `Avg Nap Time`, holding total daytime nap seconds in the selected range
  divided by the number of days in that range with at least one nap. Days with only an overnight
  logged, and days with nothing logged, are excluded from both halves. The card carries the divisor
  as its subtitle, in the form `per napping day · 5 of 7`, and renders in a half-width slot below the
  existing metric cards. It serves all three ranges and both surfaces that render `SummaryView`.
- **Rationale:** The caregiver wants to compare their son's nap total against age guidelines, and
  those guidelines state how much a baby naps on a day they nap. Dividing by days with any sleep
  logged would count a night-only day as a zero-nap day, which is the distortion that already stops
  `avgTotalSleepSeconds` from answering the question. Dividing by every calendar day would turn a
  gap in logging into an apparent drop in napping.
- **Alternatives rejected:** Dividing by days with any sleep logged, which reuses the existing
  `activeDays` divisor and needs no new accumulator, but reintroduces the night-only distortion.
  Dividing by all 7, 14, or 30 calendar days, which is the simplest rule to explain and stays stable
  across ranges, but reads missed logging as missed naps.
- **Consequences:** Two cards on the same screen now use different divisors. `Avg Total Sleep`
  divides by days with any sleep; this one divides by days with a nap. Without the subtitle the two
  numbers look like a contradiction, so it is not optional. The card reads zero, and the divisor
  reads `0 of 7`, whenever a range holds no naps at all. `Avg Naps/Day` and `Avg Nap Duration` keep
  their current divisors untouched, so a reader can arrive at three different denominators on one
  screen.
- **Non-goals:** No change to nap versus night classification, to `Avg Total Sleep`, to
  `Avg Naps/Day`, or to `Avg Nap Duration`. No age-band comparison, target, or goal range on the new
  card. No new range beyond 7, 14, and 30 days.
- **Required proof:** Unit tests over `calculateSleepSummary` covering a range that mixes napping
  days, night-only days, and empty days; a range with no naps; and a nap spanning the day boundary,
  which must contribute to the day the existing `splitSleepAtDayBoundary` assigns it to. A component
  test asserting the card renders its divisor subtitle, and that the value differs from
  `Avg Total Sleep` on data where the two divisors diverge.

## Follow-on

- **Newly sharp decisions:**
  [per-nap-slot statistics](014-per-nap-slot-statistics.md)
- **Still-foggy areas:** The label `Avg Nap Time` sits one line from the existing `Avg Nap Duration`
  and the two mean different things. Whether the new label, the old one, or both need to change is
  recorded in the map as fog rather than settled here.
