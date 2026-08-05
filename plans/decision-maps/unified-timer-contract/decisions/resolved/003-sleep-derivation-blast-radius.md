# Decision: derived-data blast radius of timer time changes

**Status:** resolved
**Type:** prerequisite
**Mode:** agent
**Plannable:** none
**Cluster:** none
**Depends on:** none
**Claim:** none

## Question

Which derived features read a saved activity's start time, end time, and duration, and which of them
would change behavior if a timer's paused span were counted as elapsed time or if start and end times
became editable during and after a run? This audit informs [what pause means](006-pause-semantics.md),
[stop time rewind](008-stop-time-rewind.md), and
[clock time log editing](009-clock-time-log-editing.md).

## Context

Pause semantics and time editing look like UI changes but they move the numbers that sleep prediction,
morning classification, wake windows, statistics, exports, and achievements consume. The nap
continuation setting already treats a short gap between sleeps as one nap, which overlaps with what
the caregiver in the feedback thread was doing manually by pausing. Whether pause and continuation are
two paths to the same outcome is a fact about the current code, not a preference.

This is read-only repository analysis. It resolves no product behavior.

## Evidence

Every timer type writes the same shape on stop: `startedAt` is the real start, `endedAt` is the real
stop, and `durationSeconds` is the interval minus `totalPausedMs`. See `src/contexts/sleep-context.tsx`
lines 1319 to 1340, `src/contexts/feeding-context.tsx` line 863, `src/contexts/pumping-context.tsx`
line 702, and `src/contexts/tummyTime-context.tsx` line 802. On any record that was paused,
`durationSeconds` is therefore smaller than `endedAt - startedAt`. Nothing enforces agreement. The
validators in `src/validators/sleep.ts` check only that the end follows the start and that the duration
falls between 0 and 86400 seconds, and no migration adds a check constraint on `duration_seconds`.

That gap splits every consumer into two families.

Consumers that measure the interval and never read `durationSeconds`:

- `src/utils/sleep-patterns.ts`: `splitSleepAtDayBoundary` line 113, `splitSleepTimeRange` line 141,
  `classifySleepByTimeRange`, `buildDayViewData`, `buildWeekViewData`, `calculateSleepSummary`, and
  `buildDailySleepBars`. These drive the Statistics sleep screens through
  `src/components/stats/sleep/SleepStatsContainer.tsx`.
- `src/utils/timeline.ts` line 139, which builds the Timeline daily summary card.
- `src/utils/sleepPredictions.ts` line 306, where `processSleepData` recomputes `durationMinutes` from
  the interval. Everything downstream inherits that: `groupSleepsByDay`, `computeSleepModel`,
  `predictNextSleep`, `detectBedtimeDrift`, `detectMorningDrift`, `resolveMorningSleep`, and
  `classifyNewMorningSleep`.
- `src/utils/day-night-boundary.ts` line 39 and `src/utils/sleep-intervals.ts`.

Consumers that read the stored `durationSeconds`:

- The Timeline row label at `app/(tabs)/timeline.tsx` line 347, and the same pattern for feeding,
  pumping, and tummy time at lines 303, 403, and 450.
- `src/utils/csv-generator.ts` line 165 and `src/utils/report-aggregator.ts` lines 248 to 261, which
  feed the CSV export and the PDF report.
- `src/services/achievement-detection.ts` lines 65 and 72, where a night-sleep achievement fires on a
  duration threshold.
- `app/edit/sleep.tsx` lines 37 and 76.
- `src/services/duplicate-detection.ts` line 313, which calls two entries duplicates when their
  durations differ by 60 seconds or less.
- `calculateSleepStats` and `calculateExtendedSleepStats` in `src/utils/statistics.ts` lines 129 and
  421. No screen calls either one; outside their own tests they are dead. Every live sleep total comes
  from the interval family.

