# Storage Layer Crash Safety Audit Report

## Executive Summary

The codebase has **32 `JSON.parse()` call sites** across production code. Of these, **22 are unprotected** (no try/catch), concentrated in the six core activity storage services and the activity-sync service. All activity data is recoverable from Supabase for authenticated users, but **guest/offline-only data is unrecoverable** if local storage corrupts.

---

## 1. Complete Catalog of `JSON.parse()` Call Sites

### UNPROTECTED (No try/catch) -- 22 sites

| # | File | Line | Risk |
|---|------|------|------|
| 1 | `src/services/feeding-storage.ts` | 95 | **Critical** |
| 2 | `src/services/feeding-storage.ts` | 209 | **Critical** |
| 3 | `src/services/sleep-storage.ts` | 101 | **Critical** |
| 4 | `src/services/sleep-storage.ts` | 186 | **Critical** |
| 5 | `src/services/sleep-storage.ts` | 234 | Medium |
| 6 | `src/services/sleep-storage.ts` | 248 | Medium |
| 7 | `src/services/diaper-storage.ts` | 66 | **Critical** |
| 8 | `src/services/pumping-storage.ts` | 77 | **Critical** |
| 9 | `src/services/pumping-storage.ts` | 169 | **Critical** |
| 10 | `src/services/growth-storage.ts` | 51 | **Critical** |
| 11 | `src/services/tummyTime-storage.ts` | 90 | **Critical** |
| 12 | `src/services/tummyTime-storage.ts` | 173 | **Critical** |
| 13 | `src/services/tummyTime-storage.ts` | 221 | Medium |
| 14 | `src/services/baby-storage.ts` | 55 | **Critical** |
| 15 | `src/services/baby-sync-service.ts` | 179 | **Critical** |
| 16 | `src/services/baby-sync-service.ts` | 205 | High |
| 17 | `src/services/activity-sync-service.ts` | 286 | **Critical** |
| 18 | `src/services/activity-sync-service.ts` | 424 | **Critical** |
| 19 | `src/services/activity-sync-service.ts` | 568 | **Critical** |
| 20 | `src/services/activity-sync-service.ts` | 713 | **Critical** |
| 21 | `src/services/activity-sync-service.ts` | 855 | **Critical** |
| 22 | `src/services/activity-sync-service.ts` | 992 | **Critical** |

Plus additional sites in `*-storage-sync.ts` files (4 sites for active timer reads).

### PROTECTED (Has try/catch) -- 10 sites

| # | File | Quality |
|---|------|---------|
| 1 | `notification-storage.ts` | **Good** -- try/catch + validation + fallback to defaults |
| 2 | `dashboard-config-storage.ts` | **Good** -- try/catch + validation + fallback to defaults |
| 3 | `onboarding-storage.ts` | **Good** -- try/catch + validation + fallback to defaults |
| 4-7 | `widget-data-service.ts` (4 sites) | **Good** -- try/catch, returns null on error |
| 8 | `sync/sync-queue.ts` | **Excellent** -- try/catch + version check + array validation + corrupt data cleanup |

---

## 2. Failure Mode Analysis

### What happens with corrupted data:

| Condition | Result |
|-----------|--------|
| `AsyncStorage.getItem()` returns `null` | Handled correctly -- returns `[]` |
| Returns empty string `""` | **CRASH** -- empty string is truthy, `JSON.parse("")` throws `SyntaxError` |
| Returns malformed JSON | **CRASH** -- `JSON.parse` throws `SyntaxError` |
| Valid JSON but wrong shape (e.g., `"hello"`) | **Silent corruption** -- type assertion provides no runtime check |
| Valid JSON array with missing fields | **Silent corruption** -- missing fields become `undefined` |

---

## 3. Concurrent Access / Race Condition

Every write follows a non-atomic read-modify-write pattern:

```
1. getItem(key)  --> read current array
2. modify array  --> push/splice/map
3. setItem(key)  --> write back
```

Two concurrent calls can cause data loss when the second read happens before the first write.

**Where this happens:**
- Real-time sync events triggering local writes while user saves simultaneously
- Multiple timers stopping at once
- Widget stop + app foreground

**Severity:** Medium-High for authenticated users (Supabase has authoritative copy), **Critical** for guest users.

---

## 4. Data Recovery Analysis

### Recoverable (Authenticated Users)

All 6 activity types + baby profiles: full recovery via `fetch*FromDatabase()` which overwrites local with remote.

### UNRECOVERABLE (Guest/Offline Users)

| Data Type | Impact |
|-----------|--------|
| All activity data | **Critical** -- permanently lost |
| Baby profiles | **Critical** -- permanently lost |
| Active timer state | High -- timer lost but no data loss |

---

## 5. Recommended Approach

1. **Create shared `safe-json.ts` utility** with `safeParseArray<T>()` and `safeParseObject<T>()`
2. **Create `atomic-storage.ts` utility** with per-key in-memory lock for read-modify-write operations
3. **Prioritize** the 6 `getAll*` methods and 6 `updateLocal*` methods first (12 sites)
4. **Model after** existing good patterns: `notification-storage.ts`, `sync-queue.ts`
