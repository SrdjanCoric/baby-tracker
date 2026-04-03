# Plan: SmartSleep — Personalized Sleep Predictions

> Source PRD: plans/prd-smartsleep.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Source type**: Add `'smart'` to the existing `WakeWindowConfig.source` union (`'age_based' | 'custom' | 'smart'`). This is the single flag that controls whether SmartSleep is active.
- **Prediction module**: New utility module for the core algorithm (rolling averages, slot classification, transition detection). Pure functions, no side effects — takes sleep entries + baby info in, returns prediction out.
- **Data source**: All predictions computed on-device from sleep entries already in `SleepContext`. No new server endpoints or database tables.
- **Database**: The existing `wake_window_preferences.source` column is VARCHAR — `'smart'` is stored as-is, no migration needed.
- **Minimum thresholds**: Baby ≥ 8 weeks (56 days), ≥ 3 days of sleep data per slot for personalized predictions. Below thresholds → age-based fallback.
- **Rolling window**: 7 days lookback.
- **Range width**: Predicted center ± 15 minutes (30-minute window).
- **Household scope**: SmartSleep mode is household-wide, consistent with existing wake window behavior.
- **Branching**: Single feature branch (`feature/smartsleep`), one PR to main at the end.
- **i18n**: Each phase that introduces UI strings includes translations for all 6 languages (en, sr, es, de, fr, pt).
- **Paywall-ready**: The prediction entry point includes a check that can be gated by a subscription flag in the future. When not entitled, returns age-based defaults.

### UI/UX Decisions (from design review)

- **Dashboard design**: Version C — card-within-card. A distinct prediction box with muted background sits inside the sleep card. Time range is the hero element.
- **Prediction box visibility**: Shows for ALL sources (`age_based`, `custom`, `smart`) when wake windows are configured. Not just `smart`.
- **Subtitle**: Only for `smart` source — "Based on [Baby]'s patterns" when personalized, "Building predictions..." when insufficient data. No subtitle for `age_based`/`custom`.
- **Time format**: Respect user's 12h/24h preference from `TimeFormatProvider`.
- **Slot labels**: "Nap" for all nap slots, "Bedtime" for the last slot. No nap numbering (no "Nap 1", "Nap 2").
- **Countdown pill**: Counts down to the START of the window. Shows "in Xm" (or "in Xh Ym" if >= 60m). Switches to "now" when inside the range.
- **Overdue state**: Amber warning pill (`#f59e0b`) for 15 minutes past `rangeEnd`.
- **After 15 min overdue**: Auto-advance to next slot, recalculate from current awake time.
- **Predictions always based on actual last wake time** — not a pre-planned schedule. Handles late naps, missed naps, and irregular days gracefully.
- **No night sleep predictions**: Sequence is morning wake → naps → bedtime → done until next morning wake.
- **No morning wake logged**: Show "Log sleep to see predictions" in the prediction box. Retroactively logged night sleep also triggers predictions.
- **Baby under 8 weeks**: `smart` option disabled in settings with age explanation on tap.
- **Baby sleeping (timer active)**: Timer takes priority, prediction box hidden.

---

## Phase 1: Core Prediction Algorithm + Types

**User stories**: 1, 5, 17, 18

### What to build

The pure prediction engine — no UI, no context wiring. Given a list of sleep entries and a baby profile, compute the personalized wake window for the current nap slot.

**End-to-end behavior**: A function takes `(sleepEntries, babyBirthDate, currentNapSlotIndex, wakeWindowConfig)` and returns a prediction object `{ rangeStart, rangeEnd, slotType, confidence, isEligible }`. It reconstructs each day's nap sequence from the 7-day window, classifies naps into slots using nap continuation logic, computes per-slot rolling averages, and falls back to age-based defaults when data is insufficient.

Also add `'smart'` to the `WakeWindowConfig.source` union type and define the `SmartSleepPrediction` result type.

### Acceptance criteria

- [x] `'smart'` added to the source union type in wake window types
- [x] `SmartSleepPrediction` type defined with `rangeStart`, `rangeEnd`, `slotType` ('nap' | 'bedtime'), `confidence` ('personalized' | 'age_based'), `isEligible` (boolean)
- [x] Prediction function correctly computes per-slot 7-day rolling average wake windows
- [x] Falls back to age-based defaults when fewer than 3 data points for a slot
- [x] Returns `isEligible: false` when baby is under 8 weeks
- [x] Nap slot classification uses nap continuation logic (groups consecutive short sleeps)
- [x] Bedtime slot correctly identified as the slot after the last expected nap
- [x] Unit tests cover: normal prediction, insufficient data fallback, baby too young, per-slot variation, bedtime slot
- [x] All functions are pure (no side effects, no context dependencies)
- [x] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 2: Dashboard Prediction Display

