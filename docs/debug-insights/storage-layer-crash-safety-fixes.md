# Storage Layer Crash Safety Fixes

## Problem

The codebase had **22 unprotected `JSON.parse()` call sites** across production storage code. These were concentrated in:

- 6 core activity storage services (`feeding-storage.ts`, `sleep-storage.ts`, `diaper-storage.ts`, `pumping-storage.ts`, `growth-storage.ts`, `tummyTime-storage.ts`)
- `baby-storage.ts` and `baby-sync-service.ts`
- `activity-sync-service.ts` (6 `updateLocal*` functions + `getGuestActivities`)
- 4 `*-storage-sync.ts` files (active timer reads)

### Crash scenarios

Any of these conditions would crash the app:

| Condition | Result |
|-----------|--------|
| `AsyncStorage.getItem()` returns `null` | Already handled (returns `[]`) |
| Returns empty string `""` | **CRASH** — empty string is truthy, `JSON.parse("")` throws `SyntaxError` |
| Returns malformed JSON | **CRASH** — `JSON.parse` throws `SyntaxError` |
| Valid JSON but wrong shape (e.g., `"hello"`) | **Silent corruption** — type assertion provides no runtime check |

For guest/offline-only users, corrupted local storage means **permanent data loss** since there is no Supabase backup to recover from.

### Race condition

Every write in the `*-storage.ts` files followed a non-atomic read-modify-write pattern:

```
1. getItem(key)  → read current array
2. modify array  → push/splice/map
3. setItem(key)  → write back
```

Two concurrent calls (e.g., real-time sync event + user save, or multiple timers stopping at once) could interleave such that the second read happens before the first write completes, causing the first write's data to be silently lost.

## Solution

### 1. `src/utils/safe-json.ts` — Safe parsing utility

Created `safeParseArray<T>()` and `safeParseObject<T>()` that:
- Wrap `JSON.parse` in try/catch
- Validate the parsed result is the expected type (array vs object)
- Return safe defaults (`[]` or `null`) on any failure
- Log warnings with a context string for debugging

Also provides `safeGetArray<T>()` and `safeGetObject<T>()` convenience wrappers that combine `AsyncStorage.getItem` + safe parsing.

### 2. `src/utils/storage-lock.ts` — Per-key in-memory lock

Extracted the `withStorageLock()` function (previously only in `activity-sync-service.ts`) into a shared utility. This provides a promise-based per-key lock that serializes read-modify-write operations on the same storage key, preventing the interleaving race condition.

### 3. Applied to all 22 unprotected sites

Every raw `JSON.parse(data) as T` was replaced with the appropriate safe parser. Every add/update/delete method that does read-modify-write now runs inside `withStorageLock`.

## Files changed

| File | Changes |
|------|---------|
| `src/utils/safe-json.ts` | New — `safeParseArray`, `safeParseObject`, `safeGetArray`, `safeGetObject` |
| `src/utils/storage-lock.ts` | New — shared `withStorageLock` |
| `src/utils/safe-json.test.ts` | New — 27 tests covering all edge cases |
| `src/services/feeding-storage.ts` | Safe parse (2 sites) + locks on add/update/delete |
| `src/services/sleep-storage.ts` | Safe parse (4 sites) + locks on add/update/delete/dismissMilestone |
| `src/services/diaper-storage.ts` | Safe parse (1 site) + locks on add/update/delete |
| `src/services/pumping-storage.ts` | Safe parse (2 sites) + locks on add/update/delete |
| `src/services/growth-storage.ts` | Safe parse (1 site) + locks on add/update/delete |
| `src/services/tummyTime-storage.ts` | Safe parse (3 sites) + locks on add/update/delete/dismissMilestone |
| `src/services/baby-storage.ts` | Safe parse (1 site) + locks on add/update/delete |
| `src/services/baby-sync-service.ts` | Safe parse (2 sites) |
| `src/services/activity-sync-service.ts` | Safe parse (7 sites) + imports shared lock |
| `src/services/feeding-storage-sync.ts` | Safe parse (1 timer read) |
| `src/services/sleep-storage-sync.ts` | Safe parse (1 timer read) |
| `src/services/pumping-storage-sync.ts` | Safe parse (1 timer read) |
| `src/services/tummyTime-storage-sync.ts` | Safe parse (1 timer read) |

## Key design decisions

- **Graceful degradation over crashes**: corrupted data returns empty arrays/null instead of crashing. For authenticated users, the next sync will repopulate from Supabase. For guest users, an empty state is recoverable (they can re-enter data) while a crash loop is not.
- **Context strings in warnings**: every `safeParseArray`/`safeParseObject` call includes a context string (e.g., `"getAllFeedings"`, `"getActiveTimer:sleep"`) so corrupted-data warnings in logs can be traced back to the exact call site.
- **Shared lock**: the `withStorageLock` was already battle-tested in `activity-sync-service.ts`. Extracting it to a shared utility means the `*-storage.ts` files (used in guest mode) get the same protection without duplicating logic.
