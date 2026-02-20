# Sync Pipeline Data Integrity: Field Mapping Bugs and Schema Gaps

## Symptom

Multiple data integrity issues discovered during a sync pipeline audit. The most visible symptoms:

- **Head circumference data from other caregivers silently lost** when received via Realtime
- **Solid food amount data never persisted** to or read from the database
- **Conflict resolution unreliable** for diapers, pumping, growth, and tummy time because `updatedAt` was never read correctly from the database
- **Concurrent local writes could lose data** due to a read-modify-write race in AsyncStorage
- **Sync errors completely silent** with no logging, making debugging impossible

## Root Causes

### 1. Wrong column names in transform functions

When data comes back from Supabase (either via fetch or Realtime), transform functions map snake_case DB columns to camelCase local fields. Several of these mappings were wrong:

**Diaper & TummyTime transforms** mapped `updatedAt` from `data.created_at` instead of `data.updated_at`:
```typescript
// Bug: used created_at for both fields
updatedAt: (data.created_at as string) || new Date().toISOString(),
```

**Pumping & Growth transforms** ignored the DB value entirely and used the current time:
```typescript
// Bug: always set to "now", making every fetch look like an update
updatedAt: new Date().toISOString(),
```

**Growth remote transform** used `data.head_circumference_cm` but the actual DB column is `head_cm`:
```typescript
// Bug: column doesn't exist in Supabase payload, always undefined
headCircumferenceCm: data.head_circumference_cm != null ? ...
```

**Feeding sync** used `amount` but the DB column is `solid_amount`:
```typescript
// Bug: PostgREST ignores unknown columns, data silently lost
amount: input.amount,  // should be solid_amount
```

### 2. Missing `updated_at` columns in the database

Four tables (`diapers`, `pumping_sessions`, `growth_measurements`, `tummy_time_sessions`) never had an `updated_at` column. Only `feedings`, `sleep_sessions`, and `babies` had it. This meant even with correct transform code, there was no DB value to read. The CREATE and UPDATE operations for these tables also didn't send `updated_at`.

### 3. AsyncStorage read-modify-write race condition

All six `updateLocal*` functions used this pattern:
```typescript
const data = await AsyncStorage.getItem(key);
const items = JSON.parse(data);
await AsyncStorage.setItem(key, JSON.stringify(updater(items)));
```

Two concurrent calls (e.g., rapid-fire logging of activities for the same baby) could interleave: both read the same state, both apply their change, second write overwrites the first.

### 4. Sync engine dead code and silent failures

- `pullChanges()` was called in every sync cycle but was a no-op returning `[]`
- `ConflictResolver` was instantiated but never used
- `engine.sync().catch(() => {})` swallowed all sync errors with zero logging
- Queue fallback to direct DB writes also had no logging on failure

### 5. Unbounded memory growth

`processedOperationIds` Set grew with every sync operation but was never pruned (only cleared on full data wipe).

## Fixes

### Transform fixes (activity-sync-service.ts, growth-context.tsx, feeding-context.tsx)

All four `updatedAt` mappings fixed to: `(data.updated_at as string) || (data.created_at as string) || new Date().toISOString()`. The `created_at` fallback handles rows that existed before the `updated_at` column was added.

Growth remote transform fixed: `head_circumference_cm` changed to `head_cm`.

Feeding column fixed: `amount` changed to `solid_amount` in CREATE data, UPDATE data, DB-to-local transform, remote transform, and guest migration sync.

### Migration 043: Add updated_at to four tables

```sql
ALTER TABLE diapers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pumping_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE growth_measurements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tummy_time_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows
UPDATE diapers SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE pumping_sessions SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE growth_measurements SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE tummy_time_sessions SET updated_at = created_at WHERE updated_at IS NULL;
```

All CREATE and UPDATE operations for these tables now include `updated_at` in the data sent to the database.

### AsyncStorage mutex (activity-sync-service.ts)

Added a per-key promise chain that serializes read-modify-write operations:

```typescript
const storageLocks = new Map<string, Promise<void>>();

async function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = storageLocks.get(key) ?? Promise.resolve();
  let resolve: () => void;
  const current = new Promise<void>((r) => { resolve = r; });
  storageLocks.set(key, current);
  try {
    await previous;
    return await fn();
  } finally {
    resolve!();
    if (storageLocks.get(key) === current) {
      storageLocks.delete(key);
    }
  }
}
```

All six `updateLocal*` functions wrapped with `withStorageLock`.

### Sync engine cleanup (sync-engine.ts)

- Removed unused `ConflictResolver` import and instantiation
- Removed no-op `pullChanges()` method and its call in the sync flow
- Added cap of 1000 entries on `processedOperationIds` with pruning

### Error logging (activity-sync-service.ts)

- `engine.sync().catch(() => {})` replaced with `console.warn` logging
- Queue-to-direct-write fallback now logs a warning

## Lessons Learned

1. **Transform functions are a high-risk area.** Every DB column rename or addition requires auditing ALL transform functions across the codebase (there are two per activity type: one in `activity-sync-service.ts` for fetches, one in the context file for Realtime). A column name mismatch causes silent data loss with no errors.

2. **Schema and code must stay in sync.** Four tables lacked `updated_at` for the entire life of the app. The code assumed it existed. Neither side threw an error. Supabase/PostgREST silently ignores unknown columns on write and returns `null` for missing columns on read.

3. **Never silence errors in async fire-and-forget paths.** `.catch(() => {})` on sync meant that persistent failures (expired auth, network issues) produced zero log output. Always at minimum `console.warn`.

4. **Dead code that looks active is worse than no code.** `pullChanges()` being called in every sync cycle gave the impression that pull-based conflict resolution was working. It wasn't.
