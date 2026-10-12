# Test audit

Date: 2026-10-08. Yardstick: the usage checklist in this folder. Branch: `feature/fix-timer-permission-denied`.

Six area reviews read every test. Three "break-it" runs then planted real bugs in the app code to see which tests notice.

## 1. Headline

- **61 bugs planted, 37 caught properly, 4 caught only weakly, 20 not caught at all.** That is about 6 in 10.
- **The weak spot is anything with two of something:** two babies, two phones, two households. Single-device logic (sleep math, sync merge, retry queue) is well guarded.
- **No test runs two babies' timers side by side.** No test checks that a stop on one phone clears the timer on the other phones, the widget or the Watch. No test checks who receives a push.
- **32 test spots in 15 files lock in known bugs.** They will turn red when those bugs are fixed. That is expected. Rewrite them with each fix.
- **About 940 test cases are waste.** Most test code that no screen uses. About 10 test files never run before deploy at all.

Area totals (summed across the six reviews, so a file can show up in more than one area or bucket):

| Bucket | Files |
|---|---|
| KEEPER | 226 |
| WEAK | 93 |
| WASTE | 150 |
| HARMFUL | 15 distinct files (32 spots) |
| MISSING usage lines | 54 fully missing, about 30 more only partly covered |

## 2. How we graded

Each test (or tight group of cases) got one grade:

- **KEEPER**: it would fail if a behavior in the usage docs broke. It runs the real code, not a stand-in.
- **WEAK**: it runs real code, but so much is faked that a real bug would slip past. Or it repeats another test.
- **WASTE**: it only checks that a fake was called, checks a constant, tests a dead screen or unused code, or never runs before deploy.
- **HARMFUL**: it checks behavior that a usage line marks [Bug]. It locks in the wrong behavior.
- **MISSING**: a usage line that no test would catch if it broke.

**Break-it checks.** A "mutation" (a small planted bug, the kind a refactor might cause) went into the app code, one at a time. Then the full unit and component suites ran. Verdicts:

- **CAUGHT**: a test failed for the right reason.
- **CAUGHT-WEAK**: only a test that checks the exact arguments passed to a fake failed.
- **UNCAUGHT**: nothing failed.

Three runs: timers (18 bugs), cross-device and sync (17), statistics and timeline (26). Total **61**.

Where a report said "covered" but a planted bug on that same line went uncaught, the break-it result wins. Those lines stay unticked in the usage docs.

## 3. Break-it results

| Area | Planted | Caught | Caught-weak | Uncaught |
|---|---|---|---|---|
| Timers and multiple babies | 18 | 12 | 2 | 4 (2 distinct gaps) |
| Cross-device and sync | 17 | 8 (1 of them on dead code) | 2 | 7 |
| Statistics and timeline | 26 | 17 | 0 | 9 |
| **Total** | **61** | **37** | **4** | **20** |

### Every uncaught bug

Timers:

1. `src/contexts/pumping-context.tsx:520` — after someone else stops a pumping timer, the starter's phone keeps the old timer in storage. It may come back on reopen.
2. `src/contexts/active-timers-context.tsx:255` — live timer updates are no longer filtered by baby. (Hidden by the next guard.)
3. `src/contexts/active-timers-context.tsx:300` — the lock lookup ignores the baby. (Hidden by the guard above.)
4. Both of the above together — baby B's timer shows on baby A's card, and A's Stop button stops B's timer.

Cross-device and sync:

5. `supabase/functions/send-widget-push/handler.ts:198` — household filter removed. Every user in the database gets widget and Live Activity pushes.
6. `supabase/functions/send-activity-notification/index.ts:210` — the person who logged an entry is notified too.
7. `supabase/functions/send-activity-notification/index.ts:208` — household filter removed. Every household gets "X logged a feeding".
8. `src/services/active-timer-service.ts:496` — a release without a lock id deletes every lock of that type. Only the database's row rules ("RLS", row-level security) still stop it from crossing households.
9. `src/services/active-timer-service.ts:545` — the lock lookup is no longer limited to the baby.
10. `src/contexts/active-timers-context.tsx:283-286` — a live "timer deleted" event no longer removes the lock. The other caregiver's phone keeps showing a stopped timer.
11. `src/contexts/widget-context.tsx:382` — a remote stop no longer rebuilds the widget and Watch data. The Watch keeps showing the stopped timer.

Statistics and timeline:

