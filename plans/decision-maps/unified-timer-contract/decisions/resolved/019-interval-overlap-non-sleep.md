# Decision: interval overlap detection for feeding, pumping, and tummy time

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** standalone
**Cluster:** none
**Depends on:** [clock time log editing](009-clock-time-log-editing.md)
**Claim:** none

## Question

Should feeding, pumping, and tummy time warn on a genuine interval overlap the way sleep does, rather
than on start-time proximity alone?

## Context

`checkSleepDuplicate` compares intervals and reports `overlapping_session`, while the other three
types only ask whether two start times fall inside a fixed threshold. That asymmetry existed because a
hand-entered feeding had no end time to compare.
[Clock time log editing](009-clock-time-log-editing.md) gives every hand-entered record of
those three types an end time, so interval overlap is now computable for all four.

Whether it should be reported is a separate question from whether it can be. Two overlapping naps are
impossible, while a pumping session during a feed, or tummy time logged across a feed by a second
caregiver, may be exactly what happened.

Feeding, pumping, and tummy time run no duplicate check at all, on any screen, so this decision also
settles whether to switch the feature on for those three types.

## Evidence

- `DUPLICATE_THRESHOLDS` at `src/services/duplicate-detection.ts:8` sets 15 minutes for feeding and
  pumping and 5 minutes for tummy time.
- `checkSleepDuplicate` at `src/services/duplicate-detection.ts:109` is the only checker that compares
  intervals, at `:132` to `:145`; the other five compare a single timestamp.
- Only `app/sleep/manual.tsx:37` imports `useDuplicateCheck`, and `checkAndConfirmSleep` at `:154` is
  its only call site anywhere in the tree. `checkFeedingDuplicate`, `checkPumpingDuplicate`,
  `checkTummyTimeDuplicate`, `checkDiaperDuplicate`, and `checkGrowthDuplicate` are implemented and
  covered by 963 lines of tests but reached from no screen. The module and its hook shipped whole in
  commit `f1257c4`; sleep was wired later, in `3d1a293`, and nothing else ever was.
- Feeding, pumping, and tummy time records all carry optional `endedAt` and `durationSeconds`
  (`src/services/feeding-storage.ts:21`, `pumping-storage.ts:18`, `tummyTime-storage.ts:21`), and the
  manual screens already derive `endedAt` as `start + duration` when a duration is given
  (`app/feeding/manual.tsx:303`, `app/tummyTime/manual.tsx:131`). A bottle feed and a solids entry are
  written with a start alone (`app/feeding/manual.tsx:324` and `:342`), and an entry saved without a
  duration lands with `endedAt` equal to `startedAt`.
- `checkFeedingDuplicate` skips existing entries whose feeding type differs
  (`src/services/duplicate-detection.ts:70`), so bottle never compares against breast.
- `DuplicateConfirmationDialog.ts:40` gates the overlap wording on
  `activityType === 'sleep' && matchReason === 'overlapping_session'`, and `useDuplicateCheck` passes
  `matchReason` on the sleep path alone. The `sleepOverlapTitle` and `sleepOverlapMessage` keys exist
  in nine locale files under `src/i18n/locales/`.
- The master plan's warn, allow, and union policy is written for sleep alone.
- [Clock time log editing](009-clock-time-log-editing.md) extends the per-type check to the edit
  screens without changing what each type detects.

## Resolution

- **Decision:** Yes, and the check is wired into the manual add and edit screens of all three types,
  which run none today.

  **The rule, applied within a type and never across types.** When both records carry a real interval,
  meaning `endedAt` is present and later than `startedAt`, the checker asks whether the intervals
  overlap and reports `overlapping_session` at `high` confidence with no threshold, using the
  predicate `checkSleepDuplicate` already applies. When either record lacks a real interval, the
  checker falls back to that type's existing start-proximity threshold and confidence heuristic,
  unchanged: 15 minutes for feeding and pumping, 5 minutes for tummy time.

  A bottle feed and a solids entry stay moment records under
  [clock time log editing](009-clock-time-log-editing.md), so they always take the proximity path, as
  does any older entry saved without a duration. `checkFeedingDuplicate` keeps its feeding-type
  filter, so bottle still never compares against breast.

  Unlike sleep, a missing `endedAt` never means a session is running. `checkSleepDuplicate` treats an
  open-ended existing sleep as an overlap because an unfinished sleep is a live timer; for these three
  types a missing end is ordinary data, so it routes to proximity instead.

  **No cross-type comparison.** A pumping session inside a feed, or tummy time logged across one by a
  second caregiver, is real caregiving. Each type continues to compare only against its own kind.

