# Sync Engine Resilience Audit Report

## Summary

This audit examines the sync engine (`src/services/sync/sync-engine.ts`), the activity sync service (`src/services/activity-sync-service.ts`), and the real-time sync subsystem for resilience gaps. Five issues were identified ranging from data-loss scenarios during guest migration to missing timeouts on network requests. The most critical issue is that guest activity migration can silently lose data when individual upserts fail.

---

## Issue 1: Guest activity migration partial failure causes data loss

**Severity: HIGH**
**File:** `src/services/activity-sync-service.ts`, lines 1076-1300
**Affected functions:** `syncFeedingsForBaby`, `syncDiapersForBaby`, `syncSleepForBaby`, `syncPumpingForBaby`, `syncGrowthForBaby`, `syncTummyTimeForBaby`

All six `sync*ForBaby` functions follow the same flawed pattern. Here is `syncFeedingsForBaby` as a representative example:

```typescript
async function syncFeedingsForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const feedings = await getGuestActivities<StoredFeedingEntry>(KEYS.feedings, oldBabyId);
  if (feedings.length === 0) return;

  const migratedFeedings: StoredFeedingEntry[] = [];

  for (const feeding of feedings) {
    const newId = ensureUUID(feeding.id);
    const dbRecord = { /* ... */ };

    const { error } = await supabase.from('feedings').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync feeding:', feeding.id, error.message);
    }

    // BUG: Always pushes to migrated array regardless of whether upsert succeeded
    migratedFeedings.push({ ...feeding, id: newId, babyId: newBabyId });
  }

  // Writes ALL items (including failed ones) to user-scoped key
  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.feedings}${newBabyId}`),
    JSON.stringify(migratedFeedings)
  );

  // Deletes the source data unconditionally
  await clearGuestActivities(KEYS.feedings, oldBabyId);
}
```

**Problem:** When a Supabase upsert fails for an individual item, the code logs the error but still:
1. Pushes the failed item into the `migratedFeedings` array
2. Writes all items (including failed ones) to the new user-scoped AsyncStorage key
3. Calls `clearGuestActivities()` which deletes the original guest data

The failed items now exist only in local storage under the user-scoped key. They will never be retried for upload because the migration function only runs once during sign-up. If the user clears local storage or reinstalls, those activities are permanently lost.

**Impact:** Data loss during guest-to-authenticated user migration. If the network is flaky during sign-up, some activities are silently dropped from the server with no retry mechanism.

**Suggested fix:** Track success per item. Only include successfully synced items in the migrated array. Keep failed items in the guest storage key so the migration can be retried:

```typescript
const migratedFeedings: StoredFeedingEntry[] = [];
const failedFeedings: StoredFeedingEntry[] = [];

for (const feeding of feedings) {
  const newId = ensureUUID(feeding.id);
  const dbRecord = { /* ... */ };
  const { error } = await supabase.from('feedings').upsert(dbRecord);

  if (error) {
    console.error('[ActivitySync] Failed to sync feeding:', feeding.id, error.message);
    failedFeedings.push(feeding);
  } else {
    migratedFeedings.push({ ...feeding, id: newId, babyId: newBabyId });
  }
}

if (migratedFeedings.length > 0) {
  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.feedings}${newBabyId}`),
    JSON.stringify(migratedFeedings)
  );
}

if (failedFeedings.length > 0) {
  await AsyncStorage.setItem(
    `${KEYS.feedings}${oldBabyId}`,
    JSON.stringify(failedFeedings)
  );
} else {
  await clearGuestActivities(KEYS.feedings, oldBabyId);
}
```

---

## Issue 2: flushQueueForHouseholdChange persist is fire-and-forget

**Severity: MEDIUM**
**File:** `src/services/sync/sync-engine.ts`, lines 55-68

```typescript
flushQueueForHouseholdChange(): void {
  const pending = this.queue.getAll();
  if (pending.length > 0) {
    console.warn(`[SyncEngine] Flushing ${pending.length} queued operations due to household change`);
    for (const op of pending) {
      this.quarantined.push(op);
    }
    this.queue.clear();
    this.queue.persist().catch((err) => {
      console.error('[SyncEngine] Failed to persist after queue flush:', err);
    });
    this.processedOperationIds.clear();
    this.updateState({ pendingCount: 0 });
  }
}
```

