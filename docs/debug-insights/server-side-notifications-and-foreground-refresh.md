# Server-Side Notifications & Foreground Data Refresh

## Overview

This PR fixed four distinct problems in the multi-caregiver notification and data sync pipeline:

1. Timer alert notifications never fired unless the user was on the timer screen
2. Activity notifications from other caregivers failed (Expo Push API unreliable)
3. Feeding reminders needed server-side scheduling (local-only didn't work cross-device)
4. Data logged by another caregiver didn't appear until force-closing the app

---

## Problem 1: Timer Alerts Only Worked On-Screen

### Symptom

Timer alert notifications (e.g., "Breastfeeding has exceeded 60 minutes") never fired unless the user was actively viewing the specific timer screen (feeding, sleep, pumping, or tummy time).

### Root Cause

`useTimerAlertIntegration` was a per-screen hook. It ran a polling interval that checked elapsed time against the threshold, but it only ran while that screen's component was mounted. If the user navigated away from the feeding screen while the timer was running, the hook unmounted and alerts stopped.

Additionally, `shouldSendTimerAlert` used strict greater-than (`>`) instead of greater-than-or-equal (`>=`), so alerts at exactly the threshold minute were missed.

A third issue: `scheduleNotificationAsync` with `trigger.date = new Date()` (current time) was silently dropped by iOS because the trigger date was already in the past by the time the OS processed it.

### Fix

1. Created `useGlobalTimerAlerts` hook mounted at the root layout level (`GlobalTimerAlertWatcher` component). It subscribes to all four timer contexts and polls every 10 seconds. Uses a `Set` to track which alert types have already fired, reset when the corresponding timer stops.

2. Changed `shouldSendTimerAlert` from `durationMinutes > threshold` to `durationMinutes >= threshold`.

3. Changed the trigger time from `new Date()` to `new Date(Date.now() + 1000)` (1 second in the future) so iOS doesn't discard it.

4. Added an explicit `if (!timerAlertsEnabled) return false` guard in `useTimerAlertIntegration` (the per-screen hook still exists for immediate on-screen checks).

### Lesson

Hooks that need to run globally (regardless of which screen is active) must be mounted at the root layout, not inside individual screens. A timer alert is meaningless if it only works while the user stares at the timer.

---

## Problem 2: Activity Notifications via Expo Push API Were Unreliable

### Symptom

When Caregiver A logged a feeding, Caregiver B was supposed to get a push notification ("Alice logged a feeding"). These notifications were intermittently failing or not arriving at all.

### Root Cause

The `send-activity-notification` edge function was using the Expo Push API (`exp.host/--/api/v2/push/send`) with Expo push tokens (`ExponentPushToken[xxx]`). This had two problems:

1. **Expo Push API reliability**: The intermediary service was occasionally dropping or delaying notifications, with no clear error feedback.
2. **Token model mismatch**: The `user_push_tokens` table stored Expo tokens, but the app had already switched to direct APNs for widget pushes and feeding reminders. Having two different push delivery paths created inconsistency.

### Fix

Rewrote `send-activity-notification` to use direct APNs, matching the pattern already used by `send-widget-push` and `check-feeding-reminders`:

- Added `createApnsJwt()` function for ES256 JWT signing (same pattern as other edge functions)
- Added `sendApnsAlert()` function that calls `https://api.push.apple.com/3/device/{token}` directly
- Query changed: first find users in the household with `activity_notifications_enabled = true`, then fetch their `device_token` from `user_push_tokens`
- Invalid tokens (APNs 410/400) get their `device_token` set to `null` instead of deleting the entire row (the row still holds the Expo push token)

This required storing the native APNs device token alongside the Expo push token, which led to the `device_token` column addition (migration 031).

### Lesson

If you're already using direct APNs for some push paths, use it for all of them. Mixing Expo Push API and direct APNs creates two failure modes to debug. Direct APNs gives clear HTTP status codes (200, 400, 410) instead of opaque intermediary failures.

---

## Problem 3: Device Token Registration Race Condition

### Symptom

The `device_token` column in `user_push_tokens` was always `NULL` even after the user granted notification permissions and the Expo push token was saved successfully.

### Root Cause

The initial implementation used `addPushTokenListener` to capture the native APNs device token into a module-level variable, then read it synchronously:

```typescript
let capturedDeviceToken: string | null = null;
Notifications.addPushTokenListener((token) => {
  capturedDeviceToken = token.data;
});

// Later, synchronously:
const deviceToken = NotificationService.getDevicePushToken(); // returns capturedDeviceToken
```

Two race conditions:

1. **Async listener vs sync read**: `addPushTokenListener` fires asynchronously on the JS thread. After `getExpoPushTokenAsync()` resolves and triggers APNs registration, the listener callback hasn't fired yet by the time we synchronously read `capturedDeviceToken`.

2. **Already-registered case**: If the app was already registered for push notifications (returning user), the listener may never fire because it only triggers on token *updates*, not for existing tokens.

### Fix

Changed `getDevicePushToken()` from synchronous to async with a fallback:

```typescript
async getDevicePushToken(): Promise<string | null> {
  if (capturedDeviceToken) return capturedDeviceToken;  // fast path
  if (!Notifications) return null;

  const result = await Promise.race([
    Notifications.getDevicePushTokenAsync(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
  // ...
}
```

The 5-second timeout is safe because by the time this function is called, `getExpoPushTokenAsync()` has already completed APNs registration. The SDK 53 hanging issue with `getDevicePushTokenAsync()` only affects cold calls before registration.

### Lesson

Never assume an event listener has fired by the time you read its captured value synchronously. Always provide a fallback path (direct API call) for the case where the listener hasn't fired or won't fire.

---

## Problem 4: Stale Data After Backgrounding

### Symptom

Caregiver A logs a feeding. Caregiver B has the app in the background, opens it, and the new feeding doesn't appear in the timeline or dashboard. Force-closing and reopening the app fixes it.

### Root Cause

The app relies on Supabase Realtime subscriptions for live updates between caregivers. When the app is backgrounded, the WebSocket connection goes stale. When the app returns to foreground, the Realtime connection may reconnect, but any changes that occurred while backgrounded are missed because Realtime only delivers live events, not historical catch-up.

Each activity context (feeding, diaper, sleep, etc.) loads data once when the selected baby or user changes, but there was no trigger to reload when the app returns from background.

### Fix

Added a `foregroundRefreshKey` counter to `SyncContext`:

```typescript
const [foregroundRefreshKey, setForegroundRefreshKey] = useState(0);

useEffect(() => {
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
      setForegroundRefreshKey(k => k + 1);
    }
    appStateRef.current = nextState;
  };
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}, []);
```

All six activity contexts add `foregroundRefreshKey` to their load effect dependencies:

```typescript
useEffect(() => {
  loadFeedings();
}, [loadFeedings, foregroundRefreshKey]);
```

When the app returns to foreground, the key increments, triggering all contexts to refetch from Supabase. The queries are lightweight parallel SELECTs filtered by `baby_id`.

### Lesson

Realtime subscriptions are for live updates, not data consistency guarantees. Any app that backgrounds needs a foreground refresh mechanism. The counter-in-dependency-array pattern is a clean React way to force re-execution of effects without adding complex imperative logic.

---

## Problem 5: Server-Side Feeding Reminders

### Context (not a bug fix, but a new feature driven by the problems above)

Local notification scheduling for feeding reminders only worked on the device that scheduled them. In a multi-caregiver household, if Caregiver A set a 3-hour feeding reminder and Caregiver B logged a feeding, Caregiver A's reminder timer wouldn't reset because the local scheduler didn't know about the remote feeding.

### Solution

Moved feeding reminder scheduling to the server:

1. **Migration 029**: Created `feeding_reminder_preferences` table and `get_due_feeding_reminders()` SQL function. Added a pg_cron job running every 5 minutes that calls the `check-feeding-reminders` edge function.

2. **Migration 030**: Updated the edge function to use direct APNs (same pattern as activity notifications).

3. **`useNotificationIntegration`**: Now syncs feeding reminder preferences to the server whenever settings change or the selected baby changes. For authenticated users, local scheduling is skipped entirely (the server handles it).

4. **Notification settings UI**: Added a "sign in required" hint for feeding reminders when the user is not authenticated, since server-side scheduling requires auth.

### Key Design Decision

Authenticated users rely entirely on server-side feeding reminders. Unauthenticated users still get local-only reminders. The `scheduleReminderAfterFeeding` callback short-circuits with `if (isUserAuthenticated()) return` for authenticated users.