For the other three timer types the split runs the other way. Their totals read the duration, at
`src/utils/statistics.ts` lines 99, 198, and 214, `src/components/stats/tummyTime/TummyTimeWeekView.tsx`
line 44, `src/components/stats/feeding/FeedingWeekView.tsx` line 100, and
`src/contexts/tummyTime-context.tsx` line 1004. Only their session grouping measures intervals, in
`src/utils/feeding-sessions.ts` lines 17 and 40 and in `calculateAvgTimeBetweenSessions` at
`src/utils/statistics.ts` lines 383 to 388, which reads a paused span as time the baby spent feeding
and so shortens the reported gap between sessions.

Pause and nap continuation are not two paths to the same outcome. A pause keeps one record, so the
paused span sits inside `[startedAt, endedAt]` and every interval consumer counts it as sleep. Stopping
and restarting produces two records with a real gap; `unionCompletedSleepIntervals` merges only
overlapping entries, so the interval consumers exclude that gap. They agree only in the prediction
model, where `processSleepData` merges records whose gap is at most `napContinuationMinutes`, default
25, and then recomputes the merged duration across the gap at `src/utils/sleepPredictions.ts` line 332,
so the awake gap is counted either way. Everywhere else the caregiver's manual pause inflates the same
totals that a manual stop and restart would leave correct.

Two artifacts in the tree already work around this. `src/utils/ongoing-sleep.ts` builds the running-timer
entry starting at `startTime + totalPausedMs` so the live interval carries unpaused time only, and its
own comment states that the surfaces which total sleep "measure the interval and ignore
durationSeconds"; the same `effectiveStartTime` idiom appears in all four contexts when a Live Activity
restarts, for example `src/contexts/sleep-context.tsx` lines 838 to 852. Neither workaround reaches the
saved record, which is why one paused sleep shows its interval in the Day view block label at
`src/components/sleep-patterns/DayView.tsx` line 148 and its shorter pause-subtracted duration in the
Timeline row label, for the same sleep on the same screen pair.

One derived value lives on the server. The trigger `on_sleep_update_last_ended` in
`supabase/migrations/053_tombstone_aware_wake_window_reminders.sql` fires on
`INSERT OR UPDATE OF ended_at, deleted OR DELETE` and recomputes `babies.last_sleep_ended_at` as the
maximum non-tombstoned `ended_at`, which
`supabase/functions/check-wake-window-reminders/index.ts` line 216 reads as the wake time for a push
reminder. An end-time change propagates there without client work, while a start-time change does not
fire the trigger at all.

The saved-record editor is narrower than the question assumes. `app/edit/sleep.tsx` exposes sleep type,
duration in minutes, and notes. It has no start-time and no end-time field, and on save it recomputes
`endedAt = startedAt + durationSeconds` at line 78. Editing the duration of a paused sleep therefore
collapses the interval onto the stored duration and silently discards the pause. `app/edit/feeding.tsx`
does the same at line 96.

`morningClassification` is stored on the record and written only when the timer stops or when
the type is changed, at `src/contexts/sleep-context.tsx` lines 1322 and 1548. No path recomputes it
when times change.

## Resolution

- **Decision:** Sleep runs on two clocks, and they disagree only on paused records. Every live sleep
  surface (day view, week view, summary, daily sleep bars, the Timeline daily summary, and the
  prediction and drift model) measures `endedAt - startedAt` and ignores `durationSeconds`. The
  stored `durationSeconds` is the only place the paused span is subtracted, and it is read by the
  Timeline row label, the CSV export, the PDF report, the night-sleep achievement, the edit screen's
  prefill, and duplicate detection. Feeding, pumping, and tummy time invert this. Their totals read
  the duration, and only their session grouping and the average-gap-between-feedings figure read the
  interval. Counting the paused span as elapsed time would make `durationSeconds` equal the interval
  for the first time, which every sleep total already assumes, so it changes no sleep total and only
  lengthens the six duration readers listed above. Pause and nap continuation are not equivalent. The
  paused span stays inside one interval and is counted as sleep everywhere, while a stop-and-restart
  gap is excluded everywhere except the prediction model, which merges gaps up to
  `napContinuationMinutes` and counts them. Making start and end editable reaches further than pause
  does, because start time alone re-derives the sleep type, the sleep-day bucket, bedtime averages and
  their standard deviation, wake windows, and duplicate detection, while leaving the stored
  `morningClassification` stale, and end time alone additionally re-fires the server trigger that
  drives the wake-window push reminder.
