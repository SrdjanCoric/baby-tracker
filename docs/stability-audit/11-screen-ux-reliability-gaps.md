# Screen UX Reliability Gaps Audit Report

## Summary

Multiple screen-level issues affect user experience: pull-to-refresh silently fails, pumping volume validation gives no feedback, edit screens hang on deleted entries, and the diaper screen is missing keyboard dismissal. These are all UI-level reliability gaps that don't lose data but degrade the user experience.

---

## Issue 1: Pull-to-refresh swallows errors on Home and Timeline

**Severity: HIGH**
**Files:**
- `app/(tabs)/index.tsx`, lines 99-114
- `app/(tabs)/timeline.tsx`, lines 157-171

Both screens use `Promise.all()` for pull-to-refresh without error handling:

```typescript
// Home screen (index.tsx, lines 99-114)
const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await Promise.all([
      refreshFeedings(),
      refreshSleeps(),
      refreshDiapers(),
      refreshPumpings(),
      refreshMeasurements(),
      refreshTummyTimes(),
      refreshLocks(),
    ]);
  } finally {
    setRefreshing(false);
  }
}, [...]);
```

**Problem:** If any single refresh function throws (network error, Supabase timeout), `Promise.all()` rejects immediately. The other refresh calls may not complete. The `finally` block still clears the refreshing state, so the spinner stops and the user sees stale data with no error indication.

**Fix:** Use `Promise.allSettled()` so all refresh calls complete regardless of individual failures. Show a brief toast or banner if any failed:

```typescript
const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    const results = await Promise.allSettled([
      refreshFeedings(),
      refreshSleeps(),
      refreshDiapers(),
      refreshPumpings(),
      refreshMeasurements(),
      refreshTummyTimes(),
      refreshLocks(),
    ]);
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn('[Home] Some refreshes failed:', failures.length);
      // Optionally show a non-blocking toast
    }
  } finally {
    setRefreshing(false);
  }
}, [...]);
```

Apply the same pattern to `app/(tabs)/timeline.tsx`.

---

## Issue 2: Pumping volume validation gives no feedback

**Severity: MEDIUM**
**File:** `app/pumping/index.tsx`, lines 100-102

```typescript
const handleConfirmStop = useCallback(async () => {
  if (isSavingRef.current) return;
  if (volumeMl === null || volumeMl <= 0) return;  // Silent return
  // ...
}, [...]);
```

When the user taps Save without entering a volume (or with 0), the handler silently returns. No error message, no field highlighting, no haptic feedback. The user repeatedly taps Save with no understanding of why it doesn't work.

**Fix:** Show validation feedback before the silent return:

```typescript
if (volumeMl === null || volumeMl <= 0) {
  Alert.alert(t("common.validation"), t("pumping.enterVolume"));
  return;
}
```

Or better: highlight the volume input field as required using a local error state.

---

## Issue 3: Edit screen shows loading forever if entry was deleted

**Severity: MEDIUM**
**File:** `app/edit/feeding.tsx`, lines 24-26 and 191-199

```typescript
const feeding = useMemo(() => {
  return feedings.find((f) => f.id === id) ?? null;
}, [feedings, id]);

// ...

if (!selectedBaby || !feeding) {
  return (
    <SafeAreaView className="flex-1 ...">
      <Text>{t("common.loading")}</Text>
    </SafeAreaView>
  );
}
```

