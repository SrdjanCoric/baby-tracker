# UI Error Handling Gaps Audit Report

## Summary

This audit examines UI components and context providers for missing error handling, resource leaks, and defensive programming gaps. Eight issues were identified across activity screen handlers, remote change listeners, context lifecycle management, notification service module-level side effects, and Realtime subscription churn. The most impactful issues are the unhandled async errors in pause/resume handlers and remote change listeners, which can cause unhandled promise rejections in production.

---

## Issue 1: Pause/resume handlers missing try-catch

**Severity: MEDIUM**
**Files:**
- `app/feeding/index.tsx`, lines 114-120
- `app/sleep/index.tsx`, lines 114-120
- `app/pumping/index.tsx`, lines 125-131
- `app/tummyTime/index.tsx`, lines 97-103

All four activity screens define `handlePause` and `handleResume` callbacks that await async context functions without any error handling.

**Feeding screen** (`app/feeding/index.tsx`, lines 114-120):
```typescript
const handlePause = useCallback(async () => {
  await pauseBreastfeeding();
}, [pauseBreastfeeding]);

const handleResume = useCallback(async () => {
  await resumeBreastfeeding();
}, [resumeBreastfeeding]);
```

**Sleep screen** (`app/sleep/index.tsx`, lines 114-120):
```typescript
const handlePause = useCallback(async () => {
  await pauseSleep();
}, [pauseSleep]);

const handleResume = useCallback(async () => {
  await resumeSleep();
}, [resumeSleep]);
```

**Pumping screen** (`app/pumping/index.tsx`, lines 125-131):
```typescript
const handlePause = useCallback(async () => {
  await pausePumping();
}, [pausePumping]);

const handleResume = useCallback(async () => {
  await resumePumping();
}, [resumePumping]);
```

**Tummy Time screen** (`app/tummyTime/index.tsx`, lines 97-103):
```typescript
const handlePause = useCallback(async () => {
  await pauseTummyTime();
}, [pauseTummyTime]);

const handleResume = useCallback(async () => {
  await resumeTummyTime();
}, [resumeTummyTime]);
```

**Problem:** These context functions (`pauseBreastfeeding`, `resumeBreastfeeding`, `pauseSleep`, etc.) perform multiple async operations internally: dispatching state updates, persisting to AsyncStorage, updating Live Activities, and calling `updateTimerData` to sync with Supabase. If any of these throw, the error propagates as an unhandled promise rejection from the `onPress` callback.

Note that `handleStop*` in the same files correctly wraps the await in try/finally. The pause/resume handlers are missing this pattern.

**Impact:** An unhandled promise rejection on pause/resume. On React Native, this surfaces as a yellow box warning in development and a potential crash in production (depending on the error handler configuration). The timer UI may also enter an inconsistent state where the visual indicator shows paused but the storage/server state was not updated.

**Suggested fix:** Wrap each handler in try-catch:

```typescript
const handlePause = useCallback(async () => {
  try {
    await pauseBreastfeeding();
  } catch (error) {
    console.error("[FeedingScreen] Failed to pause:", error);
  }
}, [pauseBreastfeeding]);
```

---

## Issue 2: Remote change handlers missing try-catch in activity contexts

**Severity: MEDIUM**
**Files:**
- `src/contexts/feeding-context.tsx`, lines 273-309
- `src/contexts/sleep-context.tsx`, lines 275-294
- `src/contexts/diaper-context.tsx`, lines 109-145
- `src/contexts/pumping-context.tsx` (equivalent section)
- `src/contexts/tummyTime-context.tsx` (equivalent section)
- `src/contexts/growth-context.tsx`, lines 106-125

All six activity contexts subscribe to remote changes via `subscribeToRemoteChanges` and call a `transformFromRemote()` function on the incoming data. None of these callbacks have try-catch.

