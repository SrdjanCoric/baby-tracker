# Sync Pipeline Data Integrity Audit Report

## Summary

After thoroughly reviewing the sync pipeline from local storage through the queue to Supabase upsert, I identified **5 confirmed bugs**, **4 high-severity potential bugs**, and **several medium/low concerns**. The most critical issues involve incorrect field mappings in transform functions that cause data loss when reading from the database, and missing `updated_at` columns being written to tables that don't have them.

---

## 1. CONFIRMED BUGS

### Bug 1: Diaper `updatedAt` uses `created_at` instead of `updated_at` in transform

**Severity: High**
**File:** `src/services/activity-sync-service.ts`, line 414

```typescript
function transformDiaperFromDb(data: Record<string, unknown>): StoredDiaperEntry {
  return {
    // ...
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.created_at as string) || new Date().toISOString(),  // BUG: should be data.updated_at
  };
}
```

**Impact:** Every diaper fetched from the database gets its `updatedAt` set to `createdAt`. This means conflict resolution (which compares `updatedAt` timestamps) will always see diapers as having never been updated, potentially causing stale data to win over newer edits. Additionally, the `diapers` table in the database (migration 001, line 81) does NOT have an `updated_at` column at all, so this will always fall back to `created_at` or `new Date().toISOString()` anyway. But the real problem is the code is semantically wrong and masks the underlying schema issue.

### Bug 2: Tummy Time `updatedAt` uses `created_at` instead of `updated_at` in transform

**Severity: High**
**File:** `src/services/activity-sync-service.ts`, line 982

**Impact:** Same issue as diaper transform. `updatedAt` is mapped from `created_at`.

### Bug 3: Pumping `updatedAt` always uses current time instead of DB value in transform

**Severity: High**
**File:** `src/services/activity-sync-service.ts`, line 703

```typescript
function transformPumpingFromDb(data: Record<string, unknown>): StoredPumpingEntry {
  return {
    // ...
    updatedAt: new Date().toISOString(),  // BUG: always uses NOW, ignores DB value
  };
}
```

**Impact:** Every time pumping data is fetched from the database, `updatedAt` is set to the current time. This makes every fetch look like an "update", breaking conflict resolution entirely for pumping sessions.

### Bug 4: Growth `updatedAt` always uses current time instead of DB value in transform

**Severity: High**
**File:** `src/services/activity-sync-service.ts`, line 845

**Impact:** Same issue as pumping. Growth measurements always appear "just updated" in local state, breaking conflict resolution.

### Bug 5: Growth context `transformGrowthFromRemote` uses wrong column name `head_circumference_cm`

**Severity: High**
**File:** `src/contexts/growth-context.tsx`, line 288

```typescript
function transformGrowthFromRemote(data: Record<string, unknown>): StoredGrowthEntry {
  return {
    // ...
    headCircumferenceCm: data.head_circumference_cm != null ? (data.head_circumference_cm as number) : undefined,
    // BUG: DB column is `head_cm`, not `head_circumference_cm`
  };
}
```

Meanwhile, `transformGrowthFromDb` in `activity-sync-service.ts` (line 841) correctly uses `data.head_cm`.

**Impact:** When growth measurements arrive via Realtime (remote changes from another caregiver), `headCircumferenceCm` will always be `undefined` because `data.head_circumference_cm` doesn't exist in the Supabase payload. Head circumference data from other household members will silently be lost in the receiving client's state.

---

## 2. SCHEMA MISMATCH ISSUES

### Issue 6: Missing `updated_at` columns in 4 database tables

**Severity: Medium**

The following tables do NOT have an `updated_at` column in the database schema:
- `diapers` (migration 001, line 73-82)
- `pumping_sessions` (migration 001, line 85-96)
- `growth_measurements` (migration 001, line 99-109)
- `tummy_time_sessions` (migration 001, line 112-121)

Only `feedings`, `sleep_sessions`, and `babies` have `updated_at`.

**Impact:** For these 4 tables, `updatedAt` only exists locally and is never persisted to the database. This breaks cross-device conflict resolution for these activity types.

### Issue 7: Feeding `amount` column name mismatch with database `solid_amount`

