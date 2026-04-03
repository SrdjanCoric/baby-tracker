# PRD: SmartSleep — Personalized Sleep Predictions

## Problem Statement

Parents of infants need to know **when to put their baby down for the next nap or bedtime**. Currently, the app provides age-based wake window guidelines (static ranges like "2–3 hours" per age group) and allows custom overrides, but every baby is different. A baby's actual optimal wake window depends on individual patterns — their typical first wake window may be shorter than their afternoon one, and these patterns shift as the baby grows.

Parents using competing apps (notably Huckleberry's "SweetSpot" feature) have access to personalized, data-driven sleep predictions that adapt to their specific baby. This is the #1 most-valued premium feature in the baby sleep tracking space. Without it, parents either guess timing based on generic guidelines or switch to a competitor.

## Solution

**SmartSleep** is a personalized sleep prediction feature that analyzes a baby's recent sleep history to predict the optimal window for their next nap or bedtime. It computes **per-slot rolling averages** of actual wake windows from the last 7 days and displays a **30-minute time range with a countdown** on the dashboard sleep card.

SmartSleep is an intelligent evolution of the existing wake window system — not a separate feature. It appears as a third mode (`smart`) alongside the existing `age_based` and `custom` modes. When conditions are met (baby ≥ 8 weeks old, ≥ 3 days of sleep data), SmartSleep automatically activates. Parents can always switch back to age-based or custom modes.

The prediction updates in real-time as the day progresses, accounts for which nap the baby is on, and detects nap transitions (e.g., going from 3 naps to 2 naps). It integrates with the existing wake window reminder notification system so parents receive timely push alerts based on personalized timing.

SmartSleep is architectured to be gated behind a future paywall — the prediction logic has a clear entitlement check point where free users fall back to age-based defaults.

## User Stories

1. As a parent, I want to see a personalized predicted time range for my baby's next nap, so that I can plan my day around an accurate (not generic) sleep schedule.

2. As a parent, I want the prediction to show as a countdown ("in 45 min") alongside the time range, so that I can quickly glance at the dashboard and know how long I have before the nap window.

3. As a parent, I want the sleep card to visually change when the nap window is active ("Nap window is now"), so that I get a clear signal it's time to put my baby down.

4. As a parent, I want SmartSleep to predict bedtime after all naps are done, so that I know when to start the bedtime routine.

5. As a parent, I want predictions that are specific to each nap slot (morning nap vs afternoon nap vs bedtime), so that the app reflects my baby's actual pattern of shorter morning wake windows and longer afternoon ones.

6. As a parent, I want SmartSleep to automatically activate when my baby is old enough and I have enough tracking data, so that I don't have to discover and manually enable it.

7. As a parent, I want to switch between SmartSleep, age-based, and custom wake window modes, so that I have control over which system I trust.

8. As a parent, I want SmartSleep to tell me when it doesn't have enough data yet ("Building predictions... 2 more days of tracking needed"), so that I understand why I'm still seeing generic recommendations.

9. As a parent, I want to be prompted to log the morning wake time before seeing predictions, so that the day's predictions are anchored to the actual wake time rather than a guess.

10. As a parent, I want SmartSleep to detect when my baby is transitioning between nap counts (e.g., 3→2 naps) and tell me, so that I understand why the schedule feels inconsistent.

11. As a parent, I want push notifications based on my personalized SmartSleep prediction ("Nap window approaching") instead of generic age-based reminders, so that alerts arrive at the right time for my specific baby.

12. As a parent in a multi-caregiver household, I want SmartSleep predictions to be the same for all caregivers, so that we're on the same page about when to put the baby down.

13. As a parent of a newborn (under 8 weeks), I want the app to show standard age-based guidance without SmartSleep branding, so that I'm not confused by a feature that can't work yet for my baby's age.

14. As a parent, I want SmartSleep to not show a prediction while my baby is currently sleeping, so that I see the active sleep timer instead of a confusing next-nap prediction.

15. As a parent, I want SmartSleep to advance to the next slot if the current nap window has passed (baby skipped a nap), so that predictions stay useful even on atypical days.

16. As a parent, I want to see what SmartSleep has learned in the wake window settings (per-slot averages), so that I can understand and trust the algorithm's recommendations.

17. As a parent tracking multiple babies, I want SmartSleep predictions to be independent per baby, so that each child gets their own personalized timing.

18. As a parent with limited connectivity, I want SmartSleep to work offline, so that predictions are available even without internet.

19. As a parent, I want SmartSleep to show "All done for today" after bedtime, so that I'm not given unnecessary predictions late at night.

20. As a parent who prefers manual control, I want to disable SmartSleep and use age-based or custom wake windows, so that I'm never locked into the algorithm's recommendations.

21. As a parent, I want the prediction to label itself "Based on [baby's name]'s patterns" when personalized, so that I know the timing is tailored to my child.

22. As a parent, I want SmartSleep data to appear in the iOS widget through the existing wake window data pipe, so that I can see personalized predictions without opening the app.

## Implementation Decisions

### Algorithm

- **Per-slot rolling averages**: For each nap slot (wake-before-nap-1, wake-before-nap-2, ..., wake-before-bedtime), compute the average actual wake window over the last 7 days.
- **Slot classification**: Reconstruct each day's nap sequence from sleep entries, using nap continuation logic to group consecutive short sleeps. Map each nap to its slot index (1st nap = slot 1, 2nd = slot 2, etc.). Bedtime = the night sleep following the last nap.
- **Fallback**: If fewer than 3 data points exist for a specific slot, fall back to age-based defaults for that slot only (not globally).
- **Range calculation**: `predicted_center = last_sleep_ended + personalized_wake_window`. Display range = center ± 15 minutes (30-minute window).
- **Day anchor**: The first prediction of the day requires the morning wake time (night sleep `ended_at`). If not logged, show a prompt instead of a prediction.
- **V1 uses wake time only** — prior nap duration does not affect the next prediction.

### Nap Transition Detection

- Count naps per day over the 7-day window.
- If counts are inconsistent (mix of N and N-1), flag as "transitioning" and show a message.
- During transitions, base prediction on today's actual nap count, not the rolling average count.

### Architecture: Third Wake Window Mode

- Add `'smart'` to the existing `source` union type (`'age_based' | 'custom' | 'smart'`).
- SmartSleep hooks into the existing `getCurrentNapSlot()` flow — when `source === 'smart'`, the slot's `durationMinutes` is overridden with the personalized rolling average.
- The prediction is computed on-device using sleep data already in `SleepContext`. No new server endpoints.
- The `source: 'smart'` value is stored in the existing `wake_window_preferences` table (VARCHAR column, no migration needed).

### Household & Sync

- SmartSleep is household-wide, consistent with existing wake window settings behavior.
- When one caregiver enables SmartSleep, all caregivers see the same predictions.
- Predictions are deterministic from the same sleep data, so multi-device consistency is automatic via the existing sync system.

### Notifications

- Reuse the existing `check-wake-window-reminders` edge function infrastructure.
- When `source === 'smart'`, the reminder timing uses the personalized wake window duration instead of the age-based/custom value.
- No new notification channels or edge functions needed — the existing pipeline carries SmartSleep-driven timing.

### Widget Integration

- The widget data service already passes `wakeWindowMinutes` and `wakeWindowSlotLabel` to the iOS widget.
- When SmartSleep is active, the personalized wake window value flows through these existing fields — no new widget data structure needed.

### Paywall Architecture

- The prediction function has a clear entry point that can check a subscription/entitlement flag.
- When not entitled, the function returns age-based defaults instead of personalized predictions.
- The `'smart'` source mode in the UI can be gated or shown with an upgrade prompt.

### Internationalization

- New i18n keys needed for SmartSleep UI strings across all 6 supported languages (en, sr, es, de, fr, pt).
- Key areas: feature title, prediction labels, building/learning state messages, transition messages, settings explanations.

### Minimum Age Gate

- SmartSleep is invisible (no branding, no UI) for babies under 8 weeks (56 days).
- Uses existing `isUnderTwoMonths()` check.
- Standard age-based wake window info shown instead.

### UI States for Dashboard Sleep Card

1. **Before window**: "Next nap: 1:15 – 1:45 PM · in 45 min" with progress bar and "Based on [Baby]'s patterns"
2. **In window** (highlighted): "Nap window is now · 1:15 – 1:45 PM"
3. **Last slot — Bedtime**: "Bedtime: 7:00 – 7:30 PM · in 1h 20min"
4. **Not enough data**: "Building predictions... 2 more days of tracking needed · Using age-based wake windows"
5. **No morning wake logged**: "Log morning wake to see today's predictions"
6. **Baby too young** (< 8 weeks): No SmartSleep branding, standard age-based info
7. **Nap transition detected**: Normal prediction + "Transitioning to N naps" message
8. **Baby sleeping**: No prediction shown, active timer displayed instead
9. **All done**: "All done for today" after bedtime

### Wake Window Settings

- Add "Smart (Recommended)" as a third option alongside "Age-based" and "Custom" in the existing source selector.
- When selected, show explanation text and read-only per-slot averages so parents can see what the algorithm learned.
- Allow switching back to age-based or custom at any time.

## Out of Scope

- **Full daily schedule generation** — SmartSleep V1 only predicts the next sleep, not the entire day's schedule.
- **Nap duration / sleep debt adjustment** — V1 does not shorten the next wake window after a short nap. This is a V2 enhancement.
- **ML or trained models** — V1 uses simple rolling averages, not machine learning.
- **Prediction accuracy tracking** — V1 does not track how often predictions matched actual sleep times. This is a V2 metric.
- **Apple Watch integration** — SmartSleep predictions are not surfaced on Apple Watch in V1.
- **Live Activity integration** — SmartSleep does not launch Dynamic Island countdowns in V1.
- **Per-user SmartSleep preferences** — SmartSleep mode is household-wide, not per-caregiver.
- **Subscription/payment infrastructure** — V1 builds the paywall-ready architecture but does not implement the actual paywall or subscription system.

## Further Notes

### Competitive Context
- Huckleberry's "SweetSpot" is the market leader — displays a time range on the dashboard with a green accent and push notifications ~10-15 min before the window. Gates it behind a paid subscription.
- Nanit takes a schedule-first approach (not real-time predictions). Glow Baby uses simple countdown timers. Neither offers personalized per-slot predictions.

### Existing Infrastructure Leverage
SmartSleep maximizes reuse of existing code: wake window config types and storage, nap counting with continuation logic, age group classification and fallback values, slot generation infrastructure, wake window reminder notification pipeline, widget data service fields, household-wide settings sync, and day/night boundary classification.

### V2 Roadmap
- Nap duration adjustment (short nap → shorter next wake window)
- Full daily schedule view
- Prediction accuracy tracking and display
- More sophisticated transition handling with gradual slot count changes
- Dedicated widget complication for SmartSleep
- Apple Watch SmartSleep display
