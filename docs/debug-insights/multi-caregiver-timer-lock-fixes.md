# Multi-Caregiver Timer Lock & Dead Code Fixes

## Problem

The multi-caregiver household system had several bugs around timer locks and accumulated dead code from features that were never fully wired up.

### Bug 1: Orphaned Timer Locks (HIGH severity)

When a caregiver left a household or was removed by the owner, any active timer locks they held were never cleaned up. The `leave_household` and `remove_caregiver` SQL functions moved the user to a new household but left their `active_timers` rows behind. Because of the `UNIQUE(baby_id, activity_type)` constraint, this permanently blocked all other caregivers from starting that activity type for that baby.

**Root cause:** The `active_timers` table was added in migration 020, after the household transition functions were written in migrations 007 and 014. Nobody updated the older functions to account for the new table.

**Fix:** Migration 044 recreates both `leave_household` and `remove_caregiver` with `DELETE FROM active_timers WHERE started_by = <user_id>` before moving the user to their new household.

### Bug 2: Stale Lock Cleanup Never Ran (HIGH severity)

Migration 020 defined a `cleanup_stale_timer_locks()` function that deletes locks older than 12 hours, but nothing ever called it — no pg_cron job, no Edge Function, no client trigger. If the app crashed while holding a lock, that lock persisted forever.

**Fix:** Created Edge Function `cleanup-stale-timers` that calls the existing RPC. Needs to be deployed and scheduled via cron (e.g., every hour).

### Bug 3: No Queue Flush on Household Change (MEDIUM severity)

When a user changed households (leave/join), the sync queue still contained operations targeting the old household's data. These operations would fail at the database level (RLS/FK violations), retry 5 times, then get quarantined — wasting time and bandwidth.

**Root cause:** `setAuthContext` in `SyncContext` updated the auth context but never checked if the household actually changed, so stale operations remained in the queue.

**Fix:** Added `flushQueueForHouseholdChange()` to `SyncEngine` that moves all pending operations to quarantine when a household change is detected. `setAuthContext` now compares the previous and new household IDs before setting context.

### Bug 4: No Retry on Timer Lock Release (MEDIUM severity)

`releaseTimerLock` in `active-timer-service.ts` made a single attempt to delete the lock. On network failure, the lock persisted until the 12-hour stale cleanup (which itself wasn't running — see Bug 2).

**Fix:** Wrapped the Supabase delete call in `withRetry` (3 retries, exponential backoff). Also had to change `throw error` to `throw new Error(error.message)` because Supabase error objects aren't standard Error instances, and `withRetry` needs proper Error objects for its retryable-error pattern matching.

### Bug 5: Dead Echo Filter (LOW severity, mitigated)

`RealTimeSync.isEchoFromSameDevice()` checked for a `_device_id` field in Realtime payloads, but no code ever wrote `_device_id` to any database table. The mechanism was completely non-functional. The in-memory dedup by record ID in `REMOTE_INSERT` handlers masked the issue.

**Fix:** Removed `deviceId`, `generateDeviceId()`, `getDeviceId()`, `isEchoFromSameDevice()`, and all related test code. Echo suppression was never needed because each context's reducer already deduplicates by record ID.

### Bug 6: Dead Conflict Resolution System (LOW severity, dead code)

`ConflictResolver`, `ConflictResolutionModal`, and all conflict resolution types (`ConflictType`, `ConflictScenario`, `ConflictResolution`, `ResolutionStrategy`) were never invoked by any production code. The `CREATE_CREATE` strategy returned `KEEP_BOTH`, which would have produced database duplicates if ever activated.

**Fix:** Deleted `conflict-resolver.ts`, its test file, `ConflictResolutionModal.tsx`, its component test, and removed conflict types from `types.ts`. Cleaned up re-exports from `sync/index.ts` and `components/index.ts`.

## Key Takeaway

When adding a new table that participates in cross-cutting concerns (like `active_timers` affecting household transitions), audit ALL existing functions that touch the affected entities. The timer lock system was added months after the household management functions and nobody updated them — a classic "feature addition without full-system audit" bug.

## Files Changed

- `supabase/migrations/044_cleanup_timers_on_household_transition.sql` — new migration
- `supabase/functions/cleanup-stale-timers/index.ts` — new Edge Function
- `src/services/sync/sync-engine.ts` — added `flushQueueForHouseholdChange()`
- `src/contexts/sync-context.tsx` — household change detection in `setAuthContext`
- `src/services/active-timer-service.ts` — retry logic on `releaseTimerLock`
- `src/services/sync/real-time-sync.ts` — removed dead echo filter
- `src/services/sync/types.ts` — removed dead conflict types
- `src/services/sync/index.ts` — removed conflict-resolver re-export
- `src/components/index.ts` — removed ConflictResolutionModal re-export

## Files Deleted

- `src/services/sync/conflict-resolver.ts`
- `src/services/sync/conflict-resolver.test.ts`
- `src/components/ConflictResolutionModal.tsx`
- `src/components/ConflictResolutionModal.component.test.tsx`
