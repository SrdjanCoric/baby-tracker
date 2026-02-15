# Allow Any Household Caregiver to Pause/Stop Timers

## Context

Currently, when caregiver A starts a timer (feeding, sleep, pumping, tummy time), caregiver B sees a read-only card with an hourglass — they cannot pause, resume, or stop the timer. This restriction is enforced at 5 layers: database RLS, DB function, service layer, context layer, UI + widget. We want to remove these restrictions so any household caregiver can control any timer for their baby.

**Key design decision:** When caregiver B stops a remote timer, B creates a **basic activity record** from the lock data (start time, end time, duration, activity type) and releases the lock. This ensures the record appears in the timeline immediately even if A is offline. When A's device detects its lock was removed, it simply clears local timer state without saving (B already saved). The basic record may lack some detail (e.g., per-side breastfeeding durations) but captures all essential information.

---

## Step 1: Database Migration

**New file:** `supabase/migrations/039_allow_household_timer_control.sql`

1. **Drop + recreate UPDATE RLS policy** — allow any household member to update:
```sql
DROP POLICY "Users can update their own active timers" ON active_timers;
CREATE POLICY "Users can update active timers for household babies"
  ON active_timers FOR UPDATE
  USING (baby_id IN (
    SELECT b.id FROM babies b
    JOIN users u ON b.household_id = u.household_id
    WHERE u.id = auth.uid()
  ));
```

2. **Drop + recreate DELETE RLS policy** — allow any household member to delete:
```sql
DROP POLICY "Users can delete their own active timers" ON active_timers;
CREATE POLICY "Users can delete active timers for household babies"
  ON active_timers FOR DELETE
  USING (baby_id IN (
    SELECT b.id FROM babies b
    JOIN users u ON b.household_id = u.household_id
    WHERE u.id = auth.uid()
  ));
```

3. **Update `release_timer_lock` function** — remove `started_by` filter, verify household membership instead:
```sql
CREATE OR REPLACE FUNCTION release_timer_lock(
  p_baby_id UUID,
  p_activity_type VARCHAR(20),
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
  v_household_id UUID;
BEGIN
  -- Verify user has access to this baby's household
  SELECT b.household_id INTO v_household_id
  FROM babies b
  JOIN users u ON b.household_id = u.household_id
  WHERE b.id = p_baby_id AND u.id = p_user_id;

  IF v_household_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM active_timers
  WHERE baby_id = p_baby_id
    AND activity_type = p_activity_type;
  -- REMOVED: AND started_by = p_user_id

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;
```

INSERT policy and `acquire_timer_lock` remain unchanged (only the starter can be recorded as `started_by`).

---

## Step 2: Service Layer

**File:** `src/services/active-timer-service.ts`

1. **`releaseTimerLock`** (line 75): Remove `.eq("started_by", userId)` from delete query
2. **`updateTimerData`** (line 187): Remove `.eq("started_by", userId)` from update query

Keep `userId` param in signatures to minimize call-site changes (parameter is still useful for logging).

---

## Step 3: Dashboard Card UI

**File:** `src/components/DashboardCard.tsx`

When `isLockedByOther` is true, change from disabled/hourglass to interactive:

- **Card press:** Keep it working — `onPress={onPress}` instead of `onPress={undefined}`
- **Card styling:** Remove `disabled={true}`, keep the border/badge visual that shows another caregiver's initial
- **Action button:** Show stop button (⏹) instead of hourglass (⏳) — wire to `onActionPress`
- **Keep:** The informational text ("Sarah is feeding", elapsed time), the caregiver initial badge

---

## Step 4: Home Screen

**File:** `app/(tabs)/index.tsx`

1. **`getTimerLockInfo`** — still computes `isLocked` / `lockedByName` / `elapsedTime` (no change)
2. **`getCardProps`** for each activity — when lock exists:
   - `onPress` → navigate to activity screen (same as when no lock — already the default handler)
   - `onActionPress` → call the context's `stopRemoteTimer(lock)` function (see Step 5)

Add a `handleRemoteStop` helper per activity that:
- Gets the lock from `getLockForActivity`
- Calls the appropriate context function (e.g., `stopRemoteFeeding(lock)`)
- The context function creates a basic record + releases the lock

---

## Step 5: Activity Contexts — Remote Stop + External Lock Removal

**Files:**
- `src/contexts/feeding-context.tsx`
- `src/contexts/sleep-context.tsx`
- `src/contexts/pumping-context.tsx`
- `src/contexts/tummyTime-context.tsx`

### 5a: Add `stopRemoteTimer` function to each context

Each context gets a new function that stops a timer started by another caregiver:

