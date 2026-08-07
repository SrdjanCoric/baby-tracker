# Task 0076: Warn on an overlapping feeding, pumping session, or tummy time

**Branch**: `feature/warn-on-overlapping-non-sleep-records`
**Depends on**: 0073, 0075
**Source**: `plans/decision-maps/unified-timer-contract/decisions/resolved/019-interval-overlap-non-sleep.md`
(resolved), which depends on `decisions/resolved/009-clock-time-log-editing.md` · **User stories**: As a
caregiver, I want the app to tell me when a feeding, pumping session, or tummy time I am logging
overlaps one that is already there, so that two of us logging the same session do not silently record
it twice.

## What to build

Six screens gain a duplicate check they have never run — `app/feeding/manual.tsx`,
`app/pumping/manual.tsx`, `app/tummyTime/manual.tsx`, and the three matching screens under `app/edit/`
— and the three checkers behind them learn to compare intervals the way `checkSleepDuplicate` already
does.

The three types are one task because, once Tasks 0073 and 0075 have given all six screens their final
clock-time shape, wiring them is a single mechanical application of one rule set, and the checkers,
the hook, the dialog, and their tests already exist as dead code.

### The rule

Applied within a type and never across types.

- **Interval branch, ahead of the threshold test.** When both records carry a real interval — `endedAt`
  present and later than `startedAt` — the checker asks whether the intervals overlap and reports
  `overlapping_session` at `high` confidence with no threshold, using the same predicate
  `checkSleepDuplicate` applies (`newStart < existingEnd && existingStart < newEnd`). Intervals that
  merely touch at a boundary do not overlap.
- **Proximity fallback, unchanged.** When either record lacks a real interval, the checker falls back to
  that type's existing start-proximity threshold and confidence heuristic exactly as shipped: 15 minutes
  for feeding and pumping, 5 minutes for tummy time. The 20 ml rule in `checkFeedingDuplicate` and
  `checkPumpingDuplicate` and the 60-second rule in `checkTummyTimeDuplicate` survive on this path only,
  since an overlap is reported at `high` outright.
- A bottle feed and a solids entry stay moment records under Task 0073, so they always take the
  proximity path, as does any older entry saved without a duration and any entry whose `endedAt` equals
  its `startedAt`.
- `checkFeedingDuplicate` keeps its feeding-type filter, so breast never compares against bottle.
- **A missing `endedAt` never means a running session.** `checkSleepDuplicate` treats an open-ended
  existing sleep as an overlap because an unfinished sleep is a live timer. For these three types a
  missing end is ordinary data and routes to proximity instead.
- **No cross-type comparison.** A pumping session inside a feed, or tummy time logged across one by a
  second caregiver, is real caregiving. Each type compares only against its own kind.

### Wiring the six screens

- `app/pumping/manual.tsx` and `app/tummyTime/manual.tsx` destructure only their add function from
  context and must also take the entry list (`pumpings`, `tummyTimes`). `app/feeding/manual.tsx` and all
  three edit screens already hold theirs.
- Each edit screen excludes the record being edited by id, as
  `decisions/resolved/009-clock-time-log-editing.md` requires, so a record never matches itself. Task
  0072 establishes this pattern on `app/edit/sleep.tsx`; follow it.
- `useDuplicateCheck` passes `matchReason` on the sleep path alone today. `checkAndConfirmFeeding`,
  `checkAndConfirmPumping`, and `checkAndConfirmTummyTime` must pass it too, or the overlap wording
  never reaches the dialog.

### Dialog copy

`DuplicateConfirmationDialog` gates overlap wording on `activityType === 'sleep' && matchReason ===
'overlapping_session'`. It stops keying on the activity type and keys on the match reason alone, with
per-activity copy, so an overlap reads as an overlap for all four types. Sleep's shipped wording is
preserved unchanged. Overlap title and message keys for feeding, pumping, and tummy time are added to
all nine locale files under `src/i18n/locales/`, alongside the existing `sleepOverlapTitle` and
`sleepOverlapMessage`.

### Policy

Warn, allow, and keep both — the master plan's policy for sleep — now governs three more types. Nothing
is blocked, nothing is merged, and statistics are untouched.

## Implementation work

- [x] Add the interval branch to `checkFeedingDuplicate`, `checkPumpingDuplicate`, and
      `checkTummyTimeDuplicate` in `src/services/duplicate-detection.ts`, ahead of each threshold test,
      leaving every threshold and confidence heuristic on the proximity path unchanged.