12. `app/(tabs)/timeline.tsx:376` — an overnight sleep is grouped under the day it ended.
13. `app/(tabs)/timeline.tsx:357` — the "+1" on a sleep crossing midnight is dropped.
14. `src/components/stats/feeding/FeedingWeekView.tsx:89` — the 7-day feeding average divides by the wrong number of days.
15. `src/contexts/sleep-context.tsx:2055` — Home's "today's sleep" starts at midnight, not the day-start hour.
16. `src/contexts/sleep-context.tsx:2069` — Home counts a night that began yesterday in full.
17. `src/contexts/widget-context.tsx:158` — the widget picks today's sleeps by end time.
18. `src/utils/sleep-patterns.ts:574` — the longest stretch uses raw entries, not merged ones.
19. `app/(tabs)/index.tsx:805` — the Home diaper badge counts wet only, not wet plus mixed.
20. `src/utils/timeline.ts:74` — the Timeline summary picks feeds by end time.

Caught only weakly (4): shared pumping timer key and shared sleep timer key (`pumping-storage.ts:65`, `sleep-storage.ts:83`), the per-baby live-update filter (`real-time-sync.ts:112`), and the Live Activity end filter (`send-widget-push/handler.ts:155`). In each case only a "was the fake called with these exact arguments" test failed.

## 4. Proven keepers

Test files that caught planted bugs (number of bugs caught):

| File | Caught |
|---|---|
| `src/utils/sleep-patterns.test.ts` | 11 |
| `src/__tests__/external-timer-stop-providers.integration.test.tsx` | 7 |
| `src/components/sleep-patterns/SummaryView.component.test.tsx` | 4 |
| `src/services/sync/sync-engine-crdt.test.ts` | 3 |
| `src/components/stats/sleep/SleepStatsContainer.component.test.tsx` | 3 |
| `src/utils/statistics.test.ts` | 3 |
| `src/services/sync/sync-lossless.test.ts` | 2 |
| `src/services/sync/tombstone.test.ts` | 2 |
| `src/utils/timeline.test.ts` | 2 |
| `app/(tabs)/timeline.component.test.tsx` | 2 |
| `src/utils/feeding-sessions.test.ts` | 2 |
| `app/pumping/index.component.test.tsx`, `app/sleep/index.component.test.tsx` | 2 each |
| CRDT suite: `crdt-merge`, `crdt-vectors`, `crdt-sync`, `crdt-simulation`, `crdt-sync-simulation`, `baby-sync-service` (field-by-field merge, includes 2–3 simulated devices) | 1 |
| `src/components/DashboardCard.component.test.tsx` | 1 |
| `src/__tests__/recorded-timer-duration-consumers.integration.test.tsx` | 1 |
| The 4 `src/services/timer-adapters/*-timer-adapter.test.ts` files | 1 |
| `src/utils/timer-start-bounds.test.ts`, `app/feeding/index.component.test.tsx`, `app/tummyTime/index.component.test.tsx` | 1 each |
| `src/utils/ongoing-sleep.test.ts`, `src/utils/statistics-ranges.test.ts`, `src/components/timeline/DailySummaryCard.component.test.tsx` | 1 each |
| `src/services/activity-sync-lossless.test.ts`, `src/__tests__/activity-acknowledgement.integration.test.tsx`, `src/contexts/activity-reducers.component.test.tsx`, `src/contexts/baby-context-household-refresh.component.test.tsx`, `src/__tests__/security/auth-token.security.test.ts` | 1 each |
| `src/services/timer-stop-coordinator.test.ts` (only guard for "a Watch stop never hits another baby") | 1 |
| `src/hooks/useWidgetStopHandler.component.test.tsx`, `src/hooks/useWatchMessageHandler.component.test.tsx` (one fake-based test each) | 1 each |
| Side effects only: `src/utils/trends.test.ts`, `WeeklyChartAxes.component.test.tsx`, `SleepPredictionCard.component.test.tsx` | 1 each |
| Weak catches: `pumping-storage.test.ts`, `sleep-storage.test.ts`, `real-time-sync.test.ts`, `widget-push-handler.test.ts` | 1 each |

Note: `real-time-sync.test.ts` and `sync-channel-isolation.security.test.ts` also caught a planted bug in the "ignore my own echo" check. That check is **dead code**: nothing ever writes the `_device_id` field it reads. Echo safety really comes from the merge being repeat-safe.

Note: the stop-command test in `timer-stop-coordinator.test.ts` runs `processPendingTimerStop`, which has no caller in the app. The matcher it uses (`isPendingStopForTimer`) is live.

## 5. Never failed, though they import the changed code

These stayed green on every planted bug in every run:

- `src/services/timer-lifecycle.test.ts` (1,205 lines) — green even when the shared duration math and the conflict notice broke.
- `src/services/active-timer-service.test.ts` — the baby limit on release and lookup is not pinned.
- `src/contexts/active-timers-realtime.component.test.tsx` — uses one baby only; its "timer deleted" test checks a token refresh, not that the lock left.
- `src/contexts/widget-context.component.test.tsx`
- `src/__tests__/activity-provider-baby-binding.integration.test.tsx`
- `src/__tests__/household-timer-stop-lock-clearing.integration.test.tsx` — covers the stopper's card, not the other member's phone.
- `src/__tests__/watch-realtime-baby-selection.integration.test.tsx`
- `src/__tests__/live-activity-end-push.test.ts`, `src/__tests__/live-activity-start-push.test.ts`
- `src/__tests__/activity-notification-push.test.ts` — runs the real handler, but its fake database ignores filters, so recipients are never checked.
- `src/services/sync/sync-queue.test.ts`, `src/services/sync/sync-engine.test.ts`
- `app/(tabs)/index.component.test.tsx` — Home. Sleep totals are fixed fake numbers, so the real Home total never runs.
- `app/(tabs)/sleep-patterns.component.test.tsx` — dead screen.
- `src/__tests__/sleep-data-loss.test.ts`
- `src/__tests__/sleep-flow.integration.test.tsx` — tests its own copy of the Home total, not the app's.
- `src/utils/statistics-local-dates.test.ts`, `src/utils/report-aggregator.test.ts`, `src/utils/tip-selector.component.test.tsx`
- `app/_layout.component.test.tsx`

## 6. HARMFUL tests

Grouped by the fix that will need to rewrite them.

**Fix: end Live Activities by id or by baby, never by type** (timers: "one per type" and "stop fallback" [Bug] lines)

- `src/services/timer-lifecycle.test.ts:269` — expects an end-by-type on the start-time edit path.
- `src/services/timer-lifecycle.test.ts:783` — expects an end-by-type when restore clears a timer. Rest of the case is good.
- `src/__tests__/external-timer-stop-providers.integration.test.tsx:677-689` — expects an end-by-type for all 4 types when the starter's timer vanishes. Rest of the case (from `:623`) is good.
- `src/__tests__/external-timer-stop-providers.integration.test.tsx:1752` — "falls back by type when native cleanup cannot find the persisted Live Activity id".

**Fix: widget can pause someone else's timer** (timers: new [Bug] line, against the [Decided] "any member can pause … from widget")

- `scripts/swift/widget-snapshot-tests.swift:152-153` — requires no pause control for a remote timer.
- `scripts/test-active-timer-edge.mjs:215-220` — expects a member's pause to be refused (403). Already wrong since migration 066. Not run before deploy, so nobody noticed.

**Fix: server Live Activity uses the same pause math as the saved entry** (timers: new [Bug] line)

- `src/__tests__/live-activity-end-push.test.ts:81-94` — "subtracts completed pauses from final duration".

**Fix: sign-out keeps local data** (accounts: sign-out [Bug] line)

- `src/contexts/auth-context.component.test.tsx:574` (assert `:605`) — expects sign-out to delete the account's babies, entries, sync cursor and queue. Keep the "guest data kept" half.
- `src/contexts/auth-context.component.test.tsx:489` (assert `:498`) — expects import bookkeeping keys deleted.
- `e2e/flows/auth/sign-out.yaml` — expects the user to stay in the app as a guest, not see the sign-in screen.

**Fix: the saved nap/night label wins** (stats: "recalculate the label from the clock" [Bug] line)

- `src/utils/sleep-patterns.test.ts:107`, `:124`, `:151`, `:1431` — a saved night's tail after day start becomes "nap".
- `src/utils/sleep-patterns.test.ts:371` (Day colors), `:432` (Week colors) — a saved nap at 20:00 must show as night.
- `src/utils/sleep-patterns.test.ts:954` — two saved naps count as a night in Summary.
- `src/utils/sleep-patterns.test.ts:1044` — a saved night at 08:30 counts as a nap.
- `src/components/sleep-patterns/SummaryView.component.test.tsx:146`, `:180`, `:191`, `:259` — every fixture sleep is saved as "nap", yet evening ones are expected as bedtime.
- `src/utils/timeline.test.ts:174` and `src/components/timeline/DailySummaryCard.component.test.tsx:83` — a saved nap at 18:00 counts as a night.
- Borderline: `src/utils/ongoing-sleep.test.ts:71` and `SleepStatsContainer.component.test.tsx:291` classify a running sleep by the clock and ignore the type the timer chose. HARMFUL if that counts as the "saved label".

