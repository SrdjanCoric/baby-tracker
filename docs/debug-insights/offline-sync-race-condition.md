# Offline Sync Race Condition: Activities Disappear After Reconnect

## Symptom

When logging an activity (e.g., diaper change) while offline and then coming back online, the newly logged activity would temporarily disappear from the UI. The previous activity (logged while online) would show as the most recent. The partner saw the new activity faster than the person who logged it.

## Root Cause

A race condition between the foreground refresh and the sync queue push.

### The flow that caused the bug:

1. **User logs activity offline** — `createDiaperInDatabase` saves to AsyncStorage, dispatches `ADD_DIAPER` to context (visible in UI), and queues a sync operation.

2. **User comes back online** (opens app / network returns):
   - `AppState` fires → `foregroundRefreshKey` increments **immediately**
   - `NetInfo` fires → `handleNetworkChange(true)` → sync queue push starts after a **2-second debounce**

3. **Context re-renders** in response to `foregroundRefreshKey` change, calls `fetchDiapersFromDatabase()` which queries Supabase.

4. **Supabase returns data without the offline activity** — the sync queue hasn't pushed it yet (still waiting on the 2-second debounce).

5. **`SET_DIAPERS` overwrites context state** with server data → the offline activity disappears from the UI.

6. **2+ seconds later**, the sync queue pushes the activity to Supabase. The partner's Realtime subscription picks it up (they see it fast). The user's own Realtime subscription eventually gets the INSERT event → `REMOTE_INSERT` re-adds the activity.

### Why the partner saw it faster

The partner had an active Realtime subscription. The moment the sync queue pushed the activity (step 6), their subscription delivered it. The user who logged it had already lost it from local state at step 5 and had to wait for the Realtime round-trip.

## Fix

Two changes in `sync-context.tsx`:

### 1. Foreground handler: push before refresh

```typescript
const handleAppStateChange = async (nextState: AppStateStatus) => {
  if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
    if (syncEngineInstance && syncEngineInstance.getPendingCount() > 0) {
      try {
        await syncEngineInstance.sync();
      } catch {
        // Sync failed — still refresh to show best available data
      }
    }
    setForegroundRefreshKey(k => k + 1);
  }
  appStateRef.current = nextState;
};
```

When the app returns to foreground, if there are pending operations in the sync queue, flush them first (`await sync()`), then bump `foregroundRefreshKey`. The server fetch now includes the offline entries.

### 2. Network reconnect: refresh after sync completes

```typescript
if (!engineState.isConnected) {
  wasOfflineRef.current = true;
}

if (wasOfflineRef.current && engineState.isConnected && engineState.status === 'online') {
  wasOfflineRef.current = false;
  setForegroundRefreshKey(k => k + 1);
}
```

Tracks offline→online transitions via `wasOfflineRef`. When the sync engine finishes its reconnection sync (status transitions to `'online'`), triggers a context refresh. This covers the case where the app stays in foreground during a connectivity drop.

## Bonus: partner's changes also load correctly

The same fix also ensures the user sees their partner's activities after reconnecting. Previously, Supabase Realtime would NOT replay events missed while offline. The server fetch after sync now picks up everything — both the user's pushed offline entries and the partner's entries that accumulated during the offline window.

## Key Takeaway

When a sync system has both push (queue→server) and pull (server→context), the push must complete before the pull runs. Otherwise the pull overwrites local optimistic state with stale server data. Always flush the outbound queue before refreshing from the server.
