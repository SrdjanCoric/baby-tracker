# Watch/Widget Pause-Resume and Modal Black Screen

## Overview

This covers three interrelated issues solved in a single branch: (1) enabling pause/resume/stop from widget and Apple Watch, (2) live activity restoration after app relaunch, and (3) a feeding modal that showed a black/empty content area.

---

## Issue 1: Feeding Modal Black Screen

### Symptom

When a breastfeeding timer was running and the user returned to the feeding screen (via live activity, widget tap, or app switcher), the modal sometimes showed the "Feeding" header but the content area was completely black with no timer UI.

### Root Cause

The feeding screen initializes `activeTab` from the last *completed* feeding type:

```tsx
const [activeTab, setActiveTab] = useState<FeedingTab>(() => {
  const lastType = getLastFeedingType(feedings);
  return lastType ? feedingTypeToTab(lastType) : "breast";
});
```

When the breastfeeding timer is running but the last completed feeding was a bottle or solid:
1. `activeTab` initializes to `"bottle"` or `"solids"`
2. The tab bar is hidden when timer runs (`!isTimerRunning && (...)`)
3. `BreastfeedingTimerView` only renders when `activeTab === "breast"`
4. Bottle/solids forms only render when `!isTimerRunning`
5. **Result**: No content renders — only the dark surface background is visible

This happens when the screen re-mounts (deep link, modal re-presentation) with a running breastfeeding timer AND the last completed feeding wasn't breast.

### Fix

Added a `useEffect` that forces `activeTab` to `"breast"` when a breastfeeding timer is running:

```tsx
useEffect(() => {
  if (activeTimer?.isRunning && activeTab !== "breast") {
    setActiveTab("breast");
  }
}, [activeTimer?.isRunning, activeTab]);
```

### Defense in Depth: Layout contentStyle

Added `contentStyle` with theme-aware background colors to all activity layout stacks (`feeding`, `sleep`, `pumping`, `tummyTime`, `diaper`). Previously the nested stacks had no `contentStyle`, meaning the native iOS black background could flash during modal transitions before screen content rendered.

Also removed redundant `presentation: "modal"` and `animation: "slide_from_bottom"` from nested stacks — the parent root Stack already handles modal presentation.

---

## Issue 2: Widget Pause/Resume/Stop Deep Links

### Problem

The widget had an interactive stop button (via `AppIntent`), but no way to pause or resume timers. The app needed to accept `?action=pause|resume|stop` deep link parameters to allow widget and watch to control timers.

### Solution

#### Deep Link Action Handlers

Each activity screen (`feeding`, `sleep`, `pumping`, `tummyTime`) now reads an `action` search param and processes it:

```tsx
const { action } = useLocalSearchParams<{ action?: string }>();

useEffect(() => {
  if (!action || !activeTimer?.isRunning) return;
  if (action === "pause" && !activeTimer.isPaused) {
    pauseBreastfeeding();
  } else if (action === "resume" && activeTimer.isPaused) {
    resumeBreastfeeding();
  } else if (action === "stop") {
    stopBreastfeeding();
  }
  router.setParams({ action: undefined });
}, [action, activeTimer?.isRunning, activeTimer?.isPaused, ...]);
```

The `router.setParams({ action: undefined })` clears the param after processing to prevent re-triggering on re-renders.

#### Widget TogglePauseActivityIntent

The widget's `TogglePauseActivityIntent` already existed but needed improvements:
- Writes `pendingWidgetPauseToggle` to App Group with `pausedAt`, `resumedAt`, and `pauseDurationMs`
- Calls `toggle-timer-pause` edge function to update active_timers and send APNs live activity update
- `useWidgetPauseHandler` and `useWidgetStopHandler` hooks navigate to the activity screen after processing, so the user sees the timer UI

#### Timestamp Preservation

Pause/resume contexts now accept optional timestamps (`requestedPauseTime`, `requestedResumeTime`) and widget pause duration (`widgetPauseDurationMs`). When the widget pauses at T1 and the app processes at T2, the context uses T1 (not T2) to calculate elapsed time correctly. Without this, the timer would drift by the delay between widget action and app foreground.

---