**Problem:** `this.queue.persist().catch(...)` is fire-and-forget. The method is synchronous (`void` return), so the caller cannot await the persist. If `persist()` fails, the old queue data remains in AsyncStorage. On the next app launch, `restore()` will load the stale operations that belong to the previous household, and the engine may attempt to execute them against the new household's auth context.

**Impact:** After a household change, stale sync operations from the old household could be replayed against the new household if the persist call fails silently.

**Suggested fix:** Make `flushQueueForHouseholdChange` async. Await `persist()`. On failure, restore the queue state so the caller knows the flush did not complete:

```typescript
async flushQueueForHouseholdChange(): Promise<void> {
  const pending = this.queue.getAll();
  if (pending.length > 0) {
    for (const op of pending) {
      this.quarantined.push(op);
    }
    this.queue.clear();
    try {
      await this.queue.persist();
    } catch (err) {
      console.error('[SyncEngine] Failed to persist after queue flush, restoring queue:', err);
      for (const op of pending) {
        await this.queue.enqueue(op);
      }
      this.quarantined = this.quarantined.filter(
        q => !pending.some(p => p.id === q.id)
      );
      throw err;
    }
    this.processedOperationIds.clear();
    this.updateState({ pendingCount: 0 });
  }
}
```

---

## Issue 3: No timeout on Supabase requests in executeOperation

**Severity: MEDIUM**
**File:** `src/services/sync/sync-engine.ts`, lines 284-321

```typescript
private async executeOperation(operation: QueuedOperation): Promise<void> {
  const { table, type, entityId, data } = operation;

  switch (type) {
    case 'CREATE': {
      if (!data) throw new Error('CREATE operation requires data');
      const { error } = await supabase.from(table).insert(data);
      // ...
    }
    case 'UPDATE': {
      if (!data) throw new Error('UPDATE operation requires data');
      const { error } = await supabase
        .from(table)
        .update(data)
        .eq('id', entityId);
      // ...
    }
    case 'DELETE': {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', entityId);
      // ...
    }
  }
}
```

**Problem:** All three Supabase operations (`.insert()`, `.update()`, `.delete()`) have no timeout. If the network is in a degraded state where connections are established but responses never arrive, these promises can hang indefinitely. This blocks the entire sync pipeline since `pushChanges` processes operations sequentially.

**Impact:** The sync engine can become permanently stuck in the `syncing` state. No further operations will be processed, and the user sees a perpetual "syncing" indicator with no error.

**Suggested fix:** Wrap each Supabase call with an AbortController timeout:

```typescript
private async executeOperation(operation: QueuedOperation): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const { table, type, entityId, data } = operation;
    switch (type) {
      case 'CREATE': {
        if (!data) throw new Error('CREATE operation requires data');
        const { error } = await supabase
          .from(table)
          .insert(data)
          .abortSignal(controller.signal);
        if (error) { /* ... */ }
        break;
      }
      // ... similar for UPDATE and DELETE
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

## Issue 4: Quarantined operations only in memory

**Severity: LOW**
**File:** `src/services/sync/sync-engine.ts`, line 32

```typescript
private quarantined: QueuedOperation[] = [];
```

**Problem:** The `quarantined` array is a plain in-memory array with no persistence. Operations that exhaust their retry count are moved to this array (line 274-275), but on app restart the quarantined data is lost. There is no mechanism to review, retry, or even know that operations were quarantined.

**Impact:** Failed sync operations silently disappear on app restart. For example, if a CREATE operation for a feeding repeatedly fails due to a transient schema issue, the feeding will exist locally but never make it to the server, and after a restart there is no record of the failure.

**Suggested fix:** Persist quarantined operations to AsyncStorage under a dedicated key. Expose a method to review and retry quarantined operations. At minimum, persist on quarantine and restore on initialize:

```typescript
private static readonly QUARANTINE_KEY = '@sync:quarantined';

async quarantineOperation(operation: QueuedOperation): Promise<void> {
  this.quarantined.push(operation);
  this.queue.remove(operation.id);
  await this.queue.persist();
  await AsyncStorage.setItem(
    SyncEngine.QUARANTINE_KEY,
    JSON.stringify(this.quarantined)
  );
}

