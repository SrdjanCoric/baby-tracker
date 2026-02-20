# Timer Save Data Loss — Silent Failures on Stop

**Date:** 2026-02-20
**Files involved:** `src/contexts/feeding-context.tsx`, `src/contexts/sleep-context.tsx`, `src/contexts/pumping-context.tsx`, `src/contexts/tummyTime-context.tsx`, `app/feeding/index.tsx`, `app/sleep/index.tsx`, `app/pumping/index.tsx`, `app/tummyTime/index.tsx`

## Symptom

When a database/storage save fails during timer stop (network error, storage full, constraint violation), the user sees no error. The timer appears to stop but the activity data is silently lost. Additionally, the timer cleanup code (dispatch STOP_TIMER, clear active timer from storage, end live activity, release lock) never executes because it sits below the throwing save call — leaving the user stuck with a broken timer they can't restart.

Tummy time also lacked the `durationSeconds < 60` minimum duration guard that the other three contexts had, allowing trivial sub-minute entries to pollute the database.

## Root Cause

Two layered problems:

1. **Context layer:** The `stop*` functions in all four contexts had the save call (createInDatabase / addToStorage) with no try-catch. When the save threw, the error propagated upward and skipped all cleanup code (STOP_TIMER dispatch, clearActiveTimer, endLiveActivity, releaseTimerLock).

2. **Screen layer:** The screen handlers called `await stop*()` then `router.back()` inside a try block with only a `finally` clause (no `catch`). The error from the context bubbled up uncaught — `router.back()` was never reached, but no Alert was shown either. The `finally` block reset `isSaving`, leaving the user on a screen that looked functional but had a corrupted timer state underneath.

## Fix

**Context layer (all four contexts):** Wrapped the save call in try-catch. On error:
- Clean up timer state: `dispatch({ type: "STOP_TIMER" })`, clear active timer from storage, end live activity, release timer lock
- Re-throw so the screen layer knows the save failed

This ensures the timer is always cleaned up regardless of save outcome — the user is never stuck with a zombie timer.

**Screen layer (all four screens):** Added a `catch` block with `Alert.alert(t("common.error"), t("<activity>.stopError"))` to inform the user. The `finally` block still resets `isSaving` so the button re-enables for retry.

**Tummy time duration guard:** Added `if (durationSeconds < 60)` check to `stopTummyTime` with full cleanup, matching the existing pattern in feeding, sleep, and pumping contexts.

**Translation keys:** Added missing `pumping.stopError` to en.json, es.json, and sr.json.

## Lessons / Notes

- **Cleanup must not depend on save success.** When save and cleanup are sequential without error handling, a save failure blocks all subsequent cleanup. The pattern should be: try to save, if it fails clean up and re-throw, if it succeeds clean up normally.
- **`finally` without `catch` is not error handling.** A `finally` block resets UI state but tells the user nothing. Always pair it with a `catch` that surfaces the error.
- **Audit all instances of a pattern.** The `durationSeconds < 60` guard existed in 3 of 4 contexts. When a pattern is meant to be universal, grep for all instances and verify consistency.
- **The "happy path only" trap:** All four stop flows worked perfectly when saves succeeded. The failure path was never tested because it requires simulating network/storage errors during a timed activity — easy to miss in manual QA.