**Feeding context** (`src/contexts/feeding-context.tsx`, lines 273-309):
```typescript
useEffect(() => {
  const unsubscribe = subscribeToRemoteChanges('feedings', (change: RemoteChange) => {
    if (!selectedBaby) return;

    const data = change.new || change.old;
    if (data && data.baby_id !== selectedBaby.id) return;

    switch (change.eventType) {
      case 'INSERT':
        if (change.new) {
          dispatch({
            type: "REMOTE_INSERT",
            payload: transformFeedingFromRemote(change.new),  // Can throw
          });
        }
        break;
      // ...
    }
  });
  return unsubscribe;
}, [subscribeToRemoteChanges, selectedBaby]);
```

**Growth context** (`src/contexts/growth-context.tsx`, lines 106-125):
```typescript
useEffect(() => {
  const unsubscribe = subscribeToRemoteChanges('growth_measurements', (change: RemoteChange) => {
    if (!selectedBaby) return;
    const data = change.new || change.old;
    if (data && data.baby_id !== selectedBaby.id) return;

    switch (change.eventType) {
      case 'INSERT':
        if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformGrowthFromRemote(change.new) });
        break;
      // ...
    }
  });
  return unsubscribe;
}, [subscribeToRemoteChanges, selectedBaby]);
```

**Problem:** The `transform*FromRemote()` functions perform type casts on the incoming data (e.g., `data.id as string`). If Supabase sends unexpected data (null where a string is expected, or a schema change introduces a new field layout), these transforms can throw. The error propagates through the `RealTimeSync.notifyChangeListeners` forEach loop in `src/services/sync/real-time-sync.ts` (line 186), which iterates over all registered listeners. An unhandled throw in one listener could prevent subsequent listeners from receiving the change.

**Impact:** A single malformed remote change payload could break real-time sync for all activity types in the current session, since the error propagates through the shared listener iteration.

**Suggested fix:** Wrap each callback body in try-catch:

```typescript
const unsubscribe = subscribeToRemoteChanges('feedings', (change: RemoteChange) => {
  try {
    if (!selectedBaby) return;
    const data = change.new || change.old;
    if (data && data.baby_id !== selectedBaby.id) return;
    // ...dispatch logic...
  } catch (error) {
    console.error("[FeedingContext] Failed to process remote change:", error);
  }
});
```

---

## Issue 3: GrowthContext missing isMountedRef guard

**Severity: LOW**
**File:** `src/contexts/growth-context.tsx`, lines 100-155

**Problem:** All other activity contexts (FeedingContext, SleepContext, DiaperContext, PumpingContext, TummyTimeContext) use an `isMountedRef` to guard against state updates after unmount. GrowthContext does not.

Contexts with the guard (`src/contexts/feeding-context.tsx`, lines 263, 270-271, 334):
```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);

// Later, in loadFeedings:
if (!isMountedRef.current) return;
dispatch({ type: "SET_FEEDINGS", payload: feedings });
```

GrowthContext (`src/contexts/growth-context.tsx`, lines 127-151) has no such guard:
```typescript
const loadMeasurements = useCallback(async () => {
  if (!selectedBaby) {
    dispatch({ type: "SET_MEASUREMENTS", payload: [] });
    dispatch({ type: "SET_LOADING", payload: false });
    return;
  }

  dispatch({ type: "SET_LOADING", payload: true });

  let measurements: StoredGrowthEntry[];
  if (user?.householdId) {
    try {
      measurements = await fetchGrowthFromDatabase(selectedBaby.id);
    } catch (error) {
      measurements = await GrowthStorageService.getAllMeasurements(selectedBaby.id);
    }
  } else {
    measurements = await GrowthStorageService.getAllMeasurements(selectedBaby.id);
  }

  // No isMountedRef check here
  dispatch({ type: "SET_MEASUREMENTS", payload: measurements });
  dispatch({ type: "SET_LOADING", payload: false });
}, [selectedBaby, user?.householdId]);
```

**Impact:** If the GrowthProvider unmounts while `fetchGrowthFromDatabase` is in flight (e.g., user switches tabs quickly), the dispatch calls will attempt to update unmounted state. In React, this triggers a "Can't perform a React state update on an unmounted component" warning (React 17) or is silently ignored (React 18+). Low severity because React 18 handles this gracefully, but it is inconsistent with the rest of the codebase.

**Suggested fix:** Add the same `isMountedRef` pattern used in all other contexts:

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);

