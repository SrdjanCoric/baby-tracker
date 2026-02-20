# React Context Race Conditions & Memory Leak Fixes

**Date:** 2026-02-20
**Severity:** HIGH / MEDIUM-HIGH / MEDIUM
**Files changed:** 10 context files + `app/_layout.tsx`

## Problems

### 1. Stale closure in timer callbacks (HIGH)

Timer action callbacks (`stopBreastfeeding`, `pauseSleep`, `resumePumping`, etc.) captured `state.activeTimer` via closure at creation time. When these callbacks were invoked from stale contexts — widget deep-link handlers, `AppState` listeners, or queued async operations — the captured timer data was outdated.

**Symptom:** Stopping a timer from the widget or after returning from background could compute wrong durations, use stale `side`/`pausedAt` values, or silently no-op because the closure still saw `activeTimer: null`.

**Root cause:** `useCallback` closes over `state.activeTimer` at the time the callback is created. If the callback is stored in a ref elsewhere (widget handler, AppState listener) and called later, it reads the old snapshot, not the current state.

### 2. Widget context dependency cascade (MEDIUM-HIGH)

`buildWidgetData` had 18+ dependencies including callback functions like `getLastFeeding`, `getTodaysCounts`, `getLastDiaper`, `getCurrentNapSlot`, and `getCompletedNapsSinceNightSleep`. These callbacks changed identity whenever their own data dependencies changed (e.g., `state.feedings` changing recreates `getLastFeeding`). This caused cascading recreations: data change -> callback recreated -> `buildWidgetData` recreated -> widget update triggered, even when the actual widget-relevant data hadn't changed. The debounce timer helped but didn't eliminate unnecessary work.

### 3. Auth double data fetch on login (MEDIUM)

On login, `onAuthStateChange` fires and immediately sets `user.householdId = null` (profile not yet fetched). Downstream contexts (`HouseholdProvider`, `BabyProvider`, `SyncAuthSetup`) react to this intermediate state:

- `HouseholdProvider` dispatches `RESET` (householdId is null)
- `BabyProvider` loads babies from local storage (no householdId means guest mode)
- `SyncAuthSetup` subscribes Realtime to `user.id` as the channel (wrong — should be `householdId`)

Then the background `fetchUserProfile` completes, sets the real `householdId`, and everything loads again correctly — but the first load was wasted work and the Realtime subscription was briefly on the wrong channel.

### 4. State updates after unmount (MEDIUM)

All activity contexts dispatch state updates after async `loadXxx()` calls without checking if the component is still mounted. If a user navigates away (or the provider unmounts during a baby switch) before the async load completes, React would receive a dispatch to an unmounted reducer — a wasted update and potential warning.

## Solutions

### 1. activeTimerRef pattern

Added a ref that stays synced to the latest `state.activeTimer`:

```typescript
const activeTimerRef = useRef(state.activeTimer);
useEffect(() => {
  activeTimerRef.current = state.activeTimer;
}, [state.activeTimer]);
```

All timer callbacks now read `activeTimerRef.current` instead of the closure value. This means the callback identity is stable (no `state.activeTimer` in deps) while always reading fresh data.

**Applied to:** `feeding-context.tsx`, `sleep-context.tsx`, `pumping-context.tsx`, `tummyTime-context.tsx`

### 2. Callback refs for widget context

Stored callback functions in refs so their identity changes don't trigger `buildWidgetData` recreation:

```typescript
const getLastFeedingRef = useRef(getLastFeeding);
useEffect(() => { getLastFeedingRef.current = getLastFeeding; }, [getLastFeeding]);
```

Inside `buildWidgetData`, calls go through refs (`getLastFeedingRef.current()`). The callbacks are removed from the `buildWidgetData` dependency array. The data arrays (`feedings`, `sleeps`, etc.) still trigger the widget update useEffect, which is the correct behavior — widget updates should be driven by data changes, not callback identity changes.

### 3. profileLoaded flag

Added a `profileLoaded` boolean to `AuthProvider`:

- Set to `false` when `onAuthStateChange` fires with a new session
- Set to `true` after `fetchUserProfile` completes (success or failure)
- Set to `true` on initial load completion and sign-out

Downstream consumers gate their loading on this flag:

- `HouseholdProvider`: skips load effect until `profileLoaded` is true
- `BabyProvider`: skips load effect until `profileLoaded` is true
- `SyncAuthSetup`: skips `setAuthContext` until `profileLoaded` is true

This eliminates the intermediate "null householdId" state from triggering any loads or subscriptions.

### 4. isMountedRef guards

Added to all 8 context providers (auth, baby, household, feeding, sleep, pumping, tummyTime, diaper):

```typescript
const isMountedRef = useRef(true);
useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);
```

Each `loadXxx` function checks `if (!isMountedRef.current) return;` after its main async operation before dispatching state updates.

## Key Takeaway

React `useCallback` closures capture state at creation time. For callbacks that may be invoked asynchronously or from external contexts (widget handlers, AppState listeners, timers), use a ref synced to the latest state. This is the same pattern already used for `liveActivityIdRef` — it should be the default for any value read inside an async callback.

For auth flows with a "set user immediately, fetch profile in background" pattern, downstream consumers must be aware that the user object has two phases. A `profileLoaded` flag makes this explicit and prevents intermediate states from triggering expensive operations.