**User stories**: 2, 3, 4, 8, 9, 13, 14, 15, 19, 21

### What to build

Wire the prediction algorithm into `SleepContext` and display predictions on the dashboard sleep card using the Version C card-within-card design. The prediction box shows for ALL wake window sources (`age_based`, `custom`, `smart`), not just `smart`. The existing `sleepSecondaryInfo` text-based display is replaced with a prediction box containing the time range, countdown pill, and optional subtitle.

**End-to-end behavior**: When a parent opens the dashboard and wake windows are configured, they see a prediction box inside the sleep card with "1:15 – 1:45 PM" as the hero time range, a "in 45m" countdown pill, and slot label ("Nap" or "Bedtime"). For `smart` source with sufficient data, "Based on [Baby]'s patterns" subtitle appears. The card transitions through states: before window (countdown), in window ("now" pill), overdue (amber "overdue" pill for 15 min), auto-advance to next slot after 15 min, bedtime variant, building predictions (`smart` only), no sleep logged ("Log sleep to see predictions"), baby currently sleeping (timer takes priority). No night predictions — after bedtime, prediction box disappears until next morning wake.

Include i18n keys for all dashboard prediction strings across all 6 languages.

### Acceptance criteria

- [ ] `SleepContext` exposes prediction data (computed via `useMemo` from current sleep entries + last wake time)
- [ ] Dashboard sleep card shows Version C prediction box (inner card with muted bg) for all sources when wake windows configured
- [ ] Prediction box shows clock time range as primary display, respecting user's 12h/24h time format preference
- [ ] Countdown pill shows "in Xm" (or "in Xh Ym") counting to window start
- [ ] Pill switches to "now" when current time is within the predicted range
- [ ] Pill switches to amber "overdue" when current time exceeds `rangeEnd` (up to 15 min)
- [ ] After 15 min overdue, prediction advances to next slot recalculated from current awake time
- [ ] Slot label shows "Nap" for nap slots, "Bedtime" for last slot (no nap numbering)
- [ ] For `smart` source with personalized data: shows "Based on [Baby]'s patterns" subtitle
- [ ] For `smart` source with insufficient data: shows "Building predictions..." with days remaining
- [ ] For `age_based`/`custom` source: no subtitle
- [ ] Shows "Log sleep to see predictions" when no morning wake is logged (including retroactive entries)
- [ ] No prediction box when baby is actively sleeping (timer takes priority)
- [ ] No prediction box during night hours (after bedtime, before next morning wake)
- [ ] Baby under 8 weeks: `smart` option disabled in settings (separate Phase 4 concern)
- [ ] Countdown updates via existing `useTimeRefresh` or `timeTick` mechanism
- [ ] i18n keys added for all new strings in en, sr, es, de, fr, pt
- [ ] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 3: Nap Transition Detection

**User stories**: 10

### What to build

Extend the prediction algorithm to detect when a baby's nap counts are inconsistent over the rolling window (indicating a nap transition like 3→2 naps). Surface a transition message on the dashboard card.

**End-to-end behavior**: When the 7-day window shows mixed nap counts (e.g., some days with 3 naps, some with 2), the prediction result includes `isTransitioning: true` and `transitionNapCount` (the lower count). The dashboard card shows an info line like "Transitioning to 2 naps" below the prediction. During transitions, today's prediction uses today's actual nap count rather than the rolling average count.

Include i18n keys for transition messages across all 6 languages.

### Acceptance criteria

- [ ] Prediction detects inconsistent nap counts in the 7-day window
- [ ] `SmartSleepPrediction` type extended with `isTransitioning` and `transitionNapCount`
- [ ] During transitions, prediction is based on today's actual nap count (not average)
- [ ] Dashboard card displays transition message when `isTransitioning` is true
- [ ] i18n keys added for transition messages in en, sr, es, de, fr, pt
- [ ] Unit tests cover: transition detection, prediction during transition, no false positive on consistent days
- [ ] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 4: Settings UI + Mode Switching

**User stories**: 6, 7, 16, 20

### What to build