- **Rationale:** Every claim above was checked at a named file and line, and the split between
  interval readers and duration readers was confirmed by finding every call site of both, including
  the two statistics functions that turned out to have no live caller.
- **Alternatives rejected:** None. This record is an audit.
- **Consequences:**
  - [what pause means](006-pause-semantics.md) can treat "count the pause as elapsed" as the
    cheap option for sleep. It is a one-line change per context and it aligns `durationSeconds` with
    the interval that every sleep surface already trusts. The cost lands on the six duration readers
    and on feeding, pumping, and tummy time, whose totals would grow by the paused span.
  - The opposite choice, keeping the pause subtracted, cannot be delivered by leaving the code alone.
    Today it is honored only by `durationSeconds`, so every sleep total already counts paused time as
    sleep. Honoring it means writing the pause-adjusted start into the saved record, as
    `src/utils/ongoing-sleep.ts` already does for the running timer, and accepting that `startedAt`
    then stops being the moment the caregiver pressed start.
  - [stop time rewind](008-stop-time-rewind.md) resolved that no stop path accepts a caregiver-chosen
    end, so the question of whether a changed end recomputes `durationSeconds` transferred whole to
    [clock time log editing](009-clock-time-log-editing.md), which faces it directly because
    `app/edit/sleep.tsx` currently derives the end from the duration rather than the reverse. An
    edited end also fires `on_sleep_update_last_ended` and moves a scheduled server push, so a time
    edit is not a client-only change.
  - [clock time log editing](009-clock-time-log-editing.md) starts from no start-time or end-time
    field existing in either edit screen, so it is new surface rather than a modification. It must
    also decide whether an edited time recomputes the stored `morningClassification` and whether an
    edit may create or dissolve an overlap that `unionCompletedSleepIntervals` merges, or push two
    entries inside the duplicate-detection thresholds at `src/services/duplicate-detection.ts`
    line 313.
  - Any of these decisions may reasonably delete `calculateSleepStats` and
    `calculateExtendedSleepStats` rather than maintain them, since nothing calls them.
- **Non-goals:** This record chooses no pause semantics, no editing surface, and no migration. It does
  not decide whether the Timeline row label and the Day view block label should agree, only that they
  disagree today.
- **Required proof:** Any task that changes pause accounting or time editing must prove, for at least
  one paused sleep, that the Day view block, the Timeline daily summary, the Timeline row label, the
  CSV export, and the PDF report all report the same number for it. Prediction coverage must show that
  the merge at `SLEEP_MERGE_THRESHOLD_MINUTES` still behaves as intended once pause accounting
  changes. A stop-time or end-time change must be shown to reach `babies.last_sleep_ended_at`.

## Follow-on

- **Newly sharp decisions:** None. The findings sharpen
  [what pause means](006-pause-semantics.md), [stop time rewind](008-stop-time-rewind.md), and
  [clock time log editing](009-clock-time-log-editing.md), all of which already exist.
- **Still-foggy areas:** Whether the Timeline row label and the Day view block label should show the
  same number for one sleep is a wording and consistency question no decision covers yet. Whether the
  stored `morningClassification` should be recomputed when times change was the second one, and
  [clock time log editing](009-clock-time-log-editing.md) has since answered it: a time edit reruns
  the recomputation `updateSleep` already performs on a type edit, reading the edited start.