// In loadMeasurements, before dispatching:
if (!isMountedRef.current) return;
```

---

## Issue 4: Notification push token listener leak at module level

**Severity: LOW**
**File:** `src/services/notification-service.ts`, lines 24-29

```typescript
let capturedDeviceToken: string | null = null;
if (isNotificationsAvailable()) {
  Notifications.addPushTokenListener((token) => {
    capturedDeviceToken = token.data;
  });
}
```

**Problem:** `Notifications.addPushTokenListener()` is called at module import time (top-level side effect). The returned subscription object is never stored, so the listener can never be removed. This listener lives for the entire lifetime of the JavaScript runtime.

**Impact:** Low in practice because:
1. The listener is intentionally designed to capture the device token at any time
2. The module is loaded once and stays loaded for the app lifetime
3. The listener is lightweight (just assigns a string)

However, this pattern is problematic for testing (the listener is registered as a side effect of importing the module) and violates the principle of explicit resource management. If this module were ever hot-reloaded during development, duplicate listeners would accumulate.

**Suggested fix:** Store the subscription and provide a cleanup function, or lazily register the listener on first use:

```typescript
let capturedDeviceToken: string | null = null;
let tokenSubscription: { remove: () => void } | null = null;

function ensureTokenListener(): void {
  if (tokenSubscription || !isNotificationsAvailable()) return;
  tokenSubscription = Notifications.addPushTokenListener((token) => {
    capturedDeviceToken = token.data;
  });
}
```

---

## Issue 5: Household subscription churn from inviteCode dependency

**Severity: LOW**
**File:** `src/contexts/household-context.tsx`, lines 153-220

```typescript
useEffect(() => {
  if (!householdId || !user?.id) return;

  const unsubUsers = subscribeToRemoteChanges('users', (change: RemoteChange) => {
    // ... handles member joins/leaves
  });

  const unsubHouseholds = subscribeToRemoteChanges('households', (change: RemoteChange) => {
    if (change.eventType !== 'UPDATE') return;
    if (!change.new || change.new.id !== householdId) return;

    const newInviteCode = change.new.invite_code as string;
    if (newInviteCode && newInviteCode !== state.household?.inviteCode) {
      dispatch({
        type: "INVITE_CODE_CHANGED",
        payload: newInviteCode,
      });
    }
  });

  return () => {
    unsubUsers();
    unsubHouseholds();
  };
}, [householdId, user?.id, subscribeToRemoteChanges, state.household?.inviteCode, refreshUserProfile]);
```

**Problem:** The useEffect dependency array includes `state.household?.inviteCode`. When the household subscription itself receives a Realtime event with a new invite code, it dispatches `INVITE_CODE_CHANGED`, which updates `state.household.inviteCode`, which triggers the useEffect to re-run, which tears down and re-creates both subscriptions.

This is a single-cycle churn (not infinite), because the new subscription will see the same invite code already stored in state. But the teardown/re-subscribe causes:
1. A brief window where remote changes are not being listened to
2. Unnecessary function object churn

**Impact:** Minor subscription churn on invite code regeneration. The gap between unsubscribe and re-subscribe is brief but could cause a missed Realtime event during that window.

**Suggested fix:** Use a ref to track the current invite code instead of including it in the dependency array:

```typescript
const inviteCodeRef = useRef(state.household?.inviteCode);
useEffect(() => {
  inviteCodeRef.current = state.household?.inviteCode;
}, [state.household?.inviteCode]);

useEffect(() => {
  if (!householdId || !user?.id) return;

  const unsubHouseholds = subscribeToRemoteChanges('households', (change: RemoteChange) => {
    if (change.eventType !== 'UPDATE') return;
    if (!change.new || change.new.id !== householdId) return;

    const newInviteCode = change.new.invite_code as string;
    if (newInviteCode && newInviteCode !== inviteCodeRef.current) {
      dispatch({ type: "INVITE_CODE_CHANGED", payload: newInviteCode });
    }
  });

  // ...
  return () => { /* ... */ };
}, [householdId, user?.id, subscribeToRemoteChanges, refreshUserProfile]);
```

---

## Issue 6 (Additional Finding): Widget context debounce timer creates orphan on rapid remount

**Severity: LOW**
**File:** `src/contexts/widget-context.tsx`, lines 58, 315-330

```typescript
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