If a user navigates to `/edit/feeding?id=xyz` but the entry was deleted by another caregiver (or doesn't exist), `feeding` is permanently `null`. The screen shows "Loading..." indefinitely with no way to escape except pressing back.

**Impact:** User gets stuck on a loading screen. Common scenario in multi-caregiver households where one caregiver deletes an entry while another is navigating to edit it.

**Fix:** Add a timeout or check if feedings have loaded and the entry is simply not found:

```typescript
const feeding = useMemo(() => {
  return feedings.find((f) => f.id === id) ?? null;
}, [feedings, id]);

const feedingsLoaded = !isLoading;

if (!selectedBaby || (!feeding && !feedingsLoaded)) {
  return <LoadingView />;
}

if (!feeding && feedingsLoaded) {
  return (
    <SafeAreaView className="flex-1 ...">
      <Text>{t("common.entryNotFound")}</Text>
      <TouchableOpacity onPress={() => router.back()}>
        <Text>{t("common.goBack")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

Apply the same pattern to other edit screens if they exist (`app/edit/sleep.tsx`, etc.).

---

## Issue 4: Diaper screen missing keyboard dismiss handler

**Severity: LOW**
**File:** `app/diaper/index.tsx`, lines 91-100

The diaper screen header is a plain `View`:
```typescript
<View className="items-center pt-2 pb-3">
  <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
  <Text className="text-lg font-semibold ...">{t("diaper.logDiaperChange")}</Text>
  <Text className="text-sm ...">{selectedBaby.name}</Text>
</View>
```

Other screens (pumping, growth, feeding) wrap the header in a `Pressable` with `onPress={() => Keyboard.dismiss()}` and `testID="dismiss-keyboard"`. The diaper screen doesn't have this, creating an inconsistency.

**Impact:** Low — the diaper screen has limited text input. But if a notes field is ever added, keyboard dismissal would be needed. Also affects Maestro E2E testing which relies on the `dismiss-keyboard` testID.

**Fix:** Wrap the header in a `Pressable`:

```typescript
<Pressable
  onPress={() => Keyboard.dismiss()}
  className="items-center pt-2 pb-3"
  testID="dismiss-keyboard"
>
  <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
  <Text className="text-lg font-semibold ...">{t("diaper.logDiaperChange")}</Text>
  <Text className="text-sm ...">{selectedBaby.name}</Text>
</Pressable>
```

---

## Issue 5: safeNavigate relies on hardcoded 50ms timeout

**Severity: LOW**
**File:** `app/(tabs)/index.tsx`, lines 53-64

```typescript
const safeNavigate = useCallback((path: string) => {
  if (isFocused) {
    router.push(path as Parameters<typeof router.push>[0]);
  } else {
    router.dismissAll();
    setTimeout(() => {
      router.push(path as Parameters<typeof router.push>[0]);
    }, 50);
  }
}, [isFocused, router]);
```

The 50ms delay is a heuristic to let the modal dismissal complete before pushing a new route. On slow devices or under heavy load, the dismissal animation may not complete in time.

**Impact:** Navigation could fail or show a brief visual glitch on slow devices. Not a data issue.

**Fix:** Use `InteractionManager.runAfterInteractions()` instead of a hardcoded timeout:

```typescript
import { InteractionManager } from 'react-native';

const safeNavigate = useCallback((path: string) => {
  if (isFocused) {
    router.push(path as Parameters<typeof router.push>[0]);
  } else {
    router.dismissAll();
    InteractionManager.runAfterInteractions(() => {
      router.push(path as Parameters<typeof router.push>[0]);
    });
  }
}, [isFocused, router]);
```

---

## Issue 6: Growth screen clears errors optimistically before validation

**Severity: LOW**
**File:** `app/growth/index.tsx`, lines 296-298

```typescript
onChangeText={(text) => {
  setWeightValue(text);
  setErrors((prev) => ({ ...prev, weightKg: "", measurements: "" }));
}}
```

Error messages are cleared on every keystroke before the input is validated. The user sees the error disappear as soon as they start typing, even if the new input is still invalid.

**Impact:** Minor UX confusion. Errors reappear on save attempt, so no data integrity risk.

**Fix:** Only clear errors on valid input, or validate on change:

```typescript
onChangeText={(text) => {
  setWeightValue(text);
  const numValue = parseFloat(text);
  if (!isNaN(numValue) && numValue > 0) {
    setErrors((prev) => ({ ...prev, weightKg: "", measurements: "" }));
  }
}}
```

---

## Implementation Checklist

- [x] **Task 1:** Replace `Promise.all()` with `Promise.allSettled()` in `handleRefresh` on Home screen (`app/(tabs)/index.tsx`, lines 102-110).
- [x] **Task 2:** Replace `Promise.all()` with `Promise.allSettled()` in `handleRefresh` on Timeline screen (`app/(tabs)/timeline.tsx`, lines 160-166).
- [x] **Task 3:** Add validation Alert or inline error when pumping volume is null/0 (`app/pumping/index.tsx`, line 102).
- [x] **Task 4:** Add "entry not found" state to edit feeding screen (`app/edit/feeding.tsx`, lines 191-199). Show message with back button instead of infinite loading. Also applied to all other edit screens (sleep, diaper, pumping, growth, tummyTime).
- [x] **Task 5:** Add keyboard dismiss Pressable to diaper screen header (`app/diaper/index.tsx`, lines 91-100).
- [x] **Task 6:** Replace 50ms setTimeout with `InteractionManager.runAfterInteractions()` in safeNavigate (`app/(tabs)/index.tsx`, line 60).
- [x] **Task 7:** Only clear growth form errors when input is valid (`app/growth/index.tsx`, lines 296-298, 323-325, 350-352).
