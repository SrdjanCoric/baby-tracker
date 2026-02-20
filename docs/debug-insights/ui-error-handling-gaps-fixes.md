# UI Error Handling Gaps — Fixes

Source audit: `docs/stability-audit/08-ui-error-handling-gaps.md`

## Issue 1: Unguarded pause/resume handlers in activity screens

**Problem:** `handlePause` and `handleResume` callbacks in feeding, sleep, pumping, and tummy time screens called async context methods without try-catch. If the underlying storage or sync operation threw, the error would propagate as an unhandled promise rejection, potentially crashing the app or leaving the UI in an inconsistent state (e.g., button still showing "pause" when it failed).

**Fix:** Wrapped each `handlePause` and `handleResume` in try-catch with a console.error log.

**Files:** `app/feeding/index.tsx`, `app/sleep/index.tsx`, `app/pumping/index.tsx`, `app/tummyTime/index.tsx`

---

## Issue 2: Remote change handlers missing error boundaries

**Problem:** The `subscribeToRemoteChanges` callbacks in activity contexts (feeding, sleep, diaper, pumping, tummy time) dispatched reducer actions based on incoming Realtime payloads. If the payload was malformed or the transform function threw, the error would bubble up into the Realtime subscription handler, potentially killing the subscription silently. Growth context already had try-catch; the other five did not.

**Fix:** Wrapped each remote change callback body in try-catch with a descriptive console.error.

**Files:** `src/contexts/feeding-context.tsx`, `src/contexts/sleep-context.tsx`, `src/contexts/diaper-context.tsx`, `src/contexts/pumping-context.tsx`, `src/contexts/tummyTime-context.tsx`

---

## Issue 3: GrowthContext missing isMountedRef guard

**Problem:** `loadMeasurements` in GrowthContext dispatched state updates after async database/storage calls without checking if the component was still mounted. During rapid baby switching or navigation, this could cause "setState on unmounted component" warnings or stale data rendering.

**Fix:** Added `isMountedRef` with cleanup in a useEffect, and guarded dispatches in `loadMeasurements` with `if (!isMountedRef.current) return`.

**Files:** `src/contexts/growth-context.tsx`

---

## Issue 4: Notification push token listener leak

**Problem:** `notification-service.ts` called `Notifications.addPushTokenListener()` at module load time as a side effect. This listener was never cleaned up and could fire before the app was ready to handle tokens. If the module was re-evaluated (e.g., in tests or hot reload), multiple listeners would accumulate.

**Fix:** Changed to lazy initialization via `ensureTokenListener()`, called only from `setupNotificationHandler()`. The function checks if a subscription already exists before creating one, preventing duplicates.

**Files:** `src/services/notification-service.ts`

---

## Issue 5: Household subscription churn from inviteCode dependency

**Problem:** The useEffect in HouseholdContext that subscribes to Realtime changes for `users` and `households` tables included `state.household?.inviteCode` in its dependency array. Every time the invite code changed (e.g., from a Realtime update), the effect would tear down and recreate both subscriptions. This caused unnecessary unsubscribe/resubscribe cycles on the Supabase channel.

**Fix:** Stored `inviteCode` in a ref (`inviteCodeRef`) that stays current via a separate sync effect. The comparison inside the `households` change handler reads from `inviteCodeRef.current` instead of the closure variable, removing `state.household?.inviteCode` from the dependency array.

**Files:** `src/contexts/household-context.tsx`

---

## Issue 6: Widget debounce timer edge case (no change needed)

**Problem:** The audit flagged that `buildAndSave` in WidgetContext uses a 300ms debounce timer that could theoretically fire after unmount. However, the existing `useEffect` cleanup already clears the timer via `clearTimeout(debounceRef.current)`. The 300ms window is negligible, and the `ExtensionStorage.set` call is idempotent — a stale write to UserDefaults causes no harm.

**Decision:** No code change. The existing cleanup is adequate.

**Files:** `src/contexts/widget-context.tsx` (reviewed, no changes)

---

## Issue 7: Sync module-level singletons not resettable in tests

**Problem:** `sync-context.tsx` creates `SyncEngine` and `RealTimeSync` instances at module load time. In test environments, these singletons persist across test cases, causing state leakage. There was no way to reset them between tests, leading to flaky test behavior.

**Fix:** Added `__resetForTesting()` export that destroys existing instances, creates fresh ones, and resets the ref count to 0. Test files can call this in `beforeEach` or `afterEach`.

**Files:** `src/contexts/sync-context.tsx`

---

## Issue 8: NotificationContext AppState listener churn

**Problem:** The useEffect that listens for `AppState` changes in NotificationContext had `permissionStatus` in its dependency array. Every time permission status changed, the effect would remove and re-add the AppState listener. This is wasteful and could cause a brief window where app state changes are missed during the teardown/setup cycle.

**Fix:** Stored `permissionStatus` in a ref (`permissionStatusRef`) that stays current via a separate sync effect. The AppState handler reads from the ref instead of the closure, allowing the useEffect to use an empty dependency array (runs once, cleans up on unmount).

**Files:** `src/contexts/notification-context.tsx`

---

## Key Patterns Applied

1. **Try-catch in async callbacks** — Any async operation in a UI callback or subscription handler should be wrapped to prevent unhandled rejections from propagating.

2. **isMountedRef guard** — After any `await` in a component/context, check `isMountedRef.current` before dispatching state updates to avoid acting on unmounted components.

3. **useRef to break dependency cycles** — When a useEffect needs access to a value that changes frequently but shouldn't cause the effect to re-run, store it in a ref and sync it with a separate effect. This is especially important for subscription effects where teardown/setup is expensive.

4. **Lazy initialization over module-level side effects** — Module-level code that sets up listeners or subscriptions should be deferred until explicitly called, preventing leaks in test environments and hot reload scenarios.

5. **Test reset exports** — Module-level singletons should expose a `__resetForTesting()` function so tests can start with clean state.
