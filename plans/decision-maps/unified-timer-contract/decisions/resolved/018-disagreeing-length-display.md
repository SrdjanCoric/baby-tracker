# Decision: showing a record whose stored length disagrees with its interval

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** cluster
**Cluster:** pause semantics
**Depends on:** [clock time log editing](009-clock-time-log-editing.md), [what pause means](006-pause-semantics.md)
**Claim:** none

## Question

When a saved record's stored `durationSeconds` differs from `endedAt - startedAt`, what does the edit
screen show as its length, and does anything tell the caregiver that two numbers exist?

## Context

[Clock time log editing](009-clock-time-log-editing.md) settled that the edit form derives a
read-only duration from its two pickers and rewrites the stored value only when a time is actually
changed. For most records the two agree. They disagreed for a paused feeding, pumping, or tummy time
record, permanently and by design under
[what pause means](006-pause-semantics.md), and for a sleep recorded before that decision.

For those records the derived readout shows the interval while the Timeline row label, the CSV export,
the PDF report, and the night-sleep achievement keep showing the stored value. The caregiver sees one
number on the row and another inside the form, with nothing explaining the gap.

This decision belongs to the pause semantics cluster because it changed pause accounting rather than
the form. It was charted under timer time editing on the assumption that the answer was a display
rule.

## Evidence

- The split of interval readers and duration readers is enumerated in
  [derived-data blast radius](003-sleep-derivation-blast-radius.md). A census taken while resolving
  this decision found ten surfaces reading the stored value and nine computing the interval. Stored:
  the Timeline rows for all four types (`app/(tabs)/timeline.tsx:303`, `:403`, `:450`), all four edit
  screens, `src/utils/csv-generator.ts`, `src/utils/report-aggregator.ts`, and the daily-summary lines
  for feeding and tummy time (`src/utils/timeline.ts:98` and `:176`). Interval: the Day view blocks
  and total (`src/utils/sleep-patterns.ts:238` and `:255`), the Timeline daily summary for sleep
  (`src/utils/timeline.ts:146`), and the night-sleep achievement through
  `unionCompletedSleepIntervals`. The split runs through one screen, since on the Timeline the sleep
  daily summary counts the interval while the row beneath it prints the stored number.
- `totalPausedMs` exists only on the running timer (`ActiveTimerData` in each storage service) and is
  never written to a saved record. The excluded span is still recoverable by subtraction, as
  `(endedAt - startedAt) - durationSeconds`, so a screen could state the amount. It could not state
  the cause, since a resumed pause and a pre-decision sleep produce the same gap.
- The Timeline row label reads `durationSeconds`, which is what the caregiver sees before tapping into
  the edit screen.
- `endedAt` on the three subtracting types is read by very little: `src/utils/feeding-sessions.ts:17`
  and `:40` merge breast feeds less than an hour apart, `src/contexts/widget-context.tsx:119`, `:150`
  and `:166` prefer `startedAt` for the widget's last-activity tile, and
  [interval overlap detection for feeding, pumping, and tummy time](019-interval-overlap-non-sleep.md)
  compares the endpoints. Nothing derives a classification, a prediction, or a reminder from them.
- `calculatePumpingStats` reports `totalCount` and `calculateTummyTimeStats` reports `sessionCount` as
  raw record counts, `src/utils/statistics.ts:204` and `:224`, and both report summed minutes from the
  stored duration.

## Resolution

- **Decision:** A resumed pause counts as elapsed time on all four timers. Feeding, pumping, and tummy
  time stop subtracting `totalPausedMs`, which extends to them the rule
  [what pause means](006-pause-semantics.md) set for sleep and supersedes the split that decision drew
  between the types.

  Every record written after this change satisfies `durationSeconds === endedAt - startedAt`, so the form's
  derived readout equals the stored length and there is no second number to explain. The edit screen
  shows the interval, exactly as [clock time log editing](009-clock-time-log-editing.md) specified,
  with no annotation and no extra field.

  The stop rule is unchanged. Stopping a paused timer still ends the record at `pausedAt` on all four
  types, so a pause left open bills nothing and only a span the caregiver deliberately resumed counts.

  Records written before this change keep their disagreement and are never corrected, which is the
  answer [backfilling historical paused sleeps](017-paused-sleep-backfill.md) already gave for sleep.
  They show the interval in the form and the stored length on the Timeline row, unexplained, until a
  caregiver edits one of their times and the save rule converges them.

- **Rationale:** The form's data model is a start and an end with the length derived from them, so a
  record whose stored length is not its interval cannot be expressed in it. There is no field to hold
  the second number. Any display answer is therefore a workaround for a record the app can no longer
  represent, and the fix belongs in what gets written.

  Counting the pause removes the disagreement at its source without inventing a timestamp or losing
  one. Both timestamps stay the moments they were, the record keeps one row, and the invariant holds
  across all four types, which is the contract this map exists to produce.

  Counting is safe because of the stop rule. The objection to counting a paused span is the pause left
  open for two hours, and that span never reaches a record, so what counts is only what the caregiver
  came back to.

  This overcounts where the number is a target rather than a description. A ten-minute break inside
  tummy time now lands in a daily total parents measure against a goal, and pumping minutes carry the
  same effect. The owner accepted that cost to keep one rule across the four timers and chose to
  watch it in use rather than pay for splitting now.