## Issue 3: Live Activity Restoration

### Problem

After a phone restart or app termination, the live activity ID stored in context would reference a dead activity. The timer was running (persisted in AsyncStorage / active_timers table) but no live activity was visible on the lock screen.

### Solution

On context initialization, each timer context now checks if the stored live activity is still running:

```tsx
if (activeTimer.liveActivityId) {
  const isRunning = await isLiveActivityRunningWithTimeout(activeTimer.liveActivityId);
  if (isRunning) {
    liveActivityIdRef.current = activeTimer.liveActivityId;
  } else if (!activeTimer.isPaused) {
    // Restart live activity with effective start time accounting for paused time
    const effectiveStartTime = totalPausedMs > 0
      ? new Date(startedAt + totalPausedMs)
      : new Date(startedAt);
    const activityId = await startTimerLiveActivity(..., effectiveStartTime);
    if (activityId) liveActivityIdRef.current = activityId;
  }
}
```

The `effectiveStartTime` calculation ensures the restarted live activity shows the correct elapsed time (excluding paused duration).

---

## Issue 4: Watch Standalone Network Access

### Problem

When the phone is unreachable (app killed, phone in another room), the watch could send `WCSession` messages but they'd never be delivered. Timers started from the watch would show locally but the phone/widget/live activity wouldn't know about them.

### Solution

#### Auth Credentials on Watch

The widget context now sends Supabase auth credentials (URL, anon key, access token, user ID) plus live activity push tokens via `WCSession.updateApplicationContext()`. The watch persists these to UserDefaults.

#### Direct Supabase Calls

When `session.isReachable == false`, the watch falls back to direct Supabase REST calls:
- `supabaseStartTimer()` — calls `acquire_timer_lock` RPC
- `supabaseStopTimer()` — DELETEs active_timer row + ends live activity via edge function
- `supabaseTogglePause()` — calls `toggle-timer-pause` edge function

#### Network Polling

The watch polls Supabase every 30 seconds when timers are active to reconcile state:
- Detects timers stopped externally (widget, other device)
- Detects timers started by partner
- Clears local optimistic state and uses server as source of truth
- Stops polling when no timers remain

#### Push-to-Start Live Activities

The watch can now start a live activity on the phone's lock screen via push-to-start:
1. `LiveActivityController.registerPushToStart()` observes `pushToStartTokenUpdates` and stores token in App Group
2. Token is sent to watch via application context
3. When watch starts a timer, it calls `start-live-activity` edge function with the push-to-start token
4. Edge function sends APNs push that creates the live activity on the phone

---

## Key Takeaways

1. **Tab state vs timer state mismatch**: When a screen's initial state depends on historical data (last completed feeding type) but runtime behavior depends on current state (running timer), a reconciliation `useEffect` is needed. The `useState` initializer only runs on mount — if the derived initial value conflicts with the expected runtime state, add an effect to correct it.

2. **Timestamp authority**: When actions originate from widget/watch, the widget is the source of truth for *when* the action happened. Passing timestamps through (`requestedPauseTime`, `widgetPauseDurationMs`) prevents timer drift from the delay between the action and the app processing it.

3. **Live activities are ephemeral**: They don't survive phone restarts. Any system that depends on live activities must be prepared to restart them. The `isLiveActivityRunningWithTimeout` check with fallback to `startTimerLiveActivity` handles this.

4. **Watch connectivity is unreliable**: `WCSession.isReachable` only works when the phone app is in foreground. For background operation, the watch needs independent network access. The fallback pattern is: try WCSession first → fall back to direct Supabase REST → poll periodically to reconcile.

5. **Widget extensions capture push tokens before actions**: Since widget extensions run in a separate process and can't access `Activity<T>.activities` from the main app reliably, `captureRunningActivityPushToken()` is called at the top of both `StopActivityIntent.perform()` and `TogglePauseActivityIntent.perform()` to grab the token while it's available.

6. **`contentStyle` on nested Stacks**: Without it, iOS shows its native black background during modal transitions. Setting it to the app's theme background prevents the flash, especially noticeable in dark mode where the content area is dark brown (`#1E1B19`) but the native background is true black (`#000000`).
