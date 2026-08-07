# Task 0072: Log and edit a sleep by clock time

**Branch**: `feature/log-and-edit-sleep-by-clock-time`
**Depends on**: 0068
**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes
**Source**: `plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md` and its member
`decisions/resolved/009-clock-time-log-editing.md` (resolved), with the edit-screen proof items from
`decisions/resolved/018-disagreeing-length-display.md` · **User stories**: As a caregiver, I want to
enter and correct a sleep by its real clock times, so that fixing a wake from 5:43 to 5:30 does not
mean subtracting thirteen minutes and typing a new total.

## What to build

Both sleep hand-entry paths — `app/sleep/manual.tsx` and `app/edit/sleep.tsx` — take a **start time**
and an **end time**, with duration shown as a derived read-only readout. This is the first of three
tasks applying one rule set to all four activity types, and it builds the shared form section the other
two reuse.

The form's shape is settled and is not a question here. See
[`plans/decision-maps/unified-timer-contract/prototypes/clock-time-entry-mock.html`](../decision-maps/unified-timer-contract/prototypes/clock-time-entry-mock.html),
published at <https://claude.ai/code/artifact/2dc8a9f5-8f13-42b8-bf0a-c09191277dfc>, which draws both
forms as they are today and as settled. Read it before implementing.

### Today

`app/sleep/manual.tsx` pairs a start-time picker with a `durationMinutes` input and a `QUICK_DURATIONS`
row of `[15, 30, 45, 60, 90, 120]`. `app/edit/sleep.tsx` exposes the minutes field alone — no
start-time control and no end-time control — and recomputes `endedAt = startedAt + durationSeconds` on
save, so editing the duration of a paused sleep collapses its interval onto the stored duration and
discards the pause. There is **no shared date/time pill component**: each screen inlines its own picker
with an iOS combined-datetime branch and an Android separate-date-then-time branch.

### The form

- The manual screen gains an **End Time** field beside the existing Start Time, built from the same
  date and time pills, so it inherits the picker, the formatting, and the 12/24-hour preference. Its
  **date** pill matters: a night sleep starting 11:40 PM ends on the following day.
- The edit screen gains **Start Time** and **End Time**, neither of which exists today. This is new
  surface rather than a modification.
- The minutes input and the `QUICK_DURATIONS` chips go from both. Duration becomes a derived read-only
  readout under the two pickers. Nothing replaces the chips — both pickers default to now on the add
  screen, so a nap that just ended is a few taps on the start picker alone. Withdrawing the two-tap
  "30 minute nap" path from 4.7.1 builds is a cost the owner accepted.
- Sleep type chips, notes, and the Cancel/Save navigation bar are unchanged.

Extract the inline date/time pill into a shared form section carrying both pickers and the derived
readout, handling the iOS and Android picker strategies once. Tasks 0073 and 0075 reuse it.

### Bounds

Every bound is shown as the picker's own range, so nothing a caregiver can pick is rejected afterwards.
No bound below is a new number — each restates a validator already shipped in `src/validators/sleep.ts`.

- Neither picker accepts a future value, which is what the manual screen enforces today through
  `maximumDate={new Date()}` and `validateSleepStartTimeNotInFuture`.
- **There is no floor in time.** The twelve-hour floor from Task 0071 exists to keep a running lock
  inside the `cleanup_stale_timer_locks` horizon, and a record that already exists cannot be lost that
  way.
- An end must be at least **one minute** after its start, restating the one-minute minimum
  `validateManualSleep` already imposes. Minute-granular pickers make that the smallest expressible
  span anyway.
- The **twenty-four-hour** sleep cap survives on the derived value.
- The end picker offers `start + 1 minute` through the earlier of now and `start + 24h`; the start
  picker offers up to the earlier of now and `end - 1 minute`.
- Save stays disabled until the two times are a minute apart, which is the gate the manual screen
  already applies to the minutes field.

`validateManualSleep` takes `durationSeconds`, so it needs an **end-time-aware entry point** reached
with a duration derived from two times rather than typed. Its thresholds do not change.

### What a save writes

Both forms prefill Start and End from the record's **own stored timestamps**. The
`endedAt = startedAt + durationSeconds` derivation at `app/edit/sleep.tsx` goes, so a record's real end
is shown for the first time.

The stored `durationSeconds` is rewritten as `end - start` **only when the caregiver actually changed
one of the two times**. A save that touched only a note or the sleep type leaves `durationSeconds` and
`endedAt` exactly as stored.

