# SmartSleep — Personalized Sleep Predictions

## Context

Parents using baby tracker apps want to know **when to put their baby down for the next nap or bedtime**. Competing apps like Huckleberry (SweetSpot feature) have proven this is the #1 most-valued premium feature. Our app already has wake window tracking with age-based defaults and custom overrides — SmartSleep builds on this foundation to deliver personalized, data-driven predictions based on each baby's actual sleep patterns.

## Feature Overview

SmartSleep predicts the optimal window for the baby's next sleep (nap or bedtime) by computing personalized per-slot rolling averages from the baby's recent sleep history. It displays a **time range + countdown** on the dashboard sleep card and integrates with the existing wake window reminder notification system.

## Design Decisions

### Scope
- **Next sleep prediction only** — predicts when to start the next nap or bedtime
- NOT a full daily schedule generator (future enhancement)
- Includes **bedtime** as the final slot (same algorithm, different label)

### Algorithm: Enhanced Wake Windows with Per-Slot Rolling Averages
- Compute a **7-day rolling average** of actual wake windows for each nap slot independently
- Per-slot means: separate averages for wake-before-nap-1, wake-before-nap-2, ..., wake-before-bedtime
- Fall back to age-based defaults from `sleepGoals.ts` when insufficient personalized data
- **V1 uses wake time only** — does not factor in prior nap duration (sleep debt adjustment is a V2 enhancement)
- Prediction displayed as a **~30 minute range** (e.g., "1:15 – 1:45 PM")

### Internationalization
- New i18n keys needed for SmartSleep UI strings across all 6 supported languages (en, sr, es, de, fr, pt)
- Key areas: feature title, prediction labels, building/learning state messages, transition messages, settings explanations

### Compute Location
- **On-device only** — all prediction logic runs locally using sleep data already in SleepContext
- Works offline, no latency, fits local-first architecture
- No new server endpoints needed

### Data Requirements
- **Minimum baby age**: 8 weeks (56 days) — newborns have no predictable pattern before this
- **Minimum data**: 3 days of logged sleep data for personalized predictions
- **Rolling window**: 7 days lookback
- Below thresholds → fall back to age-based wake window defaults
- **Day anchor**: Requires logged morning wake time (night sleep `ended_at`) before showing predictions for the day. If not logged, show prompt: "Log morning wake to see SmartSleep"

### Feature Name & Branding
- Feature name: **SmartSleep**
- Positioned as an intelligent evolution of wake window tracking

### Activation & Monetization
- **Three modes** for wake window source: `'age_based'` | `'custom'` | `'smart'`
- SmartSleep auto-activates when baby is ≥8 weeks and has ≥3 days of data
- **Architectured for future paywall**: prediction logic has a clear entry point that can check subscription/entitlement before returning personalized results vs. falling back to age-based
- Parents always have `'age_based'` and `'custom'` available as free alternatives

### Nap Transition Detection
- When rolling window shows inconsistent nap counts (e.g., some days 3 naps, some days 2), detect and show: "Looks like [baby] may be transitioning to N naps"
- Base today's prediction on today's actual nap count (using `getCompletedNapsSinceNightSleep()`)
- Builds on existing `checkSleepMilestoneCrossing()` infrastructure

### Notifications
- Reuse existing wake window reminder infrastructure (`check-wake-window-reminders` edge function)
- When `source === 'smart'`, the reminder timing uses personalized prediction instead of age-based wake window
- Parents can opt into SmartSleep-driven reminders instead of manual/age-based ones

## UI Design

### Sleep Card (Dashboard)

**States:**

1. **Before window** (normal):
   ```
   ┌─────────────────────────────────┐
   │  🧠 SmartSleep                  │
   │  Next nap: 1:15 – 1:45 PM      │
   │  in 45 min                      │
   │  ━━━━━━━━━━━━░░░░░░░░░░░░░░░   │
   │  Based on [Baby]'s patterns     │
   └─────────────────────────────────┘
   ```

