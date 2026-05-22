# Dashboard Stop Timer Race Condition — Duplicate Sleep Entries

## Symptom

Stopping a sleep timer from the dashboard card's stop button occasionally results in the entry appearing in the timeline but the timer continuing. Stopping again creates a duplicate entry.

## Root Cause

Race condition between `stopSleep()` and `loadSleeps()` in `sleep-context.tsx`.

Both functions share `isStoppingRef` as coordination, but there's a timing gap:

1. `loadSleeps()` is already running (triggered by foreground refresh or dependency change). It runs ~140 lines of async work (DB fetch, goals, wake windows, milestone checks — lines 414-545) **before** checking `isStoppingRef` at line 547.

2. User taps stop → `stopSleep()` sets `isStoppingRef = true`, saves entry, dispatches `STOP_TIMER`, releases lock, then `finally` resets `isStoppingRef = false` (line 946).

3. `loadSleeps()` reaches the timer restoration section (line 547+). By now `isStoppingRef` is `false` again. It finds:
   - The local AsyncStorage timer (if `clearActiveTimer` was slow), or
   - The server lock (if `releaseTimerLock` failed — errors swallowed at line 939)

4. `loadSleeps()` dispatches `RESTORE_TIMER` → timer reappears despite entry already saved.

5. User stops again → second entry created.

**Contributing factor:** `releaseTimerLock` failures are silently swallowed. The existing `queuePendingLockRelease()` function is never called, so orphaned locks persist and get restored by `loadSleeps`.

## Fix

1. **Version counter** — Add `stopVersionRef` that increments on each stop. `loadSleeps` captures the version at start and compares before restoring. Even if `isStoppingRef` resets, version mismatch blocks restoration.

2. **Queue failed lock releases** — Call `queuePendingLockRelease()` when `releaseTimerLock` fails, so the existing retry mechanism cleans up orphaned locks.

3. **Dispatch STOP_TIMER on stale detection** — When `loadSleeps` finds a local timer without a matching server lock, dispatch `STOP_TIMER` to clear in-memory state (currently only clears AsyncStorage).

4. **Cross-reference lock with entries** — Before restoring from a server lock, check if a sleep entry already exists with matching `startedAt`. If so, release the orphaned lock instead.
