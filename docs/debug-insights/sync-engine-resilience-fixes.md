# Sync Engine Resilience Fixes

## Context

A stability audit of the sync engine (`src/services/sync/sync-engine.ts`) and activity sync service (`src/services/activity-sync-service.ts`) revealed six resilience gaps ranging from data loss during guest migration to missing request timeouts.

---

## Issue 1: Guest activity migration silently loses data on partial failure (HIGH)

**Problem:** All six `sync*ForBaby` functions in `activity-sync-service.ts` followed the same flawed pattern during guest-to-authenticated user migration. When a Supabase upsert failed for an individual item, the code logged the error but still:
1. Pushed the failed item into the migrated array
2. Wrote all items (including failed ones) to the user-scoped AsyncStorage key
3. Called `clearGuestActivities()` which deleted the original guest data

Failed items existed only in local storage under the new key, never retried for upload since migration only runs once during sign-up. App reinstall = permanent data loss.

**Fix:** Track success per item with separate `migrated` and `failed` arrays. Only successfully synced items go into the user-scoped key. Failed items are written back to the guest storage key so migration can be retried. Guest data is only cleared when all items succeed.

**Files changed:** `src/services/activity-sync-service.ts` (all six `sync*ForBaby` functions)

---

## Issue 2: flushQueueForHouseholdChange persist is fire-and-forget (MEDIUM)

**Problem:** `flushQueueForHouseholdChange()` was synchronous (`void` return). It called `this.queue.persist().catch(...)` without awaiting it. If persist failed, old queue data remained in AsyncStorage. On next app launch, `restore()` would load stale operations from the previous household and replay them against the new household's auth context.

**Fix:** Made the method `async`. Awaits `persist()`. On failure, restores the queue state (re-enqueues operations, removes them from quarantine) and throws so the caller knows the flush failed. Updated the caller in `sync-context.tsx` to await with error handling.

**Files changed:** `src/services/sync/sync-engine.ts`, `src/contexts/sync-context.tsx`

---

## Issue 3: No timeout on Supabase requests in executeOperation (MEDIUM)

**Problem:** All Supabase operations (insert, update, delete) in `executeOperation` had no timeout. On degraded networks where connections establish but responses never arrive, these promises hang indefinitely, blocking the entire sync pipeline since `pushChanges` processes sequentially. The user sees a perpetual "syncing" indicator.

**Fix:** Added a 30-second `AbortController` timeout wrapping each Supabase call via `.abortSignal(controller.signal)`. The timeout is cleaned up in a `finally` block.

**Files changed:** `src/services/sync/sync-engine.ts`, `src/services/sync/sync-engine.test.ts` (updated mock chain to support `.abortSignal()`)

---

## Issue 4: Quarantined operations lost on restart (LOW)

**Problem:** The `quarantined` array was in-memory only. Operations that exhausted retries were moved there, but on app restart the data was lost. No way to review, retry, or even know operations were quarantined.

**Fix:** Quarantined operations are now persisted to AsyncStorage under `@sync:quarantined`. They are restored during `initialize()` and cleared during `clearAllData()`. The `quarantineOperation()` method writes to storage after each quarantine.

**Files changed:** `src/services/sync/sync-engine.ts`

---

## Issue 5: pendingSync not checked on sync error path (LOW)

**Problem:** When `sync()` threw after exhausting retries, the `finally` block set `isSyncing = false` but never checked `pendingSync`. If another caller set `pendingSync = true` while the failed sync was running, that request was silently dropped. The success path handled this correctly, but the error path did not.

**Fix:** Moved the `pendingSync` check into the `finally` block so it runs on both success and error paths. The pending sync is triggered with `.catch(() => {})` to avoid unhandled rejection since errors are already handled inside `sync()`.

**Files changed:** `src/services/sync/sync-engine.ts`

---

## Issue 6: delay timer not cancellable on destroy (LOW)

**Problem:** The `delay()` method created a `setTimeout` that couldn't be cancelled. If `destroy()` was called during a retry backoff, the timeout continued running and resolved after the engine was destroyed, potentially causing the sync loop to execute on a destroyed engine.

**Fix:** Stored the timeout ID in `this.delayTimer`. The `destroy()` method now clears it. The timer self-cleans on resolution.

**Files changed:** `src/services/sync/sync-engine.ts`

---

## Key Takeaway

The common thread across these issues is **missing failure path handling**. The happy path worked correctly in every case, but edge cases (network errors during migration, persist failures, timeouts, app restarts, concurrent sync requests during failures) were either unhandled or handled incorrectly. When writing async pipelines that manage important data, explicitly trace every failure branch and verify that data is either safely persisted or recoverable.