**Fix: tummy comparison loads the previous 7 full days** (stats [Bug] line)

- `src/components/stats/StatisticsActivityRange.component.test.tsx:65-74` — expects the load to start on day −6, not −7.

**Fix: PDF merges overlapping sleeps** (stats: "Home, widget and PDF don't merge" [Bug] line)

- `src/utils/report-aggregator.test.ts:345`, `:363`, `:383` — identical sleeps expected as raw sums.

**Fix: "mixed" bottle type** (logging and import [Bug] lines)

- `src/services/import/huckleberry-reader.test.ts:78-86`, `:209-210` — Huckleberry "Mixed" must have no type.
- `src/services/import/nara-reader.test.ts:139-152` and `:153-167` (3 cases) — Nara total-only bottles stay untyped.

**Not tied to a usage line (security, minor):** `src/__tests__/widget-push-handler.test.ts:160` locks in that any signed-in user can trigger widget pushes for any baby. Hand to the security review.

**Not harmful (settled):** about 20 tests assert that a resumed pause counts toward the duration. The timers doc now says exactly that, so they are correct.

## 7. WASTE to delete

Case counts are approximate.

**Whole files testing code no screen uses (~345 cases)**

- `src/components/`: `FeedingTypeMenu` (12), `InsightCard` (11), `OfflineBanner` (5), `SimpleBarChart` (8), `SyncStatusIndicator` (19), `TrendIndicator` (13), `Card` (12), `QuickActionButton` (25), `TimerDisplay` (27), `TodaySummary` (10), `error/ErrorBoundary` (8), `error/ErrorFallback` (12) — all `*.component.test.tsx`
- `src/hooks/useAccessibility.component.test.tsx` (16), `src/utils/accessibility.test.ts` (51)
- `src/utils/error-handler.test.ts` (40), `src/utils/insights.test.ts` (17)
- `src/validators/diaper.test.ts` (24) — its "no stool color on a wet diaper" rule is never enforced in the app
- `src/__tests__/security/data-migration.security.test.ts` (13)
- `src/contexts/theme-context.test.ts` (13)
- `app/settings/about.component.test.tsx` (8) — nothing navigates to About
- `app/(tabs)/sleep-patterns.component.test.tsx` (1) — dead screen

**Unused functions inside live files (~330 cases)**

- Validators: `feeding.test.ts` (~36), `sleep.test.ts` (~17), `pumping.test.ts` (~12), `tummyTime.test.ts` (~28), `auth.test.ts` (~55, only `validateEmail` is used), `baby.test.ts` (6)
- `src/utils/statistics.test.ts` (17: `calculateSleepStats`, `calculateWeeklyBreakdown`, `calculateExtendedSleepStats`, `calculateExtendedDiaperStats`)
- `src/utils/growth.test.ts` (18), `volume.test.ts` (8), `trends.test.ts` (10), `tummyTimeGoals.test.ts` (14), `sleepGoals.test.ts` and `__tests__/sleepGoals.test.ts` (`getNapsForAge` 6 + constants 5, plus a duplicated 7-case block), `day-night-boundary.test.ts` (8), `time.test.ts` (3), `growth-helpers.test.ts` (3), `theme.test.ts` (4)
- `src/utils/notification-scheduler.test.ts` (~13), `notification-sanitizer.test.ts` (~8), `notification-routes.test.ts` (9, nothing handles notification taps)
- `src/utils/sanitize.test.ts` (11: `sanitizeCSVValue`; the CSV export has its own guard in `csv-generator.ts`, which is tested)
- `src/utils/inviteCode.test.ts` (7), `src/__tests__/security/invite-code-security.test.ts` (~10), `caregiver-authorization.security.test.ts` (9), `audit-logging.security.test.ts` (2)
- `src/services/caregiver-service.test.ts` (7), `household-service.test.ts` (2), `account-deletion.test.ts` (5), `account-deletion-service.test.ts` (~4)
- `src/services/timer-stop-coordinator.test.ts` (5: `processPendingTimerStop`), `widget-data-service.test.ts` (3)
- `src/constants/activities.test.ts` (~15)
- `src/services/duplicate-detection.test.ts` (~16: diaper and growth checks no screen calls; decide first, see section 13)
- `src/services/sync/real-time-sync.test.ts:319`, `:543-597` and `sync-channel-isolation.security.test.ts:135-180` (8: the dead echo filter)
- `sync-queue` dead helpers (`optimize`, `dequeue`, `peek`, stale) and `storage-limits.edge-case.test.ts:107-160` (2)