This is the rule that keeps a legacy paused sleep safe. A form that always wrote its derived value
would lengthen such a record on a save made for another reason, with nothing on screen to say so and no
way back, since the paused span is stored nowhere — `totalPausedMs` lives on the running timer and never
reaches a saved record. Writing only on a real time change makes every length change an act the
caregiver performed, and a deliberate time edit converges the record on its interval because the
caregiver has just stated what the interval is.

After Task 0068 every newly written record satisfies `durationSeconds === endedAt - startedAt`, so for
new records the derived readout equals the stored length and there is nothing to explain. What remains
is the legacy set, which is never backfilled — that is settled by
`decisions/resolved/017-paused-sleep-backfill.md`.

### Overlap

Saved records follow the master plan: **warn, allow, and union for statistics**. The clamp from Task
0071 stays a running-timer rule and does not follow the record, so the app holds two overlap rules on
purpose — clamping saved records would leave every already-overlapping record uneditable, including
ones a caregiver deliberately kept through Continue anyway.

`app/sleep/manual.tsx` is the only screen in the tree that runs a duplicate check today, through
`useDuplicateCheck`'s `checkAndConfirmSleep`. Wire that same check into `app/edit/sleep.tsx`,
evaluated against the **post-edit** values and **excluding the record being edited by id** so it cannot
match itself. `checkSleepDuplicate` already compares intervals and reports `overlapping_session`. The
60-second confidence rule in `src/services/duplicate-detection.ts` becomes reachable by editing.

Feeding, pumping, and tummy time are wired by a separate decision,
`decisions/resolved/019-interval-overlap-non-sleep.md`, and are out of scope here and in Tasks 0073 and
0075.

### Sleep type and morning classification

Moving a sleep's times re-derives its Nap or Night type the way the add screen does, and a caregiver's
tap on the toggle afterwards wins. The toggle stays the answer to the ambiguous-morning question the
master plan requires to remain editable.

`updateSleep` in `src/contexts/sleep-context.tsx` already recomputes classification on a type edit: an
`isApplicableMorningEdit` predicate flips the record to `confirmed_first_nap` or
`confirmed_night_continuation` when the type is edited and the start falls inside
`[getMorningThreshold(dayStartHour), dayStartHour)`. **That predicate must read the edited start rather
than `existing.startedAt`** — that is the only line this rule changes.

- A start moved into that window with no toggle re-runs `classifyNewMorningSleep` and lands on
  `unresolved` or `automatic`, which the standing confirmation prompt then handles with no new surface.
- A start moved out of it returns a stale `confirmed_*` to `automatic`.
- `MORNING_CLASSIFICATION_VERSION` is stamped as it is today.

Leaving it stale would let an edited time move a sleep into or out of the ambiguous morning window
while the stored answer kept pointing at the old one.

### A time edit is not a client-only change

An edited `ended_at` fires `on_sleep_update_last_ended` from
`supabase/migrations/053_tombstone_aware_wake_window_reminders.sql` and moves
`babies.last_sleep_ended_at`, which `supabase/functions/check-wake-window-reminders/index.ts` reads as
the wake time for a push reminder. A time edit therefore reschedules the wake-window push. This is
assertable: `scripts/sql/tombstone-reminder-tests.sql` already asserts `babies.last_sleep_ended_at`
against local Supabase, and `scripts/run-sql-vectors.mjs` registers each vector file explicitly.

An edit made offline replays through the sync engine as a generic table write. Unlike the running
timer's start, no server-side recheck applies, because a past time stays past, so a queued edit lands
as issued.

### Everything downstream re-derives

Sleep type, sleep-day bucket, bedtime averages and their standard deviation, wake windows, and the
prediction and drift model all re-derive from the saved row, so they need no change beyond the
recomputation named above.

## Implementation work

- [x] Extract a shared start/end form section carrying two date-and-time pill pickers and a derived
      read-only duration readout, handling the iOS combined-datetime and Android separate-picker
      strategies once, with picker ranges supplied by the caller.
- [x] Add an end-time-aware entry point to `src/validators/sleep.ts` reached with a duration derived
      from two times, leaving every threshold unchanged.
- [x] Rebuild `app/sleep/manual.tsx` on the shared section: add End Time, remove `durationMinutes`,
      `durationInput`, and `QUICK_DURATIONS`, and derive the saved `durationSeconds` and `endedAt` from
      the two times.
- [x] Rebuild `app/edit/sleep.tsx` on the shared section: add Start Time and End Time, remove the
      minutes field and the `endedAt = startedAt + durationSeconds` derivation, and prefill both
      pickers from the record's own stored timestamps.
