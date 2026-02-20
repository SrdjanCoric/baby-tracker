# Test Coverage Gap Analysis Report

## Current State

74 test files, 1844 tests, all passing. Strong coverage of utility functions, validators, local storage services, sync queue/conflict resolver/real-time sync, and security concerns.

---

## 1. Critical Untested Files

| Source File | Lines | Risk Level |
|---|---|---|
| `src/services/activity-sync-service.ts` | 1272 | **CRITICAL** |
| `src/services/active-timer-service.ts` | 209 | **CRITICAL** |
| `src/services/notification-service.ts` | 213 | **HIGH** |
| `src/services/push-token-service.ts` | 236 | **HIGH** |
| `src/services/baby-sync-service.ts` | 253 | **HIGH** |
| All activity context reducers | ~500 each | **HIGH** |
| `src/contexts/active-timers-context.tsx` | ~250 | **HIGH** |

---

## 2. Quality Concerns in Existing Tests

1. **`sync-context.test.ts`** -- Re-implements the reducer locally instead of importing it. Tests validate a copy, not production code.

2. **`timer-sync.edge-case.test.ts`** -- Tests are trivial assertions on object shapes created within the test itself. Zero regression-prevention value.

---

## 3. Test Infrastructure Assessment

**Available mocks:** AsyncStorage (excellent), NetInfo (good), PowerSync (good)

**Missing for sync service testing:**
- Reusable Supabase mock factory
- `expo-crypto` mock for UUID generation
- `getSyncEngine()` mock

---

## 4. Top 10 Highest-Value Test Suites to Add

### Priority 1: `activity-sync-service.ts`
Test transform functions, CRUD operations, guest migration, field mapping correctness (catches the confirmed `updatedAt` bugs).

### Priority 2: Feeding Context Reducer
Timer state transitions, REMOTE_* actions, side suggestion logic.

### Priority 3: `active-timer-service.ts`
Lock acquire/release, contention, error cases (PGRST116 handling).

### Priority 4: `baby-sync-service.ts`
Guest-to-authenticated migration, ID remapping, cascade effects.

### Priority 5: Active Timers Context Reducer
ADD_LOCK dedup, REMOVE_LOCK matching, isLockedByOther logic.

### Priority 6: `notification-service.ts`
Module availability, iOS 64-notification limit, permission handling.

### Priority 7: `push-token-service.ts`
Upsert behavior, conflict resolution, auth-gated operations.

### Priority 8: Widget data pure functions
Data transformation without native module mocking.

### Priority 9: `notification-storage.ts`
Validation, deep merge with defaults, backward compatibility.

### Priority 10: Fix `sync-context.test.ts`
Import real reducer instead of re-implementing locally.

---

## 5. Recommended Order of Work

1. Fix `sync-context.test.ts` to import real reducer (quick win, high value)
2. Create shared Supabase mock utility
3. Test `activity-sync-service.ts` (highest LOC, most data transformation bugs)
4. Test feeding context reducer (most complex state machine)
5. Test `active-timer-service.ts` (multi-caregiver race conditions)
6. Delete or rewrite `timer-sync.edge-case.test.ts` (provides false confidence)
