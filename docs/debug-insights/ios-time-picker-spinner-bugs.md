# iOS Time-Only Spinner Picker: Greyed-Out Hours

## Symptom

In Sleep Settings, the "Day starts at" / "Night starts at" time pickers (`mode="time"`, `display="spinner"`) on iOS only allowed selecting midnight and 1 AM. All other hours were greyed out. Same issue affected Quiet Hours pickers in Notification Settings.

## Root Cause

`@react-native-community/datetimepicker` with `mode="time"` + `display="spinner"` on iOS uses `UIDatePicker` in `.wheels` style, which has a fundamental UIKit bug that restricts the hour wheel.

### First occurrence: `minuteInterval` triggered the bug

The `minuteInterval` prop caused the **hour** wheel to become restricted, not just the minute wheel. With `minuteInterval: 30`, only hours 0 and 1 were selectable. Removing `minuteInterval` appeared to fix it (commit `2a59e07`).

### Second occurrence: bug recurred without `minuteInterval`

The greyed-out hours returned even without `minuteInterval` set. This confirmed the issue is deeper than just `minuteInterval` — `UIDatePicker` in `.wheels` style with `mode="time"` is fundamentally unreliable on iOS. The exact trigger varies by iOS version but the symptom is consistent.

### Secondary issue: onChange fires on every scroll tick

The iOS spinner fires `onChange` continuously during scrolling (not just on "Done"). Handlers that write to storage/sync on every tick cause render loops that reset the picker position.

## Fix

### Replaced iOS time pickers with `react-native-date-picker`

The `@react-native-community/datetimepicker` spinner is broken for `mode="time"` on iOS. Switched iOS time-only pickers to `react-native-date-picker` (henninghall), which has its own native wheel implementation that does not use `UIDatePicker` and avoids the bug entirely.

- **iOS:** Uses `RNDatePicker` with `mode="time"` — works correctly with all hours selectable
- **Android:** Keeps `@react-native-community/datetimepicker` with `mode="time"`, `display="default"` — unaffected by the bug

### Pending state pattern retained for iOS

`RNDatePicker` uses `onDateChange` which fires during scrolling. The pending state + "Done" button pattern is kept:
- `onDateChange` updates local pending state only
- "Done" button commits the pending value to storage/sync

## Files Changed

- `app/sleep/settings.tsx` — Day/Night boundary pickers (iOS: `RNDatePicker`, Android: `DateTimePicker`)
- `app/settings/notifications.tsx` — Quiet hours pickers (same pattern)

## Key Takeaway

`@react-native-community/datetimepicker` with `mode="time"` + `display="spinner"` on iOS is fundamentally broken due to a `UIDatePicker` UIKit bug. No combination of props (`minuteInterval`, `display`) reliably fixes it. Use `react-native-date-picker` for time-only spinner pickers on iOS. The `mode="datetime"` spinner in `@react-native-community/datetimepicker` is unaffected and remains safe to use elsewhere.