**Severity: Medium**
**File:** `src/services/activity-sync-service.ts`, lines 180, 209, 271

The code sends `amount: input.amount` and reads `data.amount`, but the database column is `solid_amount` (migration 001, line 51).

**Impact:** Solid food amount data will never be correctly written to or read from the database. The INSERT will succeed but the `solid_amount` column will remain NULL. Postgres ignores extra columns, so the data is silently lost.

---

## 3. SYNC QUEUE & ENGINE ISSUES

### Issue 8: `processedOperationIds` unbounded growth (memory leak)

**Severity: Medium**
**File:** `src/services/sync/sync-engine.ts`, line 35

This `Set` grows with every operation but is never pruned (except on `clearAllData()`). The set is not persisted, so it resets on app restart but then provides no dedup protection for operations queued before restart.

### Issue 9: `pendingSync` flag can miss a third concurrent sync request

**Severity: Low**
**File:** `src/services/sync/sync-engine.ts`, lines 103-153

The `pendingSync` flag is a boolean, not a counter. Low impact since the re-sync processes the entire queue anyway.

### Issue 10: Silent error swallowing in `queueSyncOperation`

**Severity: Medium**
**File:** `src/services/activity-sync-service.ts`, lines 57-71

`engine.sync().catch(() => {})` -- sync errors are completely silenced. If sync consistently fails (e.g., auth token expired), the user gets no feedback.

### Issue 11: Local state always succeeds even when sync queue fails

**Severity: Medium**
**File:** `src/services/activity-sync-service.ts`, lines 131-189

The local state update and the sync queue operation are not atomic. If queueing fails, the entry exists locally but never gets queued. For deletes: the entry is removed locally but still exists in the remote database and will reappear on next fetch.

---

## 4. CONFLICT RESOLUTION ISSUES

### Issue 12: `pullChanges` is a no-op

**Severity: Medium**
**File:** `src/services/sync/sync-engine.ts`, lines 236-238

The `pullChanges` method is completely empty. The conflict resolver is **never actually used**. The actual conflict handling is purely "last write wins" at the database level.

### Issue 13: Quarantined operations are only in memory

**Severity: Low**
**File:** `src/services/sync/sync-engine.ts`, line 34

Quarantined operations are stored only in memory and lost on app restart.

---

## 5. OFFLINE / NETWORK ERROR HANDLING

### Issue 14: Race condition in AsyncStorage local updates

**Severity: Medium**
**File:** `src/services/activity-sync-service.ts`, lines 280-288

Classic read-modify-write race condition. Two concurrent calls to add entries for the same baby could cause one entry to be lost from local storage.

---

## Priority Summary

| # | Issue | Severity | Type |
|---|---|---|---|
| 1 | Diaper `updatedAt` mapped from `created_at` | **High** | Confirmed Bug |
| 2 | Tummy Time `updatedAt` mapped from `created_at` | **High** | Confirmed Bug |
| 3 | Pumping `updatedAt` always set to `new Date()` | **High** | Confirmed Bug |
| 4 | Growth `updatedAt` always set to `new Date()` | **High** | Confirmed Bug |
| 5 | Growth remote transform uses wrong column `head_circumference_cm` instead of `head_cm` | **High** | Confirmed Bug |
| 7 | Feeding `amount` vs DB `solid_amount` column name mismatch | **Medium** | Confirmed Bug |
| 6 | 4 tables missing `updated_at` column in DB schema | **Medium** | Schema Mismatch |
| 10 | Silent error swallowing in sync queue fire-and-forget | **Medium** | Error Handling |
| 11 | Local state always succeeds even when sync fails | **Medium** | Data Integrity |
| 14 | Race condition in AsyncStorage read-modify-write | **Medium** | Concurrency |
| 8 | `processedOperationIds` unbounded growth | **Medium** | Memory Leak |
| 12 | `pullChanges` is a no-op; conflict resolver is dead code | **Medium** | Dead Code |
| 13 | Quarantined operations lost on app restart | **Low** | Data Loss |
| 9 | `pendingSync` boolean can collapse multiple requests | **Low** | Edge Case |
