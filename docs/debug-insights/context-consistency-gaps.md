# Context Provider Consistency Gaps

**Date:** 2026-02-20
**Files involved:** `src/contexts/growth-context.tsx`, `src/contexts/diaper-context.tsx`, `src/contexts/widget-context.tsx`, `src/contexts/active-timers-context.tsx`, `src/contexts/baby-context.tsx`, `src/contexts/sync-context.tsx`

## Symptom
Multiple subtle issues across context providers, discovered during a cross-context consistency audit:
1. Growth and diaper screens show empty lists with no error indication when data fails to load
2. Widget shows stale nap slot/wake window data after user changes settings (requires app restart)
3. Active timer remote change handler could crash and break sync for all activity types
4. Baby data migration runs again unnecessarily when rejoining the same household
5. Household transition proceeds with stale sync queue if flush fails

## Root Cause
Each issue had a different root cause, but the common theme was inconsistent patterns across contexts — some contexts had protections that others lacked:

1. **Missing loadError state:** Feeding, sleep, pumping, and tummyTime contexts all had `loadError: string | null` with `SET_LOAD_ERROR` actions and outer try-catch in their load functions. Growth and diaper contexts were missing this entirely — their load functions had inner try-catch (DB fallback to local) but no outer try-catch, so if the local storage fallback also failed, the error was unhandled and the user saw an empty list with `isLoading: false`.

2. **Missing useCallback dependency:** `buildWidgetData` in widget-context uses `getCurrentNapSlotRef.current()` which depends on `wakeWindowConfig`. The ref is updated via a separate useEffect, but the `buildWidgetData` callback itself was not recreated when `wakeWindowConfig` changed because it was missing from the dependency array. The widget data hash comparison then saw no change.

3. **Unprotected `.single()` calls:** Supabase's `.single()` throws when it gets 0 or >1 rows. The INSERT and UPDATE handlers in active-timers-context called `.single()` on a user lookup without try-catch. If the user was deleted, this threw through `RealTimeSync.notifyChangeListeners()` forEach, potentially blocking subsequent listeners.

4. **Boolean migration ref:** `hasMigratedRef` was a simple boolean. When a user leaves household A (ref resets to false), then rejoins household A, the migration runs again unnecessarily. The migration itself is idempotent (upsert), but it causes extra network calls.

5. **Non-atomic household transition:** If `flushQueueForHouseholdChange()` failed, the catch block logged the error but execution continued to `setAuthContext()` with the new household. This left stale operations from the old household in the queue, now tagged with the new household's auth context.

## Fix
1. Added `loadError: string | null` to `GrowthState` and `DiaperState` interfaces, `SET_LOAD_ERROR` action to both reducers, wrapped load functions in outer try-catch that dispatches `SET_LOAD_ERROR` on failure and uses `finally` for `SET_LOADING: false`.

2. Added `wakeWindowConfig` to the `buildWidgetData` useCallback dependency array.

3. Wrapped both INSERT and UPDATE Supabase `.single()` user lookups in try-catch with fallback to `"Someone"` display name.

4. Changed `hasMigratedRef` from `useRef(false)` to `useRef<string | null>(null)`, tracking the household ID instead of a boolean. Now checks `migratedHouseholdRef.current !== user.householdId` instead of `!hasMigratedRef.current`.

5. Added `return` after the catch block in `setAuthContext` so the household transition aborts if the queue flush fails, and dispatches a `SYNC_ERROR` to surface it to the user.

## Lessons / Notes
- When adding a pattern to one context (like `loadError`), audit ALL sibling contexts for the same pattern. Copy-paste drift is the #1 source of inconsistency.
- `useCallback` dependency arrays are a common source of stale data bugs, especially when the callback reads from refs that are updated by separate effects. If the ref update depends on a value, that value should also be in the callback's deps.
- Supabase `.single()` is a throwing call — always wrap in try-catch when used in event handlers or listeners where an unhandled error could cascade.
- Boolean refs for "has this happened" should often be "what value was this for" refs to handle re-entry with the same or different values.
- Error handling in transition logic (like household switching) should be atomic: if a prerequisite step fails, don't proceed with subsequent steps that assume the prerequisite succeeded.