Add "Smart (Recommended)" as a third option in the wake window settings source selector. When selected, show an explanation and read-only per-slot learned averages. Implement auto-activation logic: when a baby reaches 8 weeks and has 3+ days of data, suggest switching to SmartSleep mode. Allow switching between all three modes at any time.

**End-to-end behavior**: Parent opens sleep settings and sees three source options: Age-based, Custom, Smart. Selecting "Smart" shows "Predicts nap and bedtime windows based on [Baby]'s actual patterns from the last 7 days" and a read-only list of per-slot averages. The source preference persists to local storage and syncs to the `wake_window_preferences` table. When switching away from Smart, the app reverts to the selected mode's wake window values.

Auto-activation: when the app detects eligibility (age + data thresholds met) and source is still `'age_based'`, it can suggest SmartSleep (but not force-switch).

Include i18n keys for settings strings across all 6 languages.

### Acceptance criteria

- [ ] Three source options visible in wake window settings: Age-based, Custom, Smart
- [ ] "Smart" option shows explanation text and read-only per-slot averages
- [ ] Source preference persists to AsyncStorage via existing `setWakeWindowConfig` flow
- [ ] Source `'smart'` syncs to `wake_window_preferences` table via existing `syncWakeWindowPreferenceForBaby`
- [ ] Switching from Smart to Age-based regenerates age-based defaults
- [ ] Switching from Smart to Custom preserves current slots for manual editing
- [ ] Auto-activation suggestion appears when baby becomes eligible (not a forced switch)
- [ ] Smart option is hideable/gateable for future paywall (clear check point in the code)
- [ ] i18n keys added for settings strings in en, sr, es, de, fr, pt
- [ ] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 4.5: Decouple Predictions from Notifications + Settings UX Rework

### Context

The current settings UI gates all wake window features (source selector, nap count, predictions) behind the "Nap Reminders" toggle — which requires notification permissions. This means users must opt into push notifications just to *see* predictions on the dashboard. Huckleberry separates these: predictions are always visible, notifications are a separate opt-in. This phase decouples predictions from notifications and reworks the settings layout.

### What to build

Restructure the sleep settings screen so that the source selector and wake window configuration are always visible (for babies with birthdate), independent of notification permissions. Move the notification toggle to a separate section below the wake window config. Reorder source buttons to `Smart | Age-based | Custom`. Implement three distinct user paths based on baby age and prior preferences.

**End-to-end behavior**:

1. **Settings layout change**: Remove "Nap Reminders" as the master toggle that gates wake window config. The source selector (`Smart | Age-based | Custom`), nap count (for non-Smart sources), and source-specific content (smart averages or editable slots) are always visible when baby has a birthdate. A new "Notifications" section appears below with a simple toggle: "Notify me before sleep windows" (5 min before, fixed timing for now).

2. **Source button order**: `Smart | Age-based | Custom` (Smart first, as recommended).

3. **Nap count in Smart mode**: Hidden entirely (not disabled/grayed — gone). Algorithm determines nap count from patterns.

4. **Three user paths**:
   - **Baby < 8 weeks, no preference set**: No source selected by default. All three buttons visible but none active. Smart button disabled with message on tap: "Available when [Baby] turns 8 weeks ([date])". Tapping Age-based or Custom shows a gentle confirmation popup: "Wake windows are less predictable before 8 weeks. Predictions may be less accurate at this age." with Cancel / Continue Anyway. One-time confirmation, no repeat nagging.
   - **Baby ≥ 8 weeks, no prior preference**: Smart auto-selected by default. Prediction box appears on dashboard immediately (with age-based fallback while building personalized data).
   - **Baby ≥ 8 weeks, prior preference exists** (user previously chose Age-based/Custom before reaching 8 weeks): Respect their choice. Do NOT auto-switch to Smart. They can manually switch if they want.

5. **Dashboard prediction box**: Mirrors settings state. Shows when a source is active, hidden when no source is selected (< 8 weeks, never opted in).

6. **Notification toggle**: Independent of prediction visibility. Simple toggle requesting notification permission on first enable. No notification permission needed to see predictions on dashboard or configure wake windows.

### Files to modify

- `app/sleep/settings.tsx` — Major restructure: remove reminders-as-master-gate, reorder source buttons, hide nap count for Smart, add < 8 weeks confirmation popup, add standalone notification toggle section
- `app/(tabs)/index.tsx` — Update prediction box visibility logic to check for active source rather than reminders enabled
- `src/components/SleepPredictionBox.tsx` — May need updates for "no source selected" state
- `src/i18n/locales/{en,sr,es,de,fr,pt}.json` — i18n keys for new/changed strings (popup text, notification toggle label, Smart disabled message)