2. **In window** (highlighted):
   ```
   ┌─────────────────────────────────┐
   │  🧠 SmartSleep                  │
   │  Nap window is now              │
   │  1:15 – 1:45 PM                 │
   │  ━━━━━━━━━━━━━━━━━█░░░░░░░░░   │
   │  Based on [Baby]'s patterns     │
   └─────────────────────────────────┘
   ```

3. **Last slot — Bedtime**:
   ```
   ┌─────────────────────────────────┐
   │  🧠 SmartSleep                  │
   │  Bedtime: 7:00 – 7:30 PM       │
   │  in 1h 20min                    │
   │  ━━━━━━━━━━━░░░░░░░░░░░░░░░░   │
   │  Based on [Baby]'s patterns     │
   └─────────────────────────────────┘
   ```

4. **Not enough data**:
   ```
   ┌─────────────────────────────────┐
   │  🧠 SmartSleep                  │
   │  Building predictions...        │
   │  2 more days of tracking needed │
   │  Using age-based wake windows   │
   └─────────────────────────────────┘
   ```

5. **No morning wake logged**:
   ```
   ┌─────────────────────────────────┐
   │  🧠 SmartSleep                  │
   │  Log morning wake to see        │
   │  today's predictions            │
   └─────────────────────────────────┘
   ```

6. **Baby too young** (< 8 weeks):
   - Don't show SmartSleep branding at all
   - Show standard age-based wake window info

7. **Nap transition detected**:
   ```
   ┌─────────────────────────────────┐
   │  🧠 SmartSleep                  │
   │  Next nap: 1:15 – 1:45 PM      │
   │  in 45 min                      │
   │  ━━━━━━━━━━━━░░░░░░░░░░░░░░░   │
   │  ℹ️ Transitioning to 2 naps     │
   └─────────────────────────────────┘
   ```

### Wake Window Settings

Add "Smart (Recommended)" as a third option alongside "Age-based" and "Custom" in the existing wake window source selector. When selected:
- Show explanation: "Predicts nap and bedtime windows based on [Baby]'s actual sleep patterns from the last 7 days"
- Show current per-slot averages (read-only) so parents can see what the algorithm learned
- Allow override back to age-based or custom at any time

## Algorithm Detail

### Prediction Calculation

```
For a given baby on a given day:

1. Determine current nap slot:
   - Count completed naps today (using getCompletedNapsSinceNightSleep())
   - Current slot = completed_naps + 1
   - If current_slot > expected_nap_count → this is the bedtime slot

2. Get personalized wake window for this slot:
   - Look back 7 days
   - Filter to same slot index (wake-before-nap-N or wake-before-bedtime)
   - Compute average wake window duration (minutes)
   - If fewer than 3 data points for this slot → fall back to age-based default for this slot

3. Compute prediction:
   - last_sleep_ended = ended_at of last sleep (or night sleep ended_at for first nap)
   - predicted_center = last_sleep_ended + personalized_wake_window
   - range_start = predicted_center - 15 minutes
   - range_end = predicted_center + 15 minutes
   - Display: "range_start – range_end"
   - Countdown: minutes until range_start
```

### Nap Slot Classification

To compute per-slot averages from historical data:
- For each day in the 7-day window, reconstruct the day's nap sequence
- Use existing nap continuation logic (napContinuationMinutes) to group consecutive short sleeps
- Map each nap to its slot index (1st nap of day = slot 1, 2nd = slot 2, etc.)
- Bedtime = the night sleep that follows the last nap
- Wake window = time between previous sleep's ended_at and this sleep's started_at

### Nap Transition Detection

```
From the 7-day rolling window:
- Count naps per day for each day
- If nap counts are inconsistent (e.g., mix of 2 and 3):
  - Flag as "transitioning"
  - Use today's actual nap count for prediction (not the average)
  - Show transition message to parent
```

### Edge Cases