- [x] Implement the conditional save: write `durationSeconds = end - start` only when a time actually
      changed, leaving `durationSeconds` and `endedAt` untouched on a note-only or type-only save.
- [x] Wire `checkAndConfirmSleep` into `app/edit/sleep.tsx` against the post-edit values, excluding the
      edited record by id.
- [x] Change the `isApplicableMorningEdit` predicate in `updateSleep` to read the edited start rather
      than `existing.startedAt`, keeping `MORNING_CLASSIFICATION_VERSION` stamped as it is today.
- [x] Add the End Time label, the derived Duration label, and any new validation strings to all nine
      locale files under `src/i18n/locales/`, and remove keys the dropped chips and minutes field
      leave unused.
- [x] Component tests on both screens: the end picker offers `start + 1 minute` through the earlier of
      now and `start + 24h`, the start picker offers up to the earlier of now and `end - 1 minute`, the
      duration readout is derived and not editable, no minutes input and no quick-duration chips
      remain, and Save is disabled until the two times are a minute apart. `app/edit/sleep.tsx` has no
      component test today, so this is a new file.
- [x] A prefill test that a sleep whose stored `durationSeconds` is smaller than its own interval opens
      showing the real start and end rather than `start + duration`.
- [x] Save-rule tests: a save that changes only a note leaves `durationSeconds` and `endedAt`
      unchanged, and a save that moves a time writes `end - start`.
- [x] Overlap tests: editing a sleep so that it overlaps another warns and preserves both records
      through Continue anyway, Cancel writes nothing, and the record being edited never matches itself.
- [x] Classification tests: moving a start across the day boundary re-derives Nap or Night, a toggle
      after that wins, a start moved into `[getMorningThreshold(dayStartHour), dayStartHour)` re-runs
      classification and can land `unresolved`, a start moved out of it returns a `confirmed_*` to
      `automatic`, and the predicate reads the edited start rather than the stored one.
- [x] The Task 0068 edit-screen proof items: a sleep written after the counted-pause rule opens with a
      derived length equal to its stored length and no annotation, and a sleep written before it opens
      showing its real interval while the Timeline row still shows the stored length, converging only
      when a time is edited and saved.
- [x] SQL vectors against local Supabase: an edited `ended_at` reaches `babies.last_sleep_ended_at`
      through `on_sleep_update_last_ended`. Extend an existing file under `scripts/sql/` or add one and
      register it in `scripts/run-sql-vectors.mjs`.
- [x] A test that the twenty-four-hour sleep cap is rejected on save as well as bounded in the picker.
- [x] The standing bar from `decisions/resolved/003-sleep-derivation-blast-radius.md`: after a
      time-editing save on a paused sleep, the Day view block, the Timeline daily summary, the Timeline
      row label, the CSV export, and the PDF report all report the same number.

## Human checkpoints

- [x] [verify] Extend the representative two-account sleep smoke so one caregiver edits the times of a
      record the other created · Steps: on simulator A record a sleep, on simulator B open it from the
      Timeline and move its end time earlier, then read the record on A · Expected: both accounts show
      the edited start, end, and derived length · Failure: the two accounts disagree, or the edit does
      not propagate · Reason: the master plan proves household record behavior through the two-account
      iOS smoke against local Supabase, which needs two simulators and separate caregiver accounts.

## Acceptance criteria

- [x] `app/sleep/manual.tsx` and `app/edit/sleep.tsx` both take a start time and an end time, with a
      derived read-only duration and no minutes input or quick-duration chips.
- [x] Both screens prefill from the record's own stored timestamps, so a legacy paused sleep opens
      showing its real interval.
- [x] Every bound is the picker's own range: no future value, end at least a minute after start, the
      24-hour cap honored, and Save disabled until the two times are a minute apart.
- [x] `durationSeconds` is rewritten as `end - start` only when a time actually changed; a note-only or
      type-only save leaves the stored length exactly as it was.
- [x] Editing a sleep into an overlap warns, Continue anyway preserves both records, Cancel writes
      nothing, and the edited record never matches itself.
- [x] Moving a sleep's start re-derives Nap or Night, a later toggle wins, and the morning predicate
      reads the edited start.
- [x] An edited `ended_at` moves `babies.last_sleep_ended_at`, proved by an SQL vector.
- [x] A sleep written after Task 0068 opens with a derived length equal to its stored length and no
      annotation; one written before opens showing its real interval and converges only on a saved time
      edit.
- [x] After a time-editing save on a paused sleep, the Day view block, Timeline daily summary, Timeline
      row label, CSV export, and PDF report report the same number, with no consumer repointed.
