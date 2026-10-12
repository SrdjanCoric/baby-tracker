# Task 0116: Delete unused functions inside live files with their tests

**Branch**: `feature/delete-dead-functions`
**Depends on**: 0115
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit and dead-code check, conversation 2026-10-08 (`docs/usage/test-audit.md`, section 7) · **User stories**: tests describe the rules the app really applies, not rules nobody calls.

## What to build

Remove exported functions and dead branches that no production code calls, with the test cases that cover them. Everything the app runs stays and behaves the same.

Verified dead on `main`:

- Validators: feeding (validateFeedingType, validateEndTime, validateFeedingDuration, validateBreastfeeding, validateBottleFeeding, calculateFeedingDuration, validateSolidAmount, validateSolidReaction, validateSolidFeeding); sleep (validateSleepEndTime, validateSleepDuration, calculateSleepDuration, validateSleep); pumping (validatePumpingDuration, validateEndTime, validatePumping); tummy time (validateTummyTimeEndTime, validateTummyTimeDuration, validateDailyGoal, calculateDailyProgress, calculateTodaysTotalSeconds, validateTummyTime); auth (everything except validateEmail); baby (calculateBabyAge, calculateBabyAgeInWeeks, calculateBabyAgeInDays).
- Statistics: calculateSleepStats, calculateWeeklyBreakdown, calculateExtendedSleepStats, calculateExtendedDiaperStats, calculateDailyAverages and their types. Timeline: formatDailySummaryText, formatRelativeDate.
- getNapsForAge, sanitizeCSVValue, processPendingTimerStop, generateInviteCode.
- Sync queue: dequeue, peek, optimize, getStaleOperations, and helpers only they used.
- Diaper and growth duplicate checks (hook and service).
- Notification routes and the service method exposing them (no notification-tap handler exists).
- The live-update "own device" filter and its device-id members (nothing ever writes the field it checks).

## Decided

- Dead code goes with its tests, after verifying it is dead. — Owner decision 2026-10-08.
- Re-check each function on the branch before deleting; anything that gained a production caller is kept and reported. — Verified on `main` at planning time.
- Keep: growth validators; feeding validateStartTime, validateStartTimeNotInFuture, validateBreastSide, validateBottleContentType, validateFoodType; manual and import validators; calculateFeedingStats, calculateDiaperStats, toLocalDateKey; the coordinator's read helpers; sync queue core methods; invite code validate, normalize and format. — Live callers.

## Clarifications

## Non-goals

- Making the diaper and growth duplicate warnings work (would be new behavior).
- Adding a notification-tap handler.
- Changing any live rule.

## Context

About 330 test cases cover these functions. Applying the same live change twice already does nothing, and that is well tested, so removing the never-matching "own device" filter loses no protection.

## Implementation work

- [ ] Every listed function, type and branch is deleted with its test cases — proven by `npm run typecheck` and `npm run lint`
- [ ] All kept functions still pass their existing tests — proven by `npm run check:code`

## Acceptance criteria

- [ ] `npm run check:code` passes.
- [ ] A search on the branch finds no remaining reference to any deleted name outside `docs/` and `plans/`.
- [ ] `docs/usage/logging-and-editing.md`: the diaper and growth duplicate windows are removed from the duplicates line.
