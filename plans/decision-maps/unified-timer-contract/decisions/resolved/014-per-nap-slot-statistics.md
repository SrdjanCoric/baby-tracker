# Decision: per-nap-slot statistics

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** standalone
**Cluster:** none
**Depends on:** [average daily nap total](012-daily-nap-total-average.md)
**Claim:** none

## Question

How does the Summary screen report each individual nap of the day, given that the number of naps in a
day varies?

## Context

The same caregiver who asked for a daily nap total also wants to see the naps separately: how long
each one usually runs and when it usually starts. They named the obstacle themselves. Some days hold
three naps and some hold four, so the naps do not line up into fixed rows.

Two sub-questions had to be settled before this could be answered: how a nap is assigned to a row on
a day when one of the usual naps is skipped, and how many times a row has to happen before it is
worth showing. The owner put both to the caregiver on 2026-08-04 alongside the divisor question in
[average daily nap total](012-daily-nap-total-average.md), and all three came back in one answer.

`Avg Nap Duration` already exists and divides total nap seconds by total nap count, so it reports the
length of an average nap without saying which nap. This decision does not replace it.

## Evidence

- `src/utils/sleep-patterns.ts` line 440 increments `napCount` on the day a nap starts, when
  `classifySleepByTimeRange` returns `nap`. The per-day nap ordinal this decision needs is derivable
  from the same loop, which already visits naps in the order they start.
- `circularTimeMean` in the same file, used at lines 524 and 531 for the bedtime and wake-time
  averages, already averages clock times correctly across an hour boundary.
- `src/components/sleep-patterns/MetricCard.tsx` line 48 defines `AverageRow`, which renders a
  two-column label-and-value row. A three-column row carrying duration and start time is new.
- `src/components/sleep-patterns/SummaryView.tsx` line 367 opens the `Averages` panel, currently the
  last element in the scroll view.
- Mock of the resulting screen:
  [`prototypes/nap-stats-mock.html`](../../prototypes/nap-stats-mock.html), markers B and C.
  Published at <https://claude.ai/code/artifact/92e0f3c6-a3d2-44e2-87e3-6430d1585af2>. It draws the
  panel at three ranges, the row layout with its occurrence count, and the appearance test as a table
  of worked cases.

## Resolution

- **Decision:** Add a `Nap Schedule` panel below `Averages`, holding one row per nap slot. A slot is
  the nth nap started within a sleep-day, counted forward from the start of the day. Each row shows
  the average duration and the average start time for that slot, each divided by the number of days
  the slot actually occurred, and carries that occurrence count as `4 of 5 days`. Average start time
  uses `circularTimeMean`. A row renders only when its slot occurred at least 3 times **and** on at
  least 30% of the napping days in the range. When no slot clears both tests the panel does not
  render at all.
- **Rationale:** Chronological numbering matches how the caregiver already describes the day and is
  the only rule that needs no configuration per age. The two-part appearance test comes from the same
  answer. The count floor binds on the 7-day range, where 3 of 5 napping days is already meaningful,
  while the share binds on the 30-day range, where 3 occurrences out of 24 napping days would
  otherwise render a row that reads as routine. Dividing each slot by its own occurrence count,
  rather than by napping days, keeps a slot's average from being dragged toward zero by the days it
  did not happen.
- **Alternatives rejected:** Time-of-day bands, labelling rows morning, midday, afternoon, and
  evening by start time. A skipped morning nap would leave that band empty rather than shifting every
  later nap up a row, which keeps the averages cleaner, but the band boundaries are fixed clock times
  that do not hold across ages and the labels abandon the caregiver's own vocabulary. Counting
  backwards from the last nap of the day, which stabilises the bedtime-adjacent nap at the cost of
  destabilising the morning one and making a row number mean different things on a three-nap and a
  four-nap day. A flat floor of 3 occurrences with no share test, which is simpler to explain and to
  test but renders a 5-of-24-day nap as part of the routine on the 30-day range.
- **Consequences:** On a day the first nap is skipped, the midday nap becomes slot 1 and pulls that
  row's average start time later. This is accepted, and the per-row occurrence count shows the reader
  how large the sample behind each row was. Rows appear and disappear as the range changes, so the
  same baby can show three rows over 7 days and two over 30. Nothing caps the number of slots, so a
  newborn with six naps a day renders six rows if each clears both tests. The panel needs a
  three-column row that `AverageRow` does not provide, and new translation keys for the panel title,
  the slot label, the two column headers, and the occurrence count.
- **Non-goals:** No change to `Avg Naps/Day` or `Avg Nap Duration`, both of which stay in the
  `Averages` panel computed as they are today. No wake-window figure between slots. No chart. No
  per-slot trend over time. No age-band comparison. No user control over the appearance thresholds.
- **Required proof:** Unit tests over the slot computation covering a range where every day holds the
  same nap count; a range where one day skips its first nap, asserting the later naps shift up a
  slot; a slot at exactly 3 occurrences and exactly 30% of napping days, asserting both boundaries
  are inclusive; a slot failing the count test but passing the share test, and the reverse; and a
  start-time average across an hour boundary. A component test asserting that a failing slot renders
  no row, that the panel is absent when no slot qualifies, and that each row shows its occurrence
  count.

## Follow-on

- **Newly sharp decisions:** None
- **Still-foggy areas:** Whether the slot count needs an upper bound for newborns, who nap often
  enough to render six or more rows.