```typescript
const stopRemoteFeeding = async (lock: ActiveTimerLock) => {
  const endTime = new Date();
  const startTime = new Date(lock.startedAt);
  const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  // Release lock first — if it fails (already released), don't create record
  const released = await releaseTimerLock(babyId, "feeding", userId);
  if (!released) return;

  // Create basic activity record from lock data
  // Feeding: type=breast, no per-side durations
  // Sleep/Pumping/TummyTime: just start + end time
  await createRecordFromLockData(lock, endTime, duration);
  dispatch({ type: "ADD_...", payload: newRecord });
};
```

Key: use `releaseTimerLock` return value as a guard — if it returns false (someone else already stopped it), skip record creation. This prevents duplicate records.

### 5b: Handle external lock removal for the **original caregiver's device**

When A's device detects its own timer was stopped by someone else:

1. **Watch for lock removal:** Add a `useEffect` that monitors `locks` from `useActiveTimers()`. When:
   - The context has an active local timer (`state.activeTimer` is set)
   - The corresponding lock no longer exists in `ActiveTimersContext`
   - → **Clear local timer state** (AsyncStorage + dispatch STOP) without saving a record (B already created one)

2. **Foreground check:** In the existing timer restore logic, after restoring from AsyncStorage, verify the DB lock still exists via `getActiveTimerLock()`. If not → clear timer without saving.

---

## Step 6: Widget

**File:** `targets/widget/index.swift`

1. **`StopActivityIntent`** (~line 383): Remove `&started_by=eq.\(userId)` from the DELETE URL
2. **Small widget** (~line 959): Remove `if isActive && isRemote` branch that shows "⏳ In use" — always show the stop `Button`
3. **Medium widget** (~line 1206): Remove `if isRemoteLock` branch — always wrap active timers in `Button(intent: StopActivityIntent(...))`
4. **Large widget** (~line 1484): Remove `if isRemoteLock && isActive` branch — always wrap in stop Button
5. **Lock screen widgets**: Remove `isRemote` branches that show hourglass — show timer normally

Keep the `isRemote` flag and `context` field for display purposes (e.g., showing "Sarah" next to the timer).

**File:** `src/contexts/widget-context.tsx` — no changes needed (already provides all lock data to widget).

---

## Step 7: Active Timers Context

**File:** `src/contexts/active-timers-context.tsx`

No functional changes needed. `isLockedByOther` and `getLockedByName` remain — they're still useful for displaying who started the timer. The semantic change is that they're now **informational** (not blocking).

---

## Step 8: Duplicate Guard (Backwards Compatibility)

When creating any activity record (in both existing stop functions and the new `stopRemoteTimer` functions), add a pre-check:

```typescript
const existing = await supabase.from("feedings") // or sleeps, pumpings, tummy_times
  .select("id")
  .eq("baby_id", babyId)
  .eq("started_at", startedAt.toISOString())
  .maybeSingle();

if (existing.data) return; // Record already exists, skip creation
```

This handles the rollout scenario where A (old version) and B (new version) both try to create a record for the same timer. Both versions create records with the same `started_at` from the timer, so this check prevents duplicates regardless of app version.

Add this guard to:
- Each context's `stopRemoteTimer` function (new)
- Each context's existing stop function (e.g., `stopBreastfeeding`, `stopSleep`, etc.)

Cost: one extra SELECT per stop — negligible.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `supabase/migrations/039_allow_household_timer_control.sql` | New: RLS policies + release_timer_lock update |
| `src/services/active-timer-service.ts` | Remove `started_by` filter from 2 functions |
| `src/components/DashboardCard.tsx` | Make interactive when `isLockedByOther` |
| `app/(tabs)/index.tsx` | Add remote stop handlers, pass through `onPress`/`onActionPress` |
| `src/contexts/feeding-context.tsx` | Add `stopRemoteFeeding`, detect external lock removal → clear state |
| `src/contexts/sleep-context.tsx` | Add `stopRemoteSleep`, detect external lock removal → clear state |
| `src/contexts/pumping-context.tsx` | Add `stopRemotePumping`, detect external lock removal → clear state |
| `src/contexts/tummyTime-context.tsx` | Add `stopRemoteTummyTime`, detect external lock removal → clear state |
| `targets/widget/index.swift` | Remove `started_by` filter, make all timers interactive |

---

## Verification

1. **Typecheck:** `npm run typecheck`
2. **Unit tests:** `npm run test:unit`
3. **Manual testing (2-device scenario):**
   - Caregiver A starts feeding timer → B sees timer with stop button (not hourglass)
   - B presses stop → basic record appears in timeline immediately, A's timer clears
   - A starts sleep timer → B stops from widget → record created, A's timer clears
   - A starts timer, B stops while A is offline → record exists. A opens app → local timer cleared (no duplicate record)
   - Both A and B tap stop simultaneously → only one record created (guard via `releaseTimerLock` return value)