**Tests of fakes written inside the test file (~90 cases)**

- `src/__tests__/feeding-flow.integration.test.tsx` (5), `sleep-flow.integration.test.tsx` (5), `diaper-flow.integration.test.tsx` (5), `theme-flow.integration.test.tsx` (7), `caregiver-flow.integration.test.tsx` (9), `sync-flow.integration.test.tsx`
- `src/contexts/household-context.test.ts` (13), `src/contexts/sync-context.test.ts` (11)
- `src/__tests__/edge-cases/timer-sync.edge-case.test.ts` (4), `service-unavailability.edge-case.test.ts:88-128` (4), sync `edge-cases.test.ts`
- `src/__tests__/security/household-isolation.security.test.ts` (9)

**Fake-only or render-only checks (~150 cases)**

- `DashboardCard` (17), `TimelineItem` (14), `SleepPredictionCard` (17), `BabyHeader` (10), `BabySelector` (10), `Input` (11 + 1 dark), `Button` (5 + 2 dark)
- `app/settings/theme.component.test.tsx` (6), `units.component.test.tsx` (6), `index.component.test.tsx` (1), `join-household.component.test.tsx:110-128` (4), `app/(tabs)/index.component.test.tsx` (6)
- `useTimerAlertIntegration.component.test.tsx` thresholds (6), `notification-context.component.test.tsx:632-780` and mock-call cases, `auth-context.component.test.tsx:183/:844/:868` (3), `auth-token.security.test.ts:58/:206/:213` (3), `active-timer-service.test.ts:528` (1), `sleep-timer-adapter.test.ts:176` (1)
- Developer-only tools: `DevelopmentOnboardingTools.component.test.tsx` (7), `development-onboarding-tools.test.ts` (4), `development-onboarding-preview.test.ts` (2), `development-onboarding.test.ts` (1)
- i18n "key exists" files (7): feeding-clock-time, sleep-clock-time, import, new-baby-validation, non-sleep-overlap, store-review, morning-sleep. Replace with one parity test (section 10).

**Source-text pinning (~25 cases)**

- `src/__tests__/security/morning-classification-migration.security.test.ts` (3) — the SQL tests already cover it
- `src/__tests__/native/native-resume-real-start.test.ts` (3), `watch-morning-confirmation.test.ts` (1)
- `src/__tests__/native/widget-snapshot-wiring.test.ts` (11 of 13; keep line 23), `watch-summary-wiring.test.ts` (4 of 5; keep line 37)
- `scripts/package-scripts.test.mjs` (2) — pins script text word for word but misses orphan tests

**Cannot run before deploy (fix wiring or delete)**

- Delete: `src/__tests__/baby-selection-ui.test.tsx` (4), `e2e/suites/multi-user.yaml` (all 3 flows it calls are missing), `e2e/flows/debug-bottle.yaml`, `e2e/flows/auth/e2e-auto-login.yaml`, `e2e/helpers/auth.yaml`, `e2e/flows/household-timers/stop/sleep.yaml`
- Wire in, don't delete: see section 9.

## 8. WEAK tests worth upgrading

Only those guarding important behavior:

- `app/(tabs)/index.component.test.tsx:797`, `:817` — run the real Home sleep and tummy totals instead of fixed fake numbers.
- `src/contexts/active-timers-realtime.component.test.tsx:214` — after a remote "timer deleted", assert the lock is gone. Add a second baby.
- `src/__tests__/widget-push-handler.test.ts` and `src/__tests__/activity-notification-push.test.ts` — give the fake database real filters so recipients are checked. Also check the push text.
- `src/services/sync/real-time-sync.test.ts` filter tests — add `active_timers` to the live `real-time-sync.integration.test.ts`.
- `src/services/pumping-storage.test.ts`, `sleep-storage.test.ts` — turn the key-string checks into "two babies, two timers" behavior tests.
- `src/hooks/useWidgetStopHandler.component.test.tsx:459`, `useWatchMessageHandler.component.test.tsx:376` — the only other-baby guards; repeat them with real providers.
- `src/__tests__/native/watch-stop-command-order.test.ts` — pin `baby_id` in the Watch backup delete, or move it to a Swift test.
- `scripts/swift/widget-snapshot-tests.swift:155-195` — runs no code; call `routedStopURL` for real.
- `src/components/DashboardCard.component.test.tsx:206`, `:344` — Home card buttons only call fakes. Drive a real provider.
- `src/components/RunningTimerStartEditor.component.test.tsx` — the start-time rules are passed in from outside.
- `src/services/timer-stop-coordinator.test.ts` — every fixture is the old format; add timer-id mismatch cases.
- `src/contexts/widget-context.component.test.tsx` — every lock is `baby-1`; add another baby's lock.
- `src/services/widget-data-service.test.ts` — never checks the `selectedBabyId` key.
- `src/__tests__/security/widget-activity-snapshot.security.test.ts` — reads migration 061, but 070 redefines the function. Point it at the newest definition or move it to SQL.
- `app/feeding/index.component.test.tsx:600` — also assert nothing was saved.
- `app/sleep/index.component.test.tsx:411` — run the real `confirmMorningSleep`.
- `app/settings/join-household.component.test.tsx` — uses `babies: []`, so the delete warning never shows.
- `src/services/account-deletion-service.test.ts`, `caregiver-service.test.ts` — the real rules live in SQL; add SQL tests.
- `src/contexts/notification-context.component.test.tsx` — the scheduler is a hand-written copy.
- `src/services/pdf-service.test.ts` — asserts load order only, no report content.
- `src/services/sync/sync-queue.test.ts` backoff — every engine test fakes `delay()`, so a fixed delay passes.
- `src/components/stats/growth/GrowthStatsView.component.test.tsx:146` — percentile is faked.
- E2E timer flows (`activities/*-timer.yaml`) — add pause, the Home card and a saved-entry check. `edge-cases/concurrent-timers.yaml` never runs two timers at once; rename or fix.
- 11 `src/i18n/*-locales.test.ts` files — replace with one full parity test.

## 9. Not run before deploy

**Test files no deploy gate runs.** `check:code` is the gate; `check` adds SQL and live-Supabase tests.

| File or script | Problem | Do |
|---|---|---|
| `src/services/import/import-sync.test.ts` | `vitest.import.config.ts` is in no npm script | Add `test:import` to `check` |
| `scripts/native-strings-generator.test.mjs` | not in `test:ci` | Add |
| `e2e/scripts/household-runner.test.mjs` | not in `test:ci` | Add |
| `scripts/run-sql-vectors.test.mjs` | not in `test:ci` | Add or delete |
| `scripts/test-active-timer-edge.mjs` (`test:edge:timer`) | in no gate, and stale (`:215-220`) | Repair, then add to `check` |
| `test:sleep-summary` (New York time zone run) | in no gate; points at a dead screen test | Add to `check:code`, drop the dead test |
| `src/__tests__/baby-selection-ui.test.tsx` | name matches neither runner | Delete |

- No test checks that every `*.test.*` file is picked up by some runner. That is how these slipped in. Add one.
- SQL tests and `real-time-sync.integration.test.ts` run only in `check`. Fine, if deploy really runs `check` (see section 13).

**Flaky tests (passed alone, failed once under full parallel load)**

- `external-timer-stop-providers.integration.test.tsx` — "consumes a sub-minute feeding stop without creating an activity" and "… pumping stop …"
- `app/settings/import.component.test.tsx` — "rejects an empty file and one over 20,000 rows"
- `app/onboarding/owner/restore.component.test.tsx` — "offers Add a baby and Join a family only after verified empty" failed in the baseline run on `main`. Not seen on this branch. Check it.

**Environment setup needed**

