# Fix: App Stuck on Splash Screen After Phone Restart

## Problem

When a timer was running and the user restarted their phone, the app would get stuck on the splash screen (showing the Sofi logo) and never load. React Native wouldn't initialize at all - no JavaScript logs would appear in Metro.

## Root Cause

The `clearTimersIfRebooted()` function in `AppDelegate.swift` was attempting to access ActivityKit's Live Activity APIs during app startup:

```swift
// PROBLEMATIC CODE - caused app to hang
if #available(iOS 16.2, *) {
  let activities = Activity<TimerActivityAttributes>.activities  // <- This line blocked startup
  if !activities.isEmpty {
    let semaphore = DispatchSemaphore(value: 0)
    Task {
      for activity in activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      semaphore.signal()
    }
    _ = semaphore.wait(timeout: .now() + 3.0)  // <- Semaphore wait on main thread
  }
}
```

Two issues:
1. Accessing `Activity<TimerActivityAttributes>.activities` during `didFinishLaunchingWithOptions` appears to block or crash before React Native can initialize
2. Using a semaphore to wait on the main thread during app startup is dangerous and can cause deadlocks

## Solution

Removed the Live Activity clearing code from the native layer entirely. The `clearTimersIfRebooted()` function now only:
1. Detects if a reboot occurred (by comparing system uptime with timer start time)
2. Clears the timer data from UserDefaults/widget data

```swift
func clearTimersIfRebooted() {
  let uptimeSeconds = ProcessInfo.processInfo.systemUptime

  guard let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app"),
        let dataString = userDefaults.string(forKey: "widgetData"),
        let data = dataString.data(using: .utf8),
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
    return
  }

  // Find timer start time from activeTimer or activeTimers array
  var foundTimerStartTime: Date? = nil
  // ... parsing logic ...

  guard let startTime = foundTimerStartTime else { return }

  let secondsSinceTimerStart = Date().timeIntervalSince(startTime)
  let didReboot = uptimeSeconds < secondsSinceTimerStart

  if didReboot {
    // Only clear widget data - don't touch Live Activities
    var updatedJson = json
    updatedJson["activeTimer"] = NSNull()
    updatedJson["activeTimers"] = [Any]()
    // ... save to UserDefaults ...
  }
}
```

## What About Live Activities?

Live Activities don't survive phone restarts - iOS automatically clears them. So there's no need to manually end them in the native code. The JavaScript layer handles any stale timer state when the app loads.

## Key Learnings

1. **Don't access ActivityKit APIs during app startup** - `Activity<T>.activities` can block the main thread during `didFinishLaunchingWithOptions`
2. **Never use semaphores on the main thread during startup** - This can cause deadlocks that prevent React Native from initializing
3. **Keep native startup code minimal** - Complex operations should be deferred to after React Native initializes
4. **Live Activities don't survive reboots** - iOS clears them automatically, so manual cleanup isn't needed

## Files Modified

- `ios/SofiBabyTracker/AppDelegate.swift` - Removed ActivityKit Live Activity clearing code, kept only UserDefaults cleanup