- **Baby sleeping**: No prediction shown — show active timer/sleep-in-progress instead
- **Past bedtime boundary**: Don't predict another nap. If all naps + bedtime are done, show "All done for today"
- **Skipped nap**: If current time is already past the predicted window for slot N, advance to slot N+1
- **Very early morning wake**: If baby woke unusually early, predictions may shift the whole day earlier — this is correct behavior
- **Multiple caregivers**: Predictions are the same across devices (same sleep data via sync)

## Technical Implementation

### Key Files to Modify

| File | Change |
|------|--------|
| `src/utils/sleepGoals.ts` | Add per-slot rolling average computation functions |
| `src/types/wake-windows.ts` | Add `'smart'` to source type, add SmartSleep prediction types |
| `src/contexts/sleep-context.tsx` | Add SmartSleep state, prediction computation, expose via context |
| `src/services/sleep-storage.ts` | Storage for SmartSleep preferences (source: 'smart') |
| Wake window settings UI | Add "Smart" option to source selector |
| Dashboard sleep card component | Add SmartSleep prediction display with states |

### New Files

| File | Purpose |
|------|---------|
| `src/utils/smart-sleep.ts` | Core prediction algorithm: rolling averages, slot classification, transition detection |

### Existing Code to Reuse

- `getCompletedNapsSinceNightSleep()` — counts today's naps (sleep-context.tsx)
- `getCurrentNapSlot()` — current expected nap slot (sleep-context.tsx)
- `getSleepAgeGroupForBaby()` — age group classification (sleepGoals.ts)
- `getWakeWindowForAge()` — age-based fallback values (sleepGoals.ts)
- `generateSlotsForNapCount()` — slot generation infrastructure (sleepGoals.ts)
- `checkSleepMilestoneCrossing()` — age group transition detection (sleepGoals.ts)
- `determineSleepTypeFromBoundary()` — nap vs night classification (day-night-boundary.ts)
- `isUnderTwoMonths()` — newborn age check (sleepGoals.ts)
- Wake window preferences sync (existing Supabase realtime subscription)
- Wake window reminder edge function (`check-wake-window-reminders`)

### Data Flow

```
Sleep entries (SleepContext)
  → smart-sleep.ts: computeSmartSleepPrediction(sleeps, baby, currentSlot)
    → Filters last 7 days of sleep data
    → Classifies naps into slots per day
    → Computes per-slot rolling average wake windows
    → Detects nap transitions
    → Returns: { rangeStart, rangeEnd, slotType: 'nap' | 'bedtime', isTransitioning, confidence: 'personalized' | 'age_based' }
  → SleepContext exposes prediction via context value
  → Dashboard sleep card reads prediction and renders appropriate state
```

## Phasing

### V1 (This Implementation)
- Core prediction algorithm (per-slot rolling averages)
- Dashboard sleep card with time range + countdown
- Three modes: age-based / custom / smart
- Nap transition detection and messaging
- Bedtime prediction as final slot
- Integration with existing wake window reminder notifications
- Paywall-ready architecture

### V2 (Future)
- Nap duration adjustment (short nap → shorter next wake window)
- Full daily schedule view
- Prediction accuracy tracking (compare predicted vs actual)
- More sophisticated transition handling
- Widget integration (show SmartSleep prediction in iOS widget)

## Verification

1. **Unit tests**: Test prediction algorithm with various scenarios:
   - Normal day with enough data → personalized prediction
   - Not enough data → falls back to age-based
   - Baby under 8 weeks → no SmartSleep
   - Nap transition day → correct detection and slot handling
   - No morning wake logged → appropriate prompt
   - Edge cases (skipped nap, past bedtime, etc.)

2. **Manual testing**:
   - Create test baby with 7+ days of sleep history
   - Verify predictions update after logging new sleep entries
   - Verify countdown timer ticks correctly
   - Verify state change when entering the prediction window
   - Verify mode switching between smart/age-based/custom
   - Test with multiple babies (predictions independent per baby)

3. **Type checking**: `npm run typecheck` passes
4. **Existing tests**: `npm run test:unit` still passes (no regressions)