- **Alternatives rejected:**
  - *Show the interval and state the gap underneath, as "48 min elapsed, 10 min not counted."* The
    amount is derivable, so this needs no schema change, and it keeps both timestamps real. Rejected
    because it annotates a state the form cannot otherwise hold instead of removing it, and because the
    line can name the amount but never the cause, since a resumed pause and a pre-decision sleep
    produce identical records.
  - *Show the stored length as the readout.* The row and the form would agree. Rejected because the
    form would print a number the two pickers directly above it contradict.
  - *Show the interval on the Timeline row too.* Consistent on screen. Rejected because it reports a
    feed as longer than the baby fed while the CSV, the PDF, and the statistics keep the stored value,
    which moves the disagreement rather than ending it.
  - *Compress the end, writing `endedAt = startedAt + countedDuration`.* One record, no inflated total,
    and the form round-trips it. Rejected because the anchor is arbitrary: the same 38 minutes could
    end at the real stop and start ten minutes late. Either choice fabricates a timestamp the caregiver
    watched happen.
  - *Split the record at each pause.* The only option that gives up no information, since every row is
    a true interval and no total inflates. Rejected on the three costs
    [what pause means](006-pause-semantics.md) established: stopping a pumping timer demands a volume a
    widget or Watch button cannot collect, a split doubles `calculatePumpingStats.totalCount` and
    `calculateTummyTimeStats.sessionCount` because both are raw record counts, and repairing that needs
    continuation-style merge logic on every counting surface, including the `Nap Schedule` panel from
    [per-nap-slot statistics](014-per-nap-slot-statistics.md), whose slot numbering would otherwise
    shift on any paused day. It stays the option to reach for if the overcount proves unacceptable, and
    it would need a cluster of its own.
  - *Count the pause for feeding but keep subtracting it for pumping and tummy time,* which targets the
    overcount at the two types where the number is a goal. Rejected because it reinstates the per-type
    asymmetry this map exists to remove, in the one behavior all four timers share.

- **Consequences:**
  - The four contexts drop `- totalPausedMs` outright rather than for sleep alone, so the change
    [what pause means](006-pause-semantics.md) scoped to sleep applies to feeding, pumping, and tummy
    time as well. That decision's resolution and its required proof are corrected in the same step.
  - `durationSeconds === endedAt - startedAt` becomes an invariant for every new record of all four
    types. The ten stored-reading surfaces and the nine interval-reading surfaces agree by
    construction, so the standing bar from
    [derived-data blast radius](003-sleep-derivation-blast-radius.md) is met without repointing a
    single consumer.
  - The `effectiveStartTime` idiom stops shifting the start by `totalPausedMs` in all four contexts,
    not only in `src/utils/ongoing-sleep.ts`, and while a pause is open every running entry ends at
    `pausedAt`, so the live view shows what stopping right then would record.
  - `calculateTummyTimeStats` minutes and `calculatePumpingStats` minutes rise by every resumed pause
    span. Record counts are untouched, since no record is split.
  - The widget and the Watch keep sending `pauseDurationMs` and `accumulatedSeconds`. The app now
    ignores them for all four types instead of for sleep alone, so neither native target changes.
  - [Interval overlap detection for feeding, pumping, and tummy time](019-interval-overlap-non-sleep.md)
    compares endpoints that now match the stored lengths, so an overlap warning and a duration readout
    can no longer describe different windows.
  - Released 4.7.1 builds keep subtracting locally, and the records they write join the legacy class
    that is never corrected.
  - A timer restored from `AsyncStorage` across the update carries a `totalPausedMs` written under the
    old meaning. It is ignored from then on for every type, so that timer records slightly more than
    the old code would have. Nothing is lost and no migration is needed.
  - This decision leaves the timer time editing cluster and joins pause semantics, since it changes the
    write path rather than the form. The form behaves exactly as
    [clock time log editing](009-clock-time-log-editing.md) already specified.

- **Non-goals:** No split of any record, now or retroactively. No schema change and no stored pause
  span. No backfill of records written before this change, which
  [backfilling historical paused sleeps](017-paused-sleep-backfill.md) settled. No threshold on how
  long a pause may run before it stops counting. No change to the stop rule, to the pause control on
  any surface, or to `toggle_timer_pause`. No annotation, badge, or explanatory copy anywhere in the
  app about the two numbers on a legacy record.

- **Required proof:** One feeding, one pumping, and one tummy time paused and resumed, each proving the
  saved record's `durationSeconds` equals `endedAt - startedAt` and that the resumed span is included.
  This inverts the coverage [what pause means](006-pause-semantics.md) required and replaces it.

  One of each stopped while paused without resuming, proving the record still ends at `pausedAt`.

  Explicit total tests, so the overcount is deliberate rather than incidental:
  `calculateTummyTimeStats` and `calculatePumpingStats` include a resumed pause span in their summed
  minutes while their record counts stay unchanged.

  An edit-screen test per type: a record written after this change opens with a derived length equal
  to its stored length and shows no annotation, and a record written before it opens showing its real
  interval while the Timeline row still shows the stored length, converging only when a time is
  edited and saved.

  Coverage that a running entry stops growing while a pause is open, for all four types.

  The standing bar from [derived-data blast radius](003-sleep-derivation-blast-radius.md), extended
  past sleep: after a paused-and-resumed record of each type, the Day view block where one applies,
  the Timeline daily summary, the Timeline row label, the CSV export, and the PDF report all report
  the same number.

## Follow-on

- **Newly sharp decisions:** None
- **Still-foggy areas:**
  - Whether the tummy time and pumping overcount is acceptable in use. The owner chose to watch it,
    and splitting records is the answer already costed if it is not.
