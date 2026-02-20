# Multi-Caregiver Household Edge Cases Report

## 1. Executive Summary

Several confirmed bugs and dangerous untested paths were identified: orphaned timer locks during household transitions, completely non-functional echo filtering, dead conflict resolution infrastructure, and stale lock cleanup that never runs.

---

## 2. Confirmed Bugs

### Bug 1: Orphaned Timer Locks on Household Leave/Removal

**Severity: HIGH**

`leave_household` and `remove_caregiver` SQL functions do NOT clean up `active_timers` for the departing user. This permanently blocks other caregivers from the affected activity type.

**Fix:** Add `DELETE FROM active_timers WHERE started_by = v_user_id` to both SQL functions.

### Bug 2: Stale Lock Cleanup Never Runs

**Severity: HIGH**

`cleanup_stale_timer_locks()` exists in migration 020 but has NO caller -- no pg_cron job, no Edge Function, no client trigger. Crashed app locks persist forever.

**Fix:** Set up pg_cron or Edge Function cron to call periodically (e.g., every hour).

### Bug 3: Dead Echo Filter

**Severity: LOW (mitigated)**

`_device_id` echo detection in `RealTimeSync.isEchoFromSameDevice()` never triggers because no code writes `_device_id` to any database table. The in-memory dedup by ID in `REMOTE_INSERT` masks this issue.

### Bug 4: Dead Conflict Resolution System

**Severity: LOW (dead code)**

`ConflictResolver`, `pullChanges()`, and the entire conflict resolution type system are never invoked. `CREATE_CREATE` `KEEP_BOTH` strategy would produce database duplicates if activated.

---

## 3. Timer Lock Scenario Matrix

| Scenario | Expected | Actual | Severity |
|---|---|---|---|
| Two caregivers acquire same lock | One succeeds, one blocked | **Correct** | N/A |
| App crash while holding lock | Lock expires after TTL | Lock persists **indefinitely** | **HIGH** |
| Leave household while holding lock | Lock released | Lock **orphaned** | **HIGH** |
| Removed from household while holding lock | Lock released | Lock **orphaned** | **HIGH** |
| Network failure during lock release | Retry | **No retry** -- lock persists | **MEDIUM** |

---

## 4. Simultaneous Activity Creation

| Scenario | Expected | Actual | Severity |
|---|---|---|---|
| Both online, create same type | Both saved, both visible | **Correct** | N/A |
| Echo from own INSERT | Filtered | Not filtered (dead mechanism) but dedup by ID prevents visible duplicate | **LOW** |
| Both log same real-world event | Detected | No server-side dedup; client-side heuristic only | **LOW** |

---

## 5. Household Transition Scenarios

| Scenario | Expected | Actual | Severity |
|---|---|---|---|
| Join during active sync | Old ops discarded | Old ops fail at DB (RLS/FK), retry 5x, quarantined | **MEDIUM** |
| Invite code regen during join | Clean failure | **Correct** -- "Household not found" | N/A |
| Owner tries to leave | Blocked | **Correct** | N/A |

---

## 6. Realtime Subscription Lifecycle

| Scenario | Expected | Actual | Severity |
|---|---|---|---|
| Old channel on household change | Clean teardown | **Correct** | N/A |
| Events during transition window | Filtered | Pass through but baby_id check catches most | **LOW** |
| Channel error/timeout | Auto-reconnect | No automatic reconnect | **MEDIUM** |

---

## 7. Recommendations (by priority)

1. Add timer lock cleanup to `leave_household` and `remove_caregiver` SQL functions
2. Set up periodic stale lock cleanup (pg_cron or Edge Function)
3. Add queue flush on household change in `setAuthContext`
4. Either implement `_device_id` writing or remove dead echo code
5. Add retry logic to `releaseTimerLock` calls

---

## 8. Implementation TODO

- [x] **Task 1:** Add `DELETE FROM active_timers WHERE started_by = v_user_id` to `leave_household` SQL function (migration 044)
- [x] **Task 2:** Add `DELETE FROM active_timers WHERE started_by = caregiver_id` to `remove_caregiver` SQL function (migration 044)
- [x] **Task 3:** Create Edge Function `cleanup-stale-timers` that calls `cleanup_stale_timer_locks()` (invokable via cron)
- [x] **Task 4:** Add queue flush on household change in `setAuthContext` (clear old household queue + quarantine)
- [x] **Task 5:** Remove dead `isEchoFromSameDevice()` method and `_device_id` / `deviceId` infrastructure from `RealTimeSync`
- [x] **Task 6:** Remove dead `ConflictResolver` class, its test file, conflict types from `types.ts`, and its re-export from `index.ts`
- [x] **Task 7:** Add retry logic (using `withRetry`) to `releaseTimerLock` in `active-timer-service.ts`