- Without a `.env`, `src/__tests__/watch-realtime-baby-selection.integration.test.tsx` fails at import ("Missing Supabase environment variables"). Fix: set dummy `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the Jest setup.

**Never executed at all**

- The Watch app code (`targets/watch/index.swift`) is only type-checked. Its message handler, screen state and `stopTimer` never run.
- The widget's own Swift stop code never runs; only its source text is matched.

**Missing E2E flows (Maestro, the on-device test tool; no deploy gate runs it)**

- Two babies with timers (A→B→A).
- Two phones in one household without restarting the app between steps. The two-iPhone runner is sleep only, manual, and the current version has never recorded a pass.
- A second household in the seed data.
- Any Android device seeing a change made on another device.
- Sign-out landing on the sign-in screen (the current flow asserts the opposite).

## 10. Missing tests, ranked by user impact

1. **Two babies' timers side by side (A→B→A).** Start A, switch to B, start B, switch back. Both still run and can be stopped. Layer: integration, in the `external-timer-stop-providers` harness (it already runs the real timer code). Add a unit test: `syncObservedOwnedTimerLock` with another baby must not clear anything. Why: no test uses two babies; this fails today.
2. **A remote stop clears the timer on other phones, the widget and the Watch.** Feed a live "timer deleted" event into the real `ActiveTimersProvider` and `WidgetProvider`; assert the card, the widget data and the Watch data drop it. Layer: component. Why: uncaught bugs 10 and 11; it is the owner's "Android stop doesn't reach the Watch" bug.
3. **Two households, both running sleep; A stops through every path; B's timer survives.** Layer: SQL. Why: every delete ends there; uncaught bugs 8 and 9; it is the owner's "Watch stops every household" fear.
4. **Push recipients checked against a real database.** Widget push goes to the whole household including the starter; activity push skips the logger; nothing reaches another household. Layer: live-Supabase, or SQL plus an edge-function test whose fake honors filters. Why: uncaught bugs 5–7.
5. **Home and widget "today's sleep" match Statistics.** Move both totals into small pure functions, then feed one tricky fixture (overlap, crosses day start, running sleep) to every screen's total. Layer: unit. Why: uncaught bugs 15–17; Home's test uses fake numbers.
6. **Account deletion, leaving and removing a caregiver.** `delete_user_account`, `leave_household`, `remove_caregiver` with a two-member and a one-member household. Layer: SQL. Why: the rules live only in the database and have no test.
7. **Reminder recipients.** Wake-window reminders only to members who opted in; feeding reminders per person and per baby. Layer: SQL plus an edge-function unit test. Why: the edge functions have no test; a known [Bug].
8. **Achievements.** Sleep 6/8/10 h (night only; a 10 h nap must not fire), tummy 5/10/15/20 min, first solid, no repeats. Layer: unit. Why: pure logic with zero tests; needed before fixing "celebrations misfire".
9. **Guest mode, two babies.** In `activity-provider-baby-binding.integration.test.tsx:529`, assert B's timer is empty after the switch. Layer: integration. Why: one line, fails today.
10. **Each baby's lock stays on its own card.** A live lock for B never shows on A, and A's Stop never stops B. Layer: component. Why: uncaught bug 4.
11. **Live Activity per baby.** Add an "other baby" candidate in `live-activity-push-token-tests.swift:21-33`; replace the 4 by-type HARMFUL asserts. Layer: Swift plus unit.
12. **Sign-out keeps data hidden; same account brings it back; another account sees none.** Layer: component plus a fixed E2E sign-out flow. Why: replaces 3 HARMFUL tests.
13. **The saved nap/night label wins.** Rewrite the 14 HARMFUL label cases. Layer: unit.
14. **One lock per baby per type.** A second start on a held lock is refused; two babies can hold the same type. Layer: SQL. Why: never tested.
15. **"Mixed" bottle end to end.** Server accepts "mixed"; imports map to it; no save path (including the edit screen) allows an untyped bottle. Layer: SQL, unit, component.
16. **Timeline layout.** Newest first, grouped by start day, "+1" marker, summary card only for one type, "by {name}" rules. Layer: component. Why: uncaught bugs 12, 13, 20.
17. **Week views.** Overlaps counted once; feeding, diaper and pumping averages divide by 7. Layer: component. Why: uncaught bug 14.
18. **Home diaper badge = wet + mixed.** Layer: component. Why: uncaught bug 19.
19. **Pause, resume and start-time edits reach other members' widgets and Live Activities.** Layer: SQL plus unit (move the webhook into a migration first). Why: no push is sent today.
20. **Offline, a timer stopped elsewhere keeps running, then clears on reconnect.** Layer: component.
21. **Stale locks really expire.** A start succeeds over a 13-hour-old lock, or the cleanup job is scheduled. Layer: SQL.
22. **Duplicate warning shows a name, not a user id.** Layer: component with the real duplicate check.
23. **Morning sleep answer becomes the saved label.** Layer: integration with the real `SleepProvider`.
24. **Health logging saves.** Medication with dose, temperature with method, vaccine, symptoms. Layer: component.
25. **Every language has every English key and the same placeholders; non-English Timeline headers.** Layer: unit.
26. **Every test file is picked up by a runner.** Layer: node tooling test.
27. **Per-device settings change the screen and survive a restart** (units, theme, language, time format, card visibility). Layer: integration.

## 11. Real bugs found during the audit

All of these were **found by reading code**. The break-it runs planted new bugs; they did not uncover existing ones. Each is now a `[Bug]` line in the matching usage file, except where noted.

1. **Widget push skips the starter on stops.** `supabase/functions/send-widget-push/handler.ts:199` (`.neq("id", record.started_by)`). If someone else stops it, the starter's widget keeps showing it running. → cross-device-isolation.md
2. **No push for pause, resume or start-time edit made in the app.** The timer webhook covers insert and delete only, and lives in the Supabase dashboard, not in a migration. → cross-device-isolation.md
3. **Pause from the widget or Watch updates only the caller's own Live Activity.** `supabase/functions/toggle-timer-pause/index.ts:291-303`. → cross-device-isolation.md
4. **Live Activity time from the server subtracts resumed pauses.** `send-widget-push/live-activity.ts:40-43`, `:118-122`. The saved entry counts them, so the two disagree. → timers.md
5. **The 12-hour lock cleanup is never scheduled.** No `cron.schedule` calls `cleanup_stale_timer_locks`, and a start treats a 13-hour-old lock as live. Check the dashboard. → timers.md
6. **The widget has no pause for someone else's timer.** `WidgetActivitySnapshot.swift:104-107`, against the [Decided] "any member can pause from the widget". → timers.md
7. **A Live Activity started from the Watch lacks baby, timer and user ids.** `supabase/functions/start-live-activity/index.ts` ~172-176. The end push can't find it. → timers.md
8. **The Watch's backup stop deletes the lock without saving an entry.** `targets/watch/index.swift:1624-1654`. → cross-device-isolation.md
9. **Duplicate warning shows a user id.** `src/hooks/useDuplicateCheck.ts:61` (and 5 more) passes `candidate.loggedBy`, the user id, as the name. Confirm on a phone. → logging-and-editing.md
10. **Diaper and growth duplicate checks never run.** `checkAndConfirmDiaper` and `checkAndConfirmGrowth` have no caller. → logging-and-editing.md
11. **The edit screen saves a bottle with no type.** `app/edit/feeding.tsx:158-165`. → logging-and-editing.md
12. **Timeline day headers are hardcoded English.** `src/utils/timeline.ts:295-301` (`"en-US"`). → stats-and-timeline.md
13. **Cold launch pulls before it sends.** `initialize()` in the sync context schedules the send 300 ms later, against "sends queued changes first". → sync-and-offline.md
14. **Timer alerts ignore the privacy toggles.** They don't go through the sanitizer. → notifications.md
15. **In-app reminders never fire.** `checkInAppReminder` has no caller. → notifications.md
16. **Snapshot security test reads the wrong migration.** `widget-activity-snapshot.security.test.ts` reads 061, but 070 redefines the function. A test bug, not an app bug; no usage line added.

Checked and **not a bug**: "CSV formula escaping unused". Only the helper `sanitizeCSVValue` is unused. The export uses its own guard in `src/utils/csv-generator.ts`, and `csv-generator.test.ts` covers it.

Minor, no usage line: every "timer deleted" event refreshes Live Activity tokens, even for other babies (`active-timers-context.tsx:268`). Wasteful, harmless.

## 12. For a separate security review

Listed only; exploitability was not analyzed.

- `supabase/functions/end-live-activity` — no caller check.
- `supabase/functions/start-live-activity` — no caller check.
- `supabase/functions/send-activity-notification` — no caller check.
- The widget path of `supabase/functions/send-widget-push` — no caller check; `widget-push-handler.test.ts:160` locks this in.
- Push recipient filters (`send-widget-push/handler.ts:198`, `send-activity-notification/index.ts:208`) — no test would notice if removed.
- Household isolation for timers and entries on the phone rests on the subscription filter and database row rules. `verifyChangeOwnership` returns true for `active_timers` and all entry tables.

## 13. Owner decisions needed

1. **"Stop & Switch" on baby switch.** Treated as [Bug] here. Confirm, since it decides what the new A→B→A test asserts.
2. **Naps before day start.** `sleep-patterns.test.ts:562` and `:782` count a 05:30 nap on its calendar day, not its sleep day. Which is right?
3. **Timeline summary feeding count.** The doc says Timeline and PDF count raw entries. `src/utils/timeline.ts` sets `feedingCount` from sessions. Doc check needed: where is `feedingCount` shown?
4. **Diaper and growth duplicate windows.** Wire them in, or remove them from the doc?
5. **Watch baby picker.** `BabyPickerView` still exists on the Watch. Remove it, or does the [Limit] change?
6. **Nara total-only rows with a type column.** Import as "mixed" even when the column says Formula or Breast milk?
7. **Running sleep type.** Should a running sleep use the type the timer chose, or the clock?
8. **Missing usage lines for real behavior.** Sub-minute timer stops are discarded; sleep predictions; sleep goals; the delete-account confirm text. Add lines?
9. **Deploy gate.** Does deploy run `check` (with SQL and live tests) or only `check:code`?
