# Debug Guide: Watch/Widget/Live Activity Sync (Simulators)

## Setup

### 1. Launch iPhone Simulator
```bash
npx expo prebuild --platform ios --clean && npx expo run:ios
```

### 2. Launch Watch Simulator
- Open Xcode
- Window → Devices and Simulators
- Make sure an Apple Watch is paired with your iPhone Simulator
- Build and run the watch target to the Watch Simulator

### 3. Reading Logs
- **iPhone app + widget extension**: Xcode debug console shows `print()` and `NSLog()` output
- **Watch extension**: Attach to watch process in Xcode, or use Console.app → select Watch Simulator
- **Edge functions**: Supabase Dashboard → Edge Functions → select function → Logs

---

## Test 1: App Open — Token Registration

**Steps:**
1. Launch the app on iPhone Simulator
2. Wait for it to fully load (home screen visible)
3. Start a feeding timer from the app
4. Stop the timer

**Paste for me — all Xcode console lines containing:**
```
[LiveActivityController]
```

---

## Test 2: Watch Starts Timer — Phone Reachable (app open)

**Steps:**
1. Keep the app running on iPhone Simulator
2. On Watch Simulator, start a feeding timer

**Paste for me — all lines containing:**
```
[WatchConnector] startTimer
```

---

## Test 3: Watch Starts Timer — App Closed

**Steps:**
1. Force-quit the app on iPhone Simulator (stop from Xcode or swipe up)
2. On Watch Simulator, start a feeding timer
3. Check the lock screen — does a Live Activity appear?

**Paste for me — all lines containing:**
```
[WatchConnector] startTimer
[WatchConnector] startLiveActivityViaEdgeFunction
[WatchConnector] supabaseStartTimer
```

**Also tell me:** Did a Live Activity appear on the iPhone lock screen? (yes/no)

---

## Test 4: Check Push Token After Push-to-Start (critical test)

After Test 3, with the timer still running and Live Activity visible:

**Steps:**
1. Lock and unlock the iPhone Simulator (Cmd+L to lock, click to unlock)
2. This triggers a widget timeline refresh which runs `captureRunningActivityPushToken()`

**Paste for me — all lines containing:**
```
[WidgetPushToken]
[WidgetTimeline]
```

**Key question:** Does it say `Captured liveActivityPushToken` or `No running activities with push token found`?

---

## Test 5: Pause from Watch — Does Live Activity Update?

**Steps:**
1. Timer still running from Test 3, Live Activity visible
2. On Watch Simulator, pause the timer
3. Watch the Live Activity on lock screen — does it show "Paused" with frozen time, or does it keep counting?

**Paste for me — all lines containing:**
```
[WatchConnector] supabaseTogglePause
```

**Also check Supabase Dashboard → Edge Functions → `toggle-timer-pause` → Logs and paste:**
- The most recent log entries (lines starting with `toggle-timer-pause:`)

**Tell me:** Did the Live Activity show "Paused"? (yes/no)

---

## Test 6: Resume from Watch — Timer Drift

**Steps:**
1. After pausing in Test 5, wait exactly 15 seconds
2. Resume from the Watch Simulator
3. Look at the Live Activity — does it show ~15s (correct) or ~30s+ (drifted)?

**Paste for me — all lines containing:**
```
[WatchConnector] supabaseTogglePause
```

**Also paste the edge function logs from `toggle-timer-pause` for the resume call.**

**Tell me:** What time did the Live Activity show after resume?

---

## Test 7: Pause from Widget

**Steps:**
1. Start a new timer from the Watch (app closed) — wait for Live Activity
2. On the iPhone widget, tap the pause button

**Paste for me — all lines containing:**
```
[TogglePause]
[WidgetPushToken]
```

**Tell me:** Did the Live Activity show "Paused"? (yes/no)

---

## Test 8: Check active_timers Table

**Steps:**
1. Go to Supabase Dashboard → Table Editor → `active_timers`
2. Start a timer, then pause it, then check the table
3. Resume it, then check the table again

**Tell me the `timer_data` JSON contents:**
- After pause: (should have `isPaused: true`, `accumulatedSeconds`, `pausedAt`)
- After resume: (should have `isPaused: false`, `effectiveStartTime`, NO `pausedAt`)

---

## Summary: What I Need From Each Test

| Test | What to paste | Key question |
|------|--------------|-------------|
| 1 | `[LiveActivityController]` lines | Did both tokens register? |
| 2 | `[WatchConnector] startTimer` lines | Phone reachable or not? |
| 3 | `startTimer` + `startLiveActivity` lines | Did Live Activity appear? |
| 4 | `[WidgetPushToken]` lines | Was push token captured? |
| 5 | `supabaseTogglePause` + edge logs | Did LA show "Paused"? |
| 6 | `supabaseTogglePause` + edge logs | Timer ~15s or ~30s+? |
| 7 | `[TogglePause]` + `[WidgetPushToken]` lines | Did LA show "Paused"? |
| 8 | `timer_data` JSON from Supabase | Are fields consistent? |