### Acceptance criteria

- [ ] Source selector (`Smart | Age-based | Custom`) visible without enabling notifications, for any baby with birthdate
- [ ] Smart button is first in the source selector order
- [ ] Nap count selector hidden (not disabled) when Smart source is selected
- [ ] Baby < 8 weeks: no source selected by default; Smart disabled with tap-to-explain message showing when it will be available
- [ ] Baby < 8 weeks: tapping Age-based or Custom shows gentle confirmation popup; on confirm, source is set and config appears
- [ ] Baby ≥ 8 weeks with no prior preference: Smart auto-selected as default
- [ ] Baby ≥ 8 weeks with prior Age-based/Custom preference: existing choice preserved, no auto-switch to Smart
- [ ] Dashboard prediction box visible when any source is active, hidden when no source selected
- [ ] Notification toggle is a separate section below wake window config
- [ ] Notification toggle requests permission on first enable, independent of prediction display
- [ ] Predictions work on dashboard without notification permissions being granted
- [ ] i18n keys added for all new/changed strings in en, sr, es, de, fr, pt
- [ ] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 5: Notification Integration

**User stories**: 11

### What to build

When `source === 'smart'`, the wake window reminder notifications use the personalized prediction timing instead of the static age-based/custom duration.

**End-to-end behavior**: The existing wake window reminder system (edge function `check-wake-window-reminders` reading from `wake_window_preferences`) already receives the `wake_window_slots` JSONB and `source` field. When source is `'smart'`, the app needs to keep the synced `wake_window_slots` up to date with the latest per-slot rolling averages, so the server-side reminder fires at the personalized time.

### Acceptance criteria

- [ ] When `source === 'smart'`, the app periodically syncs computed per-slot averages to `wake_window_preferences.wake_window_slots`
- [ ] Server-side reminder edge function fires at the correct personalized time (no edge function code change needed — it reads slots as-is)
- [ ] Notification content labels correctly ("SmartSleep" or "Nap Time" per existing pattern)
- [ ] Reminders still work correctly for `'age_based'` and `'custom'` sources (no regression)
- [ ] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 6: Widget Data + Household Sync Verification

**User stories**: 12, 22

### What to build

Ensure SmartSleep data flows through the existing widget data pipe, and verify household-wide consistency.

**End-to-end behavior**: When SmartSleep is active, the personalized `wakeWindowMinutes` and `wakeWindowSlotLabel` values are passed to the widget via the existing `updateSleepWidgetData()` flow — the widget shows personalized timing without any widget-side code changes. For household sync: when one caregiver sets `source: 'smart'`, the Realtime subscription on `wake_window_preferences` picks up the change on all other devices, and all caregivers see SmartSleep predictions.

### Acceptance criteria

- [ ] Widget receives personalized wake window data when SmartSleep is active
- [ ] Widget shows age-based data when SmartSleep is not active (no regression)
- [ ] When caregiver A enables SmartSleep, caregiver B's device picks up the source change via Realtime subscription
- [ ] Both caregivers see identical predictions (deterministic from shared sleep data)
- [ ] Switching source on one device is reflected on the other within the Realtime sync window
- [ ] `npm run typecheck` and `npm run test:unit` pass

---

## Phase 7: Apple Watch — Next Nap Prediction

### What to build

Display the SmartSleep next nap prediction on the Apple Watch sleep details screen, using the existing `watch-service.ts` message bridge to send prediction data from the phone.

**End-to-end behavior**: When SmartSleep is active and the parent opens the sleep details on the Apple Watch, they see the next nap prediction (time range + countdown), matching what the dashboard shows. The phone sends the current prediction as part of the watch data payload. When SmartSleep is not active or data is insufficient, the watch falls back to the standard wake window display.

### Acceptance criteria

- [ ] Watch sleep details screen shows next nap prediction (time range + countdown) when SmartSleep is active
- [ ] Prediction data sent to watch via `watch-service.ts` message bridge
- [ ] Watch falls back to standard wake window display when SmartSleep is not active
- [ ] Watch shows appropriate state for insufficient data / baby too young
- [ ] Prediction updates when new sleep data is logged
- [ ] `npm run typecheck` and `npm run test:unit` pass
