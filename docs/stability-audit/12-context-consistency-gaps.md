# Context Provider Consistency Gaps Audit Report

## Summary

Cross-referencing all activity context providers reveals inconsistencies in error state exposure, dependency arrays, and migration logic. While feeding-context is the most robust (has `loadError`, `isMountedRef`, nested try-catch), several other contexts are missing these patterns. The widget context has a missing dependency that causes stale data.

---

## Issue 1: Growth and Diaper contexts missing loadError state

**Severity: MEDIUM**
**Files:**
- `src/contexts/growth-context.tsx`, lines 19-22 (GrowthState interface)
- `src/contexts/diaper-context.tsx`, lines 21-24 (DiaperState interface)

Feeding context has `loadError: string | null` in its state (line 41) and dispatches `SET_LOAD_ERROR` on fetch failure (line 435). This allows the UI to show an error message when data fails to load.

Growth and Diaper contexts lack this:

```typescript
// growth-context.tsx — GrowthState (line 19-22)
export interface GrowthState {
  measurements: StoredGrowthEntry[];
  isLoading: boolean;
  // No loadError field
}

// diaper-context.tsx — DiaperState (line 21-24)
export interface DiaperState {
  diapers: StoredDiaperEntry[];
  isLoading: boolean;
  // No loadError field
}
```

**Impact:** When growth or diaper data fails to load (both database AND local storage fail), the user sees an empty list with `isLoading: false` and no error indication. They assume they have no data when the load actually failed.

**Fix:** Add `loadError: string | null` to both state interfaces, add `SET_LOAD_ERROR` action to both reducers, and dispatch on load failure. Pattern to follow: `feeding-context.tsx` lines 41, 50, 73-76, 435.

Check if sleep, pumping, and tummy-time contexts also need this — they should all have consistent error state exposure.

---

## Issue 2: Widget context buildWidgetData missing wakeWindowConfig dependency

**Severity: MEDIUM**
**File:** `src/contexts/widget-context.tsx`, lines 49 and 260-275

```typescript
// Line 49: wakeWindowConfig is destructured from useSleep()
const { ..., wakeWindowConfig, getCurrentNapSlot, ... } = useSleep();

// Lines 260-275: buildWidgetData useCallback deps
const buildWidgetData = useCallback((): WidgetData | null => {
  // ... uses getCurrentNapSlotRef which depends on wakeWindowConfig
}, [
  selectedBaby,
  feedings,
  feedingTimer,
  sleeps,
  sleepTimer,
  sleepGoal,
  diapers,
  pumpings,
  pumpingTimer,
  measurements,
  tummyTimes,
  tummyTimeTimer,
  tummyTimeGoalSeconds,
  locks,
  // MISSING: wakeWindowConfig
]);
```

`buildWidgetData` reads `getCurrentNapSlotRef.current()` which internally depends on `wakeWindowConfig`. When wake window settings change, the ref updates via a separate useEffect, but the `buildWidgetData` callback is NOT recreated because `wakeWindowConfig` is not in its dependency array.

**Impact:** Widget shows stale nap slot/wake window data after the user changes wake window settings. Requires app restart for the widget to reflect the new settings.

**Fix:** Add `wakeWindowConfig` to the dependency array:

```typescript
}, [
  selectedBaby,
  feedings,
  feedingTimer,
  sleeps,
  sleepTimer,
  sleepGoal,
  wakeWindowConfig,  // Add this
  diapers,
  pumpings,
  pumpingTimer,
  measurements,
  tummyTimes,
  tummyTimeTimer,
  tummyTimeGoalSeconds,
  locks,
]);
```

---

## Issue 3: Active timers remote change handler missing try-catch

**Severity: MEDIUM**
**File:** `src/contexts/active-timers-context.tsx`, lines 201-231

```typescript
if (change.eventType === "INSERT" && change.new) {
  const lockData = transformActiveTimerFromRemote(change.new);
  const { data: userData } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", lockData.startedBy)
    .single();  // Throws on 0 or >1 results

  dispatch({
    type: "ADD_LOCK",
    lock: {
      ...lockData,
      startedByName: userData?.display_name || "Someone",
    },
  });
}
```

Two Supabase queries (INSERT handler at line 203 and UPDATE handler at line 218) are not wrapped in try-catch. `.single()` throws when the query returns 0 or more than 1 row. If the user who started the timer was deleted from the users table, this throws an unhandled error.

**Impact:** The error propagates through `RealTimeSync.notifyChangeListeners()` forEach loop (`real-time-sync.ts`, line 186). An error in one listener can prevent subsequent listeners from receiving the change, potentially breaking sync for all activity types.

**Fix:** Wrap each Supabase query in try-catch:

```typescript
if (change.eventType === "INSERT" && change.new) {
  const lockData = transformActiveTimerFromRemote(change.new);
  let displayName = "Someone";
  try {
    const { data: userData } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", lockData.startedBy)
      .single();
    if (userData?.display_name) {
      displayName = userData.display_name;
    }
  } catch (error) {
    console.warn("[ActiveTimersContext] Failed to fetch user display_name:", error);
  }

  dispatch({
    type: "ADD_LOCK",
    lock: { ...lockData, startedByName: displayName },
  });
}
```

Apply the same pattern to the UPDATE handler at line 218.

---

## Issue 4: Baby context hasMigratedRef not keyed to household

**Severity: LOW**
**File:** `src/contexts/baby-context.tsx`, lines 142, 212-213, 244

```typescript
const hasMigratedRef = useRef(false);  // Line 142: boolean only

// Line 212-213: Set on first household load
if (!hasMigratedRef.current) {
  hasMigratedRef.current = true;
  // ... migration code
}

// Line 244: Reset when no household
} else {
  hasMigratedRef.current = false;
}
```

The ref is a boolean that tracks whether *any* migration has run, not *which household* was migrated. If a user leaves household A, then immediately rejoins household A, the ref resets to `false` (line 244) when `householdId` becomes null, then the migration runs again when `householdId` is set back.

**Impact:** Duplicate migration attempts on rejoin. The migration code (`syncLocalBabiesToDatabase`) is idempotent (uses upsert), so this causes extra network calls but no data corruption.

**Fix:** Track the household ID that was migrated instead of a boolean:

```typescript
const migratedHouseholdRef = useRef<string | null>(null);

// In loadBabies:
if (user?.householdId) {
  if (migratedHouseholdRef.current !== user.householdId) {
    migratedHouseholdRef.current = user.householdId;
    // ... run migration
  }
} else {
  migratedHouseholdRef.current = null;
}
```

---

## Issue 5: Household transition not atomic with sync queue flush

**Severity: LOW**
**File:** `src/contexts/sync-context.tsx`, lines 231-251

```typescript
const setAuthContext = useCallback(async (householdId: string, userId: string) => {
  if (syncEngineInstance) {
    const previousContext = syncEngineInstance.getAuthContext();
    if (previousContext && previousContext.householdId !== householdId) {
      try {
        await syncEngineInstance.flushQueueForHouseholdChange();
      } catch (err) {
        console.error('[SyncContext] Failed to flush queue for household change:', err);
      }
      dispatch({ type: 'SET_PENDING_COUNT', payload: 0 });
    }
    syncEngineInstance.setAuthContext({ householdId, userId });  // Line 242
  }
  if (realTimeSyncInstance) {
    realTimeSyncInstance.setAuthContext({ householdId, userId });
    realTimeSyncInstance.subscribeToHousehold(householdId).catch(...);  // Line 246
  }
}, []);
```

If `flushQueueForHouseholdChange()` fails (catch at line 237), the code still proceeds to set the new auth context (line 242). This means the queue has stale operations from the old household, but the engine now thinks it's in the new household.

**Impact:** Stale operations could be sent to the new household on the next sync. Low severity because the database RLS would reject them (wrong household_id), causing the operations to be quarantined after retries.

**Fix:** If flush fails, don't update auth context — abort the transition:

```typescript
if (previousContext && previousContext.householdId !== householdId) {
  try {
    await syncEngineInstance.flushQueueForHouseholdChange();
  } catch (err) {
    console.error('[SyncContext] Failed to flush queue — aborting household transition:', err);
    dispatch({ type: 'SYNC_ERROR', payload: 'Failed to switch households' });
    return; // Don't proceed with auth context change
  }
  dispatch({ type: 'SET_PENDING_COUNT', payload: 0 });
}
```

---

## Implementation Checklist

- [x] **Task 1:** Add `loadError: string | null` to `GrowthState` interface and `SET_LOAD_ERROR` action to growth reducer (`growth-context.tsx`).
- [x] **Task 2:** Add `loadError: string | null` to `DiaperState` interface and `SET_LOAD_ERROR` action to diaper reducer (`diaper-context.tsx`).
- [x] **Task 3:** Verify sleep, pumping, and tummy-time contexts have `loadError` — add if missing. (Already present in all three.)
- [x] **Task 4:** Add `wakeWindowConfig` to `buildWidgetData` useCallback dependency array (`widget-context.tsx`).
- [x] **Task 5:** Wrap Supabase user lookup queries in try-catch in active-timers remote change handler (`active-timers-context.tsx`).
- [x] **Task 6:** Change `hasMigratedRef` to track household ID instead of boolean (`baby-context.tsx`).
- [x] **Task 7:** Abort household transition if queue flush fails (`sync-context.tsx`).
