# Screen UX Reliability Gaps

**Date:** 2026-02-20
**Files involved:** `app/(tabs)/index.tsx`, `app/(tabs)/timeline.tsx`, `app/pumping/index.tsx`, `app/edit/feeding.tsx`, `app/edit/sleep.tsx`, `app/edit/diaper.tsx`, `app/edit/pumping.tsx`, `app/edit/growth.tsx`, `app/edit/tummyTime.tsx`, `app/diaper/index.tsx`, `app/growth/index.tsx`

## Symptom

Six distinct UI-level reliability issues:
1. Pull-to-refresh on Home and Timeline screens silently swallowed errors — if any single refresh threw, `Promise.all()` rejected immediately, other refreshes never completed, and the user saw stale data with no indication.
2. Pumping volume validation silently returned when volume was null/0 — user tapped Save repeatedly with no feedback.
3. Edit screens showed "Loading..." forever if the entry was deleted by another caregiver (common in multi-caregiver households).
4. Diaper screen was the only activity screen missing `Keyboard.dismiss()` on header tap and the `dismiss-keyboard` testID.
5. `safeNavigate` used a hardcoded 50ms `setTimeout` to wait for modal dismissal — unreliable on slow devices.
6. Growth form cleared validation errors on every keystroke regardless of whether the new input was valid.

## Root Cause

1. `Promise.all()` fails fast — one rejection kills all pending refreshes.
2. Missing user feedback on the validation guard clause (`if (volumeMl <= 0) return`).
3. Edit screens had a single guard: `if (!feeding) return <Loading/>` — no way to distinguish "still loading" from "entry doesn't exist."
4. Diaper screen header was a plain `View` instead of a `Pressable` like every other screen.
5. `setTimeout(50)` is a race condition — animation duration varies by device.
6. `setErrors({...prev, field: ""})` ran unconditionally in `onChangeText`, clearing the error even if the user just typed a letter into an invalid value.

## Fix

1. Replaced `Promise.all()` with `Promise.allSettled()` in both Home and Timeline `handleRefresh`. Failures are logged via `console.warn` but don't block other refreshes.
2. Added `Alert.alert(t("common.error"), t("pumping.enterVolume"))` before the early return in `handleConfirmStop`.
3. Split the loading guard into two checks across all 6 edit screens: `(!entry && isLoading)` shows "Loading...", `(!entry && !isLoading)` shows "Entry not found" with a styled "Go Back" button. Added `entryNotFound` and `goBack` translation keys to EN/SR/ES.
4. Wrapped diaper screen header in `<Pressable onPress={() => Keyboard.dismiss()} testID="dismiss-keyboard">`.
5. Replaced `setTimeout(() => router.push(...), 50)` with `InteractionManager.runAfterInteractions(() => router.push(...))`.
6. Wrapped `setErrors()` calls in growth form `onChangeText` handlers with `if (!isNaN(numValue) && numValue > 0)` so errors only clear on valid numeric input.

## Lessons / Notes

- **`Promise.allSettled` over `Promise.all` for independent operations**: When refresh calls are independent and you want all of them to complete regardless of individual failures, `allSettled` is always the right choice. `Promise.all` is only appropriate when you need all-or-nothing semantics.
- **Silent returns are UX black holes**: Any validation guard that silently returns without feedback (`if (invalid) return`) will confuse users. Always pair with an Alert, inline error, or haptic feedback.
- **Loading vs not-found are different states**: When data is fetched asynchronously, `null` can mean "not yet loaded" or "doesn't exist." Use the context's `isLoading` flag to distinguish, especially in multi-caregiver apps where entries can be deleted by others.
- **`InteractionManager.runAfterInteractions` > `setTimeout`**: For waiting on React Native animations/transitions to complete, `InteractionManager` is the correct API. Hardcoded delays are fragile across device performance tiers.
- **Consistency across screens matters**: When every screen follows a pattern (keyboard dismiss, testIDs, loading states), the one that doesn't becomes a source of bugs and test failures.
