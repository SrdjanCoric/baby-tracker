# Timer Save Data Loss Audit Report

## Summary

All four timed activities (feeding, sleep, pumping, tummy time) share the same critical pattern: the database/storage save call inside the context's `stop*` function has no try-catch. When the save throws, the calling screen handler navigates away without showing an error. The user believes data was saved, but it was not.

---

## Issue 1: No try-catch around save in context stop functions

**Severity: HIGH**

All four context stop functions follow the same unprotected pattern:

### Feeding (`src/contexts/feeding-context.tsx`, lines 542-548)
```typescript
let feeding: StoredFeedingEntry;
if (user?.householdId && user?.id) {
  feeding = await createFeedingInDatabase(feedingInput, user.id);
} else {
  feeding = await FeedingStorageService.addFeeding(feedingInput);
}
dispatch({ type: "ADD_FEEDING", payload: feeding });
dispatch({ type: "STOP_TIMER" });
```

### Sleep (`src/contexts/sleep-context.tsx`, lines 555-559)
```typescript
if (user?.householdId && user?.id) {
  sleep = await createSleepInDatabase(sleepInput, user.id);
} else {
  sleep = await SleepStorageService.addSleep(sleepInput);
}
```

### Pumping (`src/contexts/pumping-context.tsx`, lines 389-393)
```typescript
if (user?.householdId && user?.id) {
  pumping = await createPumpingInDatabase(pumpingInput, user.id);
} else {
  pumping = await PumpingStorageService.addPumping(pumpingInput);
}
```

### Tummy Time (`src/contexts/tummyTime-context.tsx`, lines 440-444)
```typescript
if (user?.householdId && user?.id) {
  tummyTime = await createTummyTimeInDatabase(tummyTimeInput, user.id);
} else {
  tummyTime = await TummyTimeStorageService.addTummyTime(tummyTimeInput);
}
```

**Impact:** If any save call throws (network error, storage full, database constraint), the error propagates uncaught to the screen handler. The timer state, live activity, and lock release code below the save call never execute.

**Fix:** Wrap each save block in try-catch. On error, still clean up the timer state (dispatch STOP_TIMER, clear active timer from storage, release lock, end live activity) so the user isn't stuck with a broken timer. Re-throw after cleanup so the screen handler can show an error Alert.

---

## Issue 2: Screen handlers navigate away on save failure

**Severity: HIGH**

All four screen stop handlers call `router.back()` inside a try block alongside the stop function. When the stop function throws, `router.back()` is NOT reached — but the `finally` block resets the saving state, leaving the user on a screen that appears ready to retry but may have a corrupted timer.

### Feeding (`app/feeding/index.tsx`, lines 97-108)
```typescript
const handleStopBreastfeeding = useCallback(async () => {
  if (isSavingRef.current) return;
  isSavingRef.current = true;
  setIsSaving(true);
  try {
    await stopBreastfeeding();
    router.back();
  } finally {
    isSavingRef.current = false;
    setIsSaving(false);
  }
}, [stopBreastfeeding, router]);
```

### Sleep (`app/sleep/index.tsx`, lines 95-108)
Same pattern with `stopSleep()`.

### Pumping (`app/pumping/index.tsx`, lines 100-113)
Same pattern with `stopPumping(volumeMl)`.

### Tummy Time (`app/tummyTime/index.tsx`, lines 113-125)
Same pattern with `stopTummyTime()`.

**Impact:** No error Alert is shown. The user sees the save button re-enable and doesn't know the save failed. If the context's stop function partially executed (e.g., timer was cleared but save failed), the timer data is lost.

**Fix:** Add a catch block that shows `Alert.alert()` informing the user the save failed. The user can then retry or discard.

```typescript
const handleStopBreastfeeding = useCallback(async () => {
  if (isSavingRef.current) return;
  isSavingRef.current = true;
  setIsSaving(true);
  try {
    await stopBreastfeeding();
    router.back();
  } catch (error) {
    Alert.alert(
      t("common.error"),
      t("feeding.saveFailed"),
      [{ text: t("common.ok") }]
    );
  } finally {
    isSavingRef.current = false;
    setIsSaving(false);
  }
}, [stopBreastfeeding, router, t]);
```

Apply the same pattern to all four screens.

---

## Issue 3: Tummy Time missing minimum duration validation

**Severity: MEDIUM**

Feeding (`feeding-context.tsx`, line 512), sleep (`sleep-context.tsx`, line 530), and pumping (`pumping-context.tsx`, line 363) all check `if (durationSeconds < 60)` and discard the session. Tummy time does not have this check.

**File:** `src/contexts/tummyTime-context.tsx`, lines 420-464

**Impact:** Tummy time sessions of <1 second can be saved, polluting the database and statistics with trivial entries.

**Fix:** Add the same `if (durationSeconds < 60)` guard to `stopTummyTime`, matching the pattern in the other three contexts. Clean up the timer, live activity, and lock on discard.

---

## Implementation Checklist

- [x] **Task 1:** Add try-catch around save calls in `stopBreastfeeding` (`feeding-context.tsx`, lines 542-548). On error: clean up timer state, re-throw.
- [x] **Task 2:** Add try-catch around save calls in `stopSleep` (`sleep-context.tsx`, lines 555-559). Same pattern.
- [x] **Task 3:** Add try-catch around save calls in `stopPumping` (`pumping-context.tsx`, lines 389-393). Same pattern.
- [x] **Task 4:** Add try-catch around save calls in `stopTummyTime` (`tummyTime-context.tsx`, lines 440-444). Same pattern.
- [x] **Task 5:** Add catch block with `Alert.alert()` to `handleStopBreastfeeding` (`app/feeding/index.tsx`, lines 97-108).
- [x] **Task 6:** Add catch block with `Alert.alert()` to `handleStopSleep` (`app/sleep/index.tsx`, lines 95-108).
- [x] **Task 7:** Add catch block with `Alert.alert()` to `handleConfirmStop` (`app/pumping/index.tsx`, lines 100-113).
- [x] **Task 8:** Add catch block with `Alert.alert()` to `handleStopTummyTime` (`app/tummyTime/index.tsx`, lines 113-125).
- [x] **Task 9:** Add `if (durationSeconds < 60)` check to `stopTummyTime` with timer cleanup (`tummyTime-context.tsx`, before line 429).