// In useEffect:
if (debounceTimerRef.current) {
  clearTimeout(debounceTimerRef.current);
}

debounceTimerRef.current = setTimeout(() => {
  // ... update widget data
}, 300);

return () => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }
};
```

**Problem:** The cleanup is correct for the specific useEffect that creates the debounce timer. However, `debounceTimerRef` is shared across multiple effects (the widget data update effect and potentially the `refreshWidgetData` callback). If `refreshWidgetData` is called and sets a debounce timer, and the component unmounts before the timer fires, the ref-based cleanup only happens in the useEffect cleanup -- not in the `refreshWidgetData` path. This is a minor edge case since the timeout is only 300ms.

**Impact:** Negligible in practice. The 300ms window is very short and the callback only writes to shared storage, which is safe to do after unmount.

---

## Issue 7 (Additional Finding): SyncContext module-level instances survive across test runs

**Severity: LOW**
**File:** `src/contexts/sync-context.tsx`, lines 88-90

```typescript
let syncEngineInstance: SyncEngine | null = new SyncEngine();
let realTimeSyncInstance: RealTimeSync | null = new RealTimeSync();
let instanceRefCount = 0;
```

**Problem:** `SyncEngine` and `RealTimeSync` are instantiated at module load time. In a test environment, these instances persist across test files unless the module cache is explicitly cleared. The `SyncEngine` constructor calls `new SyncQueue()` and the instances carry state from previous tests. The ref-counting cleanup (lines 159-176) only triggers when `instanceRefCount` reaches 0, which may not happen cleanly in test isolation.

**Impact:** Test pollution. Module-level state can leak between tests, causing flaky test results. The `NetInfo.addEventListener` call in `SyncEngine.initialize()` can also accumulate listeners across test runs.

**Suggested fix:** Provide explicit test reset functions or use dependency injection:

```typescript
export function __resetForTesting(): void {
  if (syncEngineInstance) syncEngineInstance.destroy();
  if (realTimeSyncInstance) realTimeSyncInstance.destroy();
  syncEngineInstance = new SyncEngine();
  realTimeSyncInstance = new RealTimeSync();
  instanceRefCount = 0;
}
```

---

## Issue 8 (Additional Finding): NotificationContext captures stale permissionStatus in AppState listener

**Severity: LOW**
**File:** `src/contexts/notification-context.tsx`, lines 122-147

```typescript
useEffect(() => {
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === "active") {
      const status = await NotificationService.getPermissionStatus();
      if (status !== permissionStatus) {   // <-- closure captures permissionStatus
        setPermissionStatus(status);
        // ...
      }
    }
  };

  const subscription = AppState.addEventListener("change", handleAppStateChange);
  return () => subscription.remove();
}, [permissionStatus]);  // <-- re-subscribes on every permission change
```

**Problem:** The dependency on `permissionStatus` causes the AppState listener to be torn down and re-created every time permission status changes. This is functionally correct but creates unnecessary listener churn. More importantly, there is a brief window during re-subscription where an AppState change event could be missed.

**Impact:** Negligible. Permission changes are rare (typically once per app lifecycle) and AppState changes during the re-subscription window are extremely unlikely.

---

## Priority Summary

| # | Issue | Severity | Type |
|---|---|---|---|
| 1 | Pause/resume handlers missing try-catch in 4 activity screens | **Medium** | Error Handling |
| 2 | Remote change handlers missing try-catch in 6 activity contexts | **Medium** | Error Handling |
| 3 | GrowthContext missing isMountedRef guard | **Low** | Consistency |
| 4 | Notification push token listener leak at module level | **Low** | Resource Leak |
| 5 | Household subscription churn from inviteCode dependency | **Low** | Performance |
| 6 | Widget context debounce timer edge case on rapid remount | **Low** | Resource Leak |
| 7 | SyncContext module-level instances persist across test runs | **Low** | Test Isolation |
| 8 | NotificationContext AppState listener churn on permission change | **Low** | Performance |