- [x] The shared start/end form section is reusable by Tasks 0073 and 0075.
- [x] The `[verify]` checkpoint confirmed by the owner.

## Non-goals

- Feeding, pumping, and tummy time, which are Tasks 0073 and 0075.
- Wiring the duplicate check for any type other than sleep, which is
  `decisions/resolved/019-interval-overlap-non-sleep.md`.
- Any change to pause accounting, settled by Task 0068.
- Backfilling records written before the counted-pause rule.
- A stop-time control on any surface, refused by `decisions/resolved/008-stop-time-rewind.md`.
- Changing the running timer's bounds or its clamp, which is Task 0071.
- Storing a paused span on a saved record, or any other schema change.
- Changing how statistics union overlapping sleep.
- Making the Timeline's edit route easier to find.

## Review decisions

- skipped (minor): TR-10 — Morning re-classification changes more than the frozen predicate line — user requested remediation only through TR-9.
- skipped (minor): TR-11 — A stale confirmed classification can survive a move out of the morning window — user requested remediation only through TR-9.
- skipped (minor): TR-12 — Over-24-hour selections have no visible explanation — user requested remediation only through TR-9.
- skipped (minor): TR-13 — Two Task 0068 edit-screen proof cases are missing — user requested remediation only through TR-9.
- skipped (minor): TR-14 — The 24-hour save-rejection assertion is vacuous — user requested remediation only through TR-9.
- skipped (minor): TR-15 — The edit screen lacks a minimum-duration disabled-state test — user requested remediation only through TR-9.
- skipped (minor): TR-16 — Sleep picker labels depend on unguarded feeding locale keys — user requested remediation only through TR-9.
- skipped (minor): TR-17 — The SQL vector only proves moving an end later — user requested remediation only through TR-9.
- skipped (minor): TR-18 — The implementation commit added task-body metadata — user requested remediation only through TR-9.

## Completion record

Completed on 2026-08-07.

- **Built:** Manual sleep entry and completed-sleep editing now use a shared start/end clock-time
  section with derived duration, platform-specific date/time pickers, bounded validation, overlap
  confirmation, conditional legacy-record convergence, morning reclassification, nine-locale
  coverage, and a wake-window reminder SQL vector.
- **Decisions:** A fresh manual form starts with a valid one-minute interval. Android dismissal leaves
  values unchanged, rendered picker values clamp to their displayed bounds, and caller bounds stay
  stable across unrelated rerenders. Metadata-only edits preserve stored timestamps and duration;
  time edits derive duration from the edited interval and run overlap confirmation.
- **Relevant files:** `src/components/StartEndTimeSection.tsx`, `app/sleep/manual.tsx`,
  `app/edit/sleep.tsx`, `src/validators/sleep.ts`, `src/contexts/sleep-context.tsx`, locale files under
  `src/i18n/locales/`, `scripts/sql/tombstone-reminder-tests.sql`, and their component, integration,
  validation, localization, storage, sync, and SQL tests.
- **README:** Updated the Sleep Predictions section to describe start/end clock-time entry, the
  one-minute through 24-hour saved range, future-time rejection, conditional duration rewriting, and
  overlap warnings for time edits. The affected prose passed two `write-well` audit passes; pass 1
  corrected an overbroad picker claim and pass 2 found no new issues.
- **Review:** The independent standards, spec, bug, and security review reported no security finding.
  TR-1 through TR-9 were fixed and verified. TR-10 through TR-18 were skipped as minor or nit findings
  after the user requested remediation only through TR-9; their individual reasons remain recorded
  above. No security risk was accepted.
- **Automated proof:** `npm run check:code` passed on 2026-08-07 with exit 0, including 98 Jest suites
  and 946 tests, 65 CI-contract tests, and the production-bundle gate. PR CI then exposed
  `GHSA-5p4m-2wfm-xmqj` in the unchanged transitive `js-yaml` lock entries. Updating 3.15.0 to 3.15.1
  and 4.3.0 to 4.3.1 cleared `npm run audit:dependencies`; `npm run check:code` passed again on the
  revised working tree.
- **Manual proof:** Local Supabase plus the `SofiBaby Owner` and `SofiBaby Member` iOS simulators passed
  the representative household sleep flow. The member changed the owner's sleep from 7:20–8:20 AM to
  7:20–8:19 AM and saw the derived duration change from 1h to 59m. The saved row retained the owner's
  attribution with `ended_at` 06:19 UTC and `duration_seconds` 3540. The owner then reopened the record
  and displayed 7:20 AM, 8:19 AM, and 59m.
