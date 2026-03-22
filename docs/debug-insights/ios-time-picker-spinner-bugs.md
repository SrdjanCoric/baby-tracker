# iOS Time-Only Spinner Picker: Greyed-Out Hours & Scroll Reset

## Symptom

In Sleep Settings, the "Day starts at" / "Night starts at" time pickers (`mode="time"`, `display="spinner"`) on iOS only allowed selecting midnight and 1 AM. All other hours were greyed out. The `mode="datetime"` picker used elsewhere worked fine.

## Root Cause

Two independent bugs compounding:

### 1. `minuteInterval: 30` greys out hours on iOS spinner

The `minuteInterval` prop on `@react-native-community/datetimepicker` in `mode="time"` with `display="spinner"` on iOS causes the **hour** wheel to become restricted, not just the minute wheel. With `minuteInterval: 30`, only hours 0 and 1 were selectable — everything else was greyed out and unscrollable.

This appears to be an iOS-specific bug in how UIDatePicker handles `minuteInterval` with the wheels/spinner style. The same prop works fine on Android (dialog-style picker) and with `display="default"` (compact) on iOS.

### 2. onChange fires on every scroll tick, causing render loops

The iOS spinner fires `onChange` continuously during scrolling (not just on "Done"). The original handlers called `setDayNightBoundary` → async storage write → Supabase sync on every tick. The Realtime subscription then pushed the update back, triggering re-renders that reset the picker position.

## Fix

### Remove `minuteInterval` from iOS spinner pickers

Since these pickers only need whole hours (the minute component is ignored), `minuteInterval` was removed from the iOS spinner instances. Android dialog pickers retain it since they're unaffected.

### Defer state commits to "Done" button on iOS

Instead of committing on every `onChange` tick:
- **iOS:** `onChange` only updates local pending state (`setPendingDayStartHour`). The "Done" button handler commits the pending value to storage/sync.
- **Android:** Commits immediately in `onChange` (dialog-style picker dismisses on selection).
- **Picker value** is memoized via `useMemo`, using pending state during scrolling to prevent resets.

## Files Changed

- `app/sleep/settings.tsx` — Day/Night boundary pickers
- `app/settings/notifications.tsx` — Quiet hours pickers (same pending-state pattern, no `minuteInterval` to remove)

## Key Takeaway

`minuteInterval` on `@react-native-community/datetimepicker` with `mode="time"` + `display="spinner"` on iOS restricts the hour wheel, not just minutes. Avoid using it with spinner display, or test thoroughly on iOS. For hour-only pickers, omit it entirely.
