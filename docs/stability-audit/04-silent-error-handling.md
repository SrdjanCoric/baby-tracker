# Silent Error Handling Audit Report

## Executive Summary

The codebase contains **78 distinct catch blocks**. Of these, **7 are completely silent** (empty catch body), **~25 log to console but take no further action**, and the remainder either fall back gracefully or surface errors to the user. The app has an `ErrorBoundary` component but it is **not used anywhere in the app layout or screens**.

---

## 1. Completely Silent Error Swallowing

### 1.1 `engine.sync().catch(() => {})`
- **File:** `src/services/activity-sync-service.ts`, line 67
- **Severity:** **High**
- Masks sync failures. User's data may not reach the server with no indication.

### 1.2-1.3 SplashScreen calls
- **File:** `app/_layout.tsx`, lines 20, 365
- **Severity:** Low -- truly ignorable, best-effort calls.

### 1.4 Timer lock release during short-duration discard
- **Files:** `feeding-context.tsx` line 485, `sleep-context.tsx` line 517, `pumping-context.tsx` line 350
- **Severity:** Medium -- stuck lock could block other household members.

### 1.5 Widget cleanup calls
- **File:** `src/services/widget-data-service.ts`, lines 480, 490
- **Severity:** Low -- best-effort cleanup, documented intent.

---

## 2. Console-Only Error Handling (No User Feedback)

### Context Load Failures (with local fallback)
All activity contexts: try Supabase, fall back to local, log error. Valid offline-first pattern but user has no stale-data indicator.
- **Severity:** Low

### Context Load Failures (NO fallback)
When BOTH database AND local storage fail, `isLoading` is set to `false` with no error indication.
- **Files:** `feeding-context.tsx` line 399, `sleep-context.tsx` line 458, `pumping-context.tsx` line 291, `tummyTime-context.tsx` line 358
- **Severity:** **High** -- user sees empty state, thinks they have no data.

### Timer Lock Failures
Lock acquire/release failures logged but timer proceeds. Two caregivers could run conflicting timers.
- **Severity:** Medium

### Push Token Registration Failures
- **File:** `notification-context.tsx`, lines 429, 436
- **Severity:** **High** -- user won't receive push notifications with no indication.

### Google Sign-In Configuration Failure
- **File:** `auth-context.tsx`, line 155
- **Severity:** **High** -- button appears but fails on tap.

---

## 3. Error Boundary Assessment

- `ErrorBoundary` component exists at `src/components/error/ErrorBoundary.tsx`
- **NOT used anywhere in the app** -- not imported in `_layout.tsx` or any screen
- Unhandled errors crash the app entirely on both platforms
- The `ErrorBoundary.componentDidCatch` only logs in `__DEV__` mode -- no production telemetry

---

## 4. No Error Reporting Mechanism

- All error logging goes exclusively to `console.error/warn`
- In production builds, these logs are lost
- No crash reporting, error tracking, or telemetry service
- No way to diagnose user-reported issues

---

## 5. Priority Action Items

| Priority | Issue | Action |
|----------|-------|--------|
| **P0** | ErrorBoundary not used in app | Wrap root layout in `<ErrorBoundary>` |
| **P0** | Context load failures have no error state | Add `error` field to activity context states |
| **P1** | Push token save failures invisible | Track `pushTokenRegistered` state |
| **P1** | Google Sign-In config failure silent | Track availability, hide/disable button |
| **P1** | `engine.sync().catch(() => {})` | Log error, dispatch to sync state |
| **P1** | Direct DB write failure silent | Retry or notify user |
| **P2** | Timer lock failures | Add subtle warning for offline mode |
| **P2** | No error reporting for production | Implement lightweight error capture |
| **P2** | Notification init failure | Set error state for settings |

---

## 6. Implementation Checklist

- [x] **P0**: Wrap root layout in `<ErrorBoundary>` (`app/_layout.tsx`)
- [x] **P0**: Make ErrorBoundary log in production (remove `__DEV__` guard)
- [x] **P0**: Add `loadError` state to FeedingContext
- [x] **P0**: Add `loadError` state to SleepContext
- [x] **P0**: Add `loadError` state to PumpingContext
- [x] **P0**: Add `loadError` state to TummyTimeContext
- [x] **P1**: Track `pushTokenError` state in NotificationContext
- [x] **P1**: Track Google Sign-In availability in AuthContext
- [x] **P1**: Log `engine.sync()` failures (already done - verified)
- [x] **P1**: Surface `writeDirectlyToDatabase` failures
- [x] **P2**: Log timer lock release errors in short-duration discard (feeding, sleep, pumping)
- [x] **P2**: Add `initError` state to NotificationContext