- [x] Pass `matchReason` to the dialog from the feeding, pumping, and tummy time paths of
      `useDuplicateCheck`.
- [x] Key the overlap wording in `DuplicateConfirmationDialog` on `matchReason` rather than on
      `activityType === 'sleep'`, with per-activity title and message, preserving sleep's current copy.
- [x] Add overlap title and message keys for feeding, pumping, and tummy time to all nine locale files
      under `src/i18n/locales/`.
- [x] Wire `checkAndConfirmFeeding` into `app/feeding/manual.tsx` and `app/edit/feeding.tsx`,
      `checkAndConfirmPumping` into `app/pumping/manual.tsx` and `app/edit/pumping.tsx`, and
      `checkAndConfirmTummyTime` into `app/tummyTime/manual.tsx` and `app/edit/tummyTime.tsx`.
- [x] Take the entry list from context in `app/pumping/manual.tsx` and `app/tummyTime/manual.tsx`.
- [x] Exclude the record being edited by id on all three edit screens.
- [x] Checker unit tests for each of the three types: overlapping intervals report `overlapping_session`
      at `high`; intervals that touch at a boundary do not match; a record with no end, or with
      `endedAt` equal to `startedAt`, takes the proximity path with its existing threshold and
      confidence; bottle against bottle stays on proximity; breast against bottle never compares.
- [x] Component tests on all six screens: an overlapping same-type record raises the dialog, Continue
      anyway saves both records, Cancel writes nothing, and an edit never matches the record being
      edited.
- [x] Tests that no comparison crosses activity types: a pumping session overlapping a feed raises
      nothing, and tummy time logged across a feed raises nothing.
- [x] Tests that the overlap title and message resolve in all nine locales, and that the dialog shows
      overlap wording — not the proximity copy — for a feeding, a pumping, and a tummy time match.

## Acceptance criteria

- [x] All six screens run a same-type duplicate check on save, and none did before.
- [x] Two records of one type whose intervals overlap raise the dialog at `high` confidence with
      `overlapping_session`, regardless of how far apart their starts are.
- [x] A record lacking a real interval — no `endedAt`, or `endedAt` equal to `startedAt` — takes its
      type's existing proximity threshold and confidence heuristic, unchanged.
- [x] Breast never compares against bottle, and no check ever compares across activity types.
- [x] Continue anyway saves both records; Cancel writes nothing; no save is ever blocked.
- [x] An edit never matches the record being edited.
- [x] Overlap wording reaches the dialog for feeding, pumping, and tummy time in all nine locales, and
      sleep's overlap wording is unchanged.
- [x] No schema change, no statistics change, and no check on a timer-stop save.

## Implementation proof

- Checker RED/GREEN cycles covered far-start overlap, boundary contact, missing and zero-length ends,
  bottle proximity, and feeding-type isolation. Focused result: 71 checker tests pass.
- Screen RED/GREEN cycles covered cancellation before each save flow was wired. The completed six-screen
  component matrix proves overlap wording, Cancel, Continue anyway, edit self-exclusion, and no
  pumping/tummy-time comparison against feeding. Focused result: 7 suites and 64 tests pass.
- Locale parity was RED in all nine locales before the new keys and GREEN afterward; the dialog test
  resolves per-activity overlap keys for feeding, pumping, tummy time, and the unchanged sleep path.
- Focused pre-review validation passed: affected unit tests, affected component tests, affected-file
  ESLint, repository typecheck, and `git diff --check`. Logs are retained in the task workflow directory.

## Non-goals

- Diaper and growth stay unwired; both are moment records outside this map's timer contract.
- Any comparison across activity types.
- Any change to the four thresholds, to the 20 ml or 60-second confidence heuristics, or to how
  statistics union overlapping records.
- Blocking or merging a save.
- A check on a timer-stop save, which writes a live record rather than a hand entry.
- Changing what the dialog says it found — whether overlap copy should name the overlap rather than the
  elapsed time is left open by the source decision.
- Any schema change.

## Review decisions

- skipped (minor): TR-9 — The overlap-copy lookup suppresses exhaustive type checking and can throw for an unsupported activity type — user requested fixes for major and minor findings only; nits are outside the requested severity scope.
- skipped (minor): TR-10 — The task file uses a nonstandard `Implementation proof` section — user requested fixes for major and minor findings only; nits are outside the requested severity scope.
- skipped (minor): TR-11 — Interval-overlap detection duplicates parsing work across three checkers — user requested fixes for major and minor findings only; nits are outside the requested severity scope.