- **Rationale:** Every overlap the interval rule reports is physically impossible. One baby cannot take
  two breast feeds at once, one person cannot run two pumping sessions at once, and no two tummy times
  overlap. That keeps the dialog rare enough to be read rather than dismissed, which is the same bet
  the sleep overlap warning already makes.

  Proximity alone misses the case the caregiver actually hits. A twenty-minute feed logged a second
  time seventeen minutes later overlaps in fact and sits outside the fifteen-minute window, so the
  check stays silent on a genuine double-log while firing on two short feeds that merely sit close
  together.

  The comparison is possible only because
  [clock time log editing](009-clock-time-log-editing.md) gives every hand-entered record of these
  three types an end, and that decision had already committed the edit screens to running a check.
  Wiring the three types costs little, because the checkers, the hook, the dialog, and the tests all
  exist and have only ever been dead code.

- **Alternatives rejected:**
  - *Wire the three checkers as written, proximity only.* The smallest change, and it needs no new
    comparison logic. Rejected because it makes permanent the asymmetry
    [clock time log editing](009-clock-time-log-editing.md) removed, and because it stays silent on
    overlaps whose starts fall outside the window.
  - *Leave the three types unchecked and resolve this as a no.* No work at all. Rejected because it
    leaves double-logging silent on the three types two caregivers are most likely to log at once,
    while the code to catch it is already written and tested.
  - *Drop the same-type filter so a pumping session overlapping a feed also warns.* Catches one event
    logged twice under two types. Rejected because pumping during a feed is ordinary, and a dialog
    that fires on normal caregiving teaches people to tap through the one that matters.
  - *Wire diaper and growth at the same time.* Consistency across every checker in the module.
    Rejected as unrelated work; both are moment records outside this map's timer contract, and neither
    gains anything from an interval.

- **Consequences:**
  - Six screens gain a check they have never run: `app/feeding/manual.tsx`, `app/pumping/manual.tsx`,
    `app/tummyTime/manual.tsx`, and the three matching screens under `app/edit/`.
    `app/pumping/manual.tsx:42` and `app/tummyTime/manual.tsx:33` destructure only their add function
    and must also take the entry list from their context. `app/feeding/manual.tsx:98` and all three
    edit screens already hold theirs.
  - `checkFeedingDuplicate`, `checkPumpingDuplicate`, and `checkTummyTimeDuplicate` each gain the
    interval branch ahead of the threshold test. The 20 ml rule at
    `src/services/duplicate-detection.ts:213` and the 60-second rule at `:315` survive on the
    proximity path only, since an overlap is reported at `high` outright.
  - `useDuplicateCheck` passes `matchReason` on the sleep path alone. The three type paths must pass
    it too, or the overlap wording never reaches the dialog.
  - `DuplicateConfirmationDialog.ts:40` stops keying the overlap wording on `activityType === 'sleep'`
    and keys it on the match reason, with per-activity copy. That adds overlap title and message keys
    to all nine locale files under `src/i18n/locales/`.
  - The edit screens exclude the record being edited by id, as
    [clock time log editing](009-clock-time-log-editing.md) requires, so a record never matches itself.
  - Warn, allow, and keep both, the master plan's policy for sleep, now governs three more types.
    Nothing is blocked or merged, and statistics are untouched.
  - [Clock time log editing](009-clock-time-log-editing.md) said the edit screens gain the check they
    run today only on the add screens. Only sleep's add screen runs one, and that record's consequence
    is corrected to say so.

- **Non-goals:** Diaper and growth stay unwired. No comparison across activity types. No change to the
  four thresholds, to the 20 ml or 60-second confidence heuristics, or to how statistics union
  overlapping records. No save is ever blocked. No check on a timer-stop save, which writes a live
  record rather than a hand entry. No schema change.

- **Required proof:** Checker unit tests for each of the three types: overlapping intervals report
  `overlapping_session` at `high`; intervals that touch at a boundary do not match; a record with no
  end, or with `endedAt` equal to `startedAt`, takes the proximity path with its existing threshold and
  confidence; bottle against bottle stays on proximity; breast against bottle never compares.

  Component tests on all six screens: an overlapping same-type record raises the dialog, Continue
  anyway saves both records, Cancel writes nothing, and an edit never matches the record being edited.

  The overlap title and message resolve in all nine locales, and the dialog shows overlap wording for
  a feeding, a pumping, and a tummy time match rather than falling back to the proximity copy.

## Follow-on

- **Newly sharp decisions:** None
- **Still-foggy areas:**
  - Whether the dialog should say what it found. "Overlaps an existing entry" and "logged 8 minutes
    ago" are different claims, and the copy currently splits them by activity type rather than by
    match reason.
