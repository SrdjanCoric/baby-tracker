# Widget Interactive Stop Button: Stop Timer Without Opening App

## Problem

Tapping the stop button on the iOS widget opened the app instead of stopping the timer directly. The goal was to make the stop button an interactive widget control that stops the timer immediately without leaving the home screen, then completes the activity record when the app is next opened.

## Architecture

The solution uses `AppIntent` with `Button(intent:)` (iOS 17+) for in-widget execution, App Group UserDefaults for cross-process communication, and optionally APNs to dismiss the Live Activity on the lock screen.

### Flow

1. User taps stop button on widget
2. `StopActivityIntent.perform()` runs in the widget extension process:
   - DELETEs the `active_timers` row via Supabase REST (authenticated users only)
   - Writes `pendingWidgetStop` to App Group with activity type and timestamp
   - Calls `end-live-activity` Edge Function via APNs to dismiss Live Activity (if push token exists)
   - Clears active timer from widget data JSON for immediate visual update
   - Reloads all timelines
3. Widget immediately shows timer as stopped
4. App processes the stop on next foreground:
   - `useWidgetStopHandler` hook reads `pendingWidgetStop` from App Group
   - Calls the appropriate context stop function (creates activity record, clears local storage)
   - The stop function also ends the Live Activity locally via `endLiveActivityByType()`
   - Clears `pendingWidgetStop`

## Debugging Timeline

### Issue 1: `Button(intent:)` Not Firing

**Symptom:** Tapping the stop button did nothing. No logs, no `perform()` call.

**Root Cause:** The `AppIntents` framework was not included in the widget extension's build configuration.

**Fix:** Added `AppIntents` to the frameworks list in `targets/widget/expo-target.config.js`:

```js
frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents"],
```

### Issue 2: `widgetURL` Swallowing Button Taps

**Symptom:** After adding `AppIntents` framework, the stop button still opened the app instead of running the intent.

**Root Cause:** The `.widgetURL()` modifier on the parent view was intercepting all taps, including those on the `Button(intent:)`. WidgetKit's `widgetURL` takes priority over interactive controls.

**Fix:** Changed `.widgetURL(isRemote ? nil : activity.deepLinkURL)` to `.widgetURL(isActive ? nil : activity.deepLinkURL)` so that when a timer is active (and the stop button is shown), the widget URL is nil, allowing the button to receive taps. When no timer is active, the deep link opens the app as before.

### Issue 3: Credentials Missing for Guest Users

**Symptom:** `perform()` was called but REST DELETE failed because `supabaseUrl`, `accessToken`, etc. were all nil.

**Root Cause:** Guest users have no Supabase auth session, so no credentials were written to App Group.

**Fix:** Restructured `perform()` to:
1. Always write `pendingWidgetStop` regardless of auth state
2. Only attempt REST DELETE when all credentials are present
3. Write `supabaseUrl` and `supabaseAnonKey` to App Group for all users (needed for Edge Function calls)

### Issue 4: Live Activity Persists on Lock Screen

**Symptom:** Timer stopped in widget but the Live Activity countdown continued on the lock screen.

**Root Cause:** Widget extensions run in a separate process and cannot access `Activity<T>.activities` from the main app — `Activity.activities` returned 0 items.

**Fix:** Implemented APNs push approach:
1. `LiveActivityController.swift` changed to use `pushType: .token` and observe `pushTokenUpdates`, saving the token to App Group
2. Created `end-live-activity` Supabase Edge Function that sends an APNs `liveactivity` push with `event: "end"` and `dismissal-date`
3. Widget's `StopActivityIntent` calls this Edge Function with the stored push token

**Limitation:** APNs key is production-only, so Live Activity dismissal only works in production/TestFlight builds. In dev builds, the Live Activity persists until the app is opened (where `useWidgetStopHandler` processes the stop and ends it locally).

### Issue 5: Edge Function 503 in Dev

**Symptom:** Edge Function returned 503 "name resolution failed" when trying to reach APNs.

**Root Cause:** Dev builds generate sandbox push tokens, but the APNs key only supports the production environment (`api.push.apple.com`). Sandbox tokens cannot be delivered through the production endpoint.

**Resolution:** Accepted as a dev-only limitation. The Edge Function uses production APNs only. Full Live Activity dismissal works in production builds.

## Key Takeaways

1. **`AppIntents` framework must be explicitly added** to the widget extension's framework list. Without it, `Button(intent:)` compiles but silently does nothing at runtime.

2. **`widgetURL` takes priority over `Button(intent:)`** — set `widgetURL` to `nil` in areas where interactive controls need to receive taps.

3. **Widget extensions run in a separate process** — they cannot access `Activity<T>.activities` started by the main app. Use APNs push to end Live Activities remotely.

4. **APNs Live Activity push type is `liveactivity`** with topic `<bundleID>.push-type.liveactivity`. The payload must include `timestamp`, `event: "end"`, `dismissal-date`, and `content-state` matching the `ContentState` struct.

5. **Guest mode needs special handling** — always write the pending stop signal to App Group regardless of auth state. Only attempt network operations when credentials exist.

6. **Idempotency is built-in** — stop functions guard with `if (!state.activeTimer) return`, and `releaseTimerLock()` is a no-op if the lock was already deleted by the widget. Concurrent stops from widget + app are safe.
