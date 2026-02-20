# React Context Race Conditions and Memory Leak Audit Report

## 1. Context Initialization Sequence Analysis

### Provider Nesting Order (from `app/_layout.tsx`, lines 373-429)

```
ThemeProvider
  LanguageProvider
    AuthProvider
      DeepLinkHandler
        AuthGuard
          SyncProvider
            HouseholdProvider
              SyncAuthSetup (bridge: Auth -> Sync)
                UnitProvider
                  TimeFormatProvider
                    BabyProvider
                      FeedingProvider
                        SleepProvider
                          DiaperProvider
                            PumpingProvider
                              GrowthProvider
                                TummyTimeProvider
                                  ActiveTimersProvider
                                    WidgetProvider
                                      NotificationProvider
                                        NotificationAuthSetup
```

### Race Condition: Auth -> Household -> Baby Initialization Gap

**Severity: MEDIUM**

When `onAuthStateChange` fires, the auth context immediately sets the user with `householdId: null` (line 227) and then fetches the profile in the background (lines 233-239). This creates a temporal gap:

1. `AuthProvider` sets `user` with `householdId: null`
2. `HouseholdProvider` sees null and dispatches `RESET`
3. `BabyProvider` loads from local-only storage (wrong path for authenticated users)
4. Background profile fetch completes, updates `user.householdId`
5. Full cascade of re-renders and double data fetches

**Result:** Double data fetches on every login/app start.

### Race Condition: SyncAuthSetup Timing

**Severity: MEDIUM**

`SyncAuthSetup` uses `user.id` as fallback household ID when `householdId` is null. This means Realtime is briefly subscribed to the wrong channel until the real `householdId` arrives.

### Race Condition: Activity Contexts Loading Before Baby Selection

**Severity: LOW**

Each activity context depends on `selectedBaby`. There's a render cycle where `babies` is populated but `selectedBaby` is still `null`, causing empty loads followed by re-loads.

---

## 2. useEffect Cleanup Audit

### Realtime Subscription Cleanup

**Overall Assessment: GOOD with one exception**

All activity contexts properly return unsubscribe functions. All cleanup is correct.

**Exception -- Household Context Subscription Dependency Causes Churn:**

**Severity: LOW**

The dependency array includes `state.household?.inviteCode`, causing unnecessary unsubscribe/resubscribe cycles whenever the invite code changes.

### SyncProvider & AuthProvider Cleanup

**Properly handled** in both cases.

---

## 3. Stale Closures in useCallback

### Timer Callbacks: Stale `state.activeTimer` Captures

**Severity: HIGH**

`stopBreastfeeding`, `changeSide`, `pauseBreastfeeding`, `resumeBreastfeeding` all capture `state.activeTimer` in their closures. When called from stale closures (e.g., widget handlers), accumulated seconds may be miscounted.

Affected files:
- `feeding-context.tsx` (lines 449-642)
- `sleep-context.tsx` (lines 499-649)
- `pumping-context.tsx` (lines 332-483)
- `tummyTime-context.tsx` (lines 398-505)

### Widget Handler Deep Callback Chain

**Severity: MEDIUM**

`processPendingStop` depends on all timer stop callbacks. AppState listener is torn down and recreated on every timer state change -- wasteful but not a correctness issue.

---

## 4. State Updates After Unmount

### Missing isMountedRef Guards

**Severity: MEDIUM**

**No activity context uses `isMountedRef` guards.** All load functions perform multiple async operations and dispatch state updates without checking if still mounted:
- `feeding-context.tsx` `loadFeedings`
- `sleep-context.tsx` `loadSleeps`
- `pumping-context.tsx` `loadPumpings`
- `tummyTime-context.tsx` `loadTummyTimes`
- `baby-context.tsx` `loadBabies`
- `household-context.tsx` `loadHousehold`

Low practical risk since these providers only unmount on full app teardown, but fragile if provider structure changes.

### Auth Context Background Profile Fetch

**Severity: MEDIUM**

`fetchUserProfile().then(...)` calls `setUser` without mount guard (`auth-context.tsx`, lines 233-239).

---

## 5. pendingBabyIdsRef Deduplication Mechanism

**Severity: LOW**

The 1-second timeout is heuristic but backed by the `REMOTE_INSERT` reducer's `exists` check by ID. The design is resilient despite the arbitrary timeout.

---

## 6. Widget Context Dependency Array and Performance Impact

**Severity: MEDIUM-HIGH**

`buildWidgetData` has **18 dependencies**. Every activity change triggers full widget data recomputation. Mitigated by 500ms debounce + hash check, but the callback recreation cascade is wasteful.

Many dependencies are callback functions (`getLastFeeding`, `getTodaysCounts`, etc.) whose identities change whenever their own dependencies change, creating a cascade effect.

---

## Summary Table

| Context / Area | Issue | Severity |
|---|---|---|
| Auth -> Baby init cascade | Double data fetch on login due to `householdId: null` intermediate state | MEDIUM |
| SyncAuthSetup | Temporary subscription to wrong household channel | MEDIUM |
| All activity contexts | Missing `isMountedRef` guards on async load functions | MEDIUM |
| Auth context | Background profile fetch without mount guard | MEDIUM |
| Timer callbacks | Stale closures over `state.activeTimer` in stop/pause/resume | **HIGH** |
| Widget context | 18-dependency `buildWidgetData` causes excessive re-computation cascade | MEDIUM-HIGH |
| Household subscriptions | `inviteCode` in effect deps causes subscription churn | LOW |
| pendingBabyIdsRef | 1-second timeout heuristic but backed by reducer dedup | LOW |