async initialize(): Promise<void> {
  await this.queue.restore();
  const quarantinedData = await AsyncStorage.getItem(SyncEngine.QUARANTINE_KEY);
  if (quarantinedData) {
    this.quarantined = JSON.parse(quarantinedData);
  }
  // ...
}
```

---

## Issue 5: pendingSync not checked on sync error path

**Severity: LOW**
**File:** `src/services/sync/sync-engine.ts`, lines 117-166

```typescript
async sync(): Promise<void> {
  if (!this.state.isConnected) return;

  if (this.isSyncing) {
    this.pendingSync = true;
    return;
  }

  this.isSyncing = true;
  this.updateState({ status: 'syncing', error: null });

  let retryCount = 0;
  const maxRetries = this.config.maxRetries;

  try {
    while (retryCount < maxRetries) {
      try {
        await this.pushChanges();

        this.updateState({ /* ... */ });
        this.isSyncing = false;

        // SUCCESS PATH: checks pendingSync
        if (this.pendingSync) {
          this.pendingSync = false;
          await this.sync();
        }
        return;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          this.updateState({ status: 'error', error: /* ... */ });
          throw error;
        }
        await this.delay(this.queue.calculateBackoff(retryCount));
      }
    }
  } finally {
    // ERROR PATH: clears isSyncing but never checks pendingSync
    this.isSyncing = false;
  }
}
```

**Problem:** When `sync()` throws after exhausting retries, the `finally` block sets `this.isSyncing = false` but never checks `this.pendingSync`. If another caller set `pendingSync = true` while the failed sync was in progress, that pending sync request is silently dropped. The success path at line 146-149 properly handles this, but the error path does not.

**Impact:** After a sync failure, queued operations that arrived during the failed sync attempt are not retried until the next external trigger (e.g., network change or app foreground). This can cause a longer-than-expected delay before data syncs.

**Suggested fix:** Move the `pendingSync` check into the `finally` block so it runs on both success and error paths:

```typescript
try {
  while (retryCount < maxRetries) {
    try {
      await this.pushChanges();
      this.updateState({ /* ... */ });
      return;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        this.updateState({ status: 'error', error: /* ... */ });
        throw error;
      }
      await this.delay(this.queue.calculateBackoff(retryCount));
    }
  }
} finally {
  this.isSyncing = false;
  if (this.pendingSync) {
    this.pendingSync = false;
    this.sync().catch(() => {});
  }
}
```

---

## Issue 6 (Additional Finding): SyncEngine.delay timer not cancellable on destroy

**Severity: LOW**
**File:** `src/services/sync/sync-engine.ts`, lines 323-325

```typescript
delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Problem:** The `delay()` method creates a `setTimeout` that cannot be cancelled. If `destroy()` is called while the engine is in a retry backoff delay, the timeout continues to run and resolves after the engine has been destroyed. This can cause the sync loop to continue executing `pushChanges()` on a destroyed engine.

**Impact:** Minor -- could trigger "use after destroy" warnings or unexpected behavior during app teardown, particularly during fast household switches.

**Suggested fix:** Store the timeout ID and clear it in `destroy()`:

```typescript
private delayTimer: ReturnType<typeof setTimeout> | null = null;

delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    this.delayTimer = setTimeout(() => {
      this.delayTimer = null;
      resolve();
    }, ms);
  });
}

destroy(): void {
  // ... existing cleanup ...
  if (this.delayTimer) {
    clearTimeout(this.delayTimer);
    this.delayTimer = null;
  }
}
```

---

## Priority Summary

| # | Issue | Severity | Type |
|---|---|---|---|
| 1 | ~~Guest activity migration pushes failed items and deletes source~~ | **High** | Data Loss | DONE |
| 2 | ~~flushQueueForHouseholdChange persist is fire-and-forget~~ | **Medium** | Data Integrity | DONE |
| 3 | ~~No timeout on Supabase requests in executeOperation~~ | **Medium** | Reliability | DONE |
| 4 | ~~Quarantined operations only in memory, lost on restart~~ | **Low** | Data Loss | DONE |
| 5 | ~~pendingSync not checked on sync error path~~ | **Low** | Edge Case | DONE |
| 6 | ~~SyncEngine.delay timer not cancellable on destroy~~ | **Low** | Resource Leak | DONE |
