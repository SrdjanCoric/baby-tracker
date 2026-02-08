# Dynamic Wake Window Reminders — Implementation Plan

## Context

The app has **no sleep reminders** — only feeding reminders (interval-based, via edge function cron) and timer alerts (local). Parents' #1 concern is sleep. Competitor Nara offers dynamic wake window reminders that auto-adjust based on when the baby actually wakes up. This feature fills that gap.

A "wake window" is the recommended awake time between naps. It's shorter in the morning and progressively longer throughout the day. The last wake window ends with bedtime, not a nap.

**Algorithm**: Simple reactive (matching Nara) — when baby wakes, calculate `wake_time + wake_window_duration - heads_up_minutes` and send a push notification at that time. No AI, no learning.

**Branch**: `feature/wake-window-reminders`

---

## UX Architecture

### All config lives in Sleep Settings

Industry research (Nara, Huckleberry, Napper) shows every successful baby tracker places wake window config **near the sleep feature**, not in a generic notifications page. Our approach: all wake window config (durations, nap count, reminder toggle, heads-up time) in `app/sleep/settings.tsx`. The notification settings screen gets a simple navigational link.

### Sleep Settings Screen Layout (`app/sleep/settings.tsx`)

Below the existing Daily Sleep Goal section (separated by `mb-8` spacing):

#### Section A: Reminder Toggle

```
WAKE WINDOWS                                          ← SectionHeader

┌─ Card (bg-surface-card, rounded-card) ──────────────────────────┐
│                                                                  │
│  Nap Reminders                                                   │
│  Get a heads-up before nap                           [Toggle]    │
│  and bedtime                                                     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← only when enabled
│  Remind me                                                       │
│  [5 min] [10 min] [15 min]  before                               │
└──────────────────────────────────────────────────────────────────┘
```

- Uses `SettingsRow` pattern for toggle (label + description + `<Switch>`)
- When enabled, second row with heads-up time pills appears (animated expand, same as feeding interval pills)
- Selected pill: `SLEEP_PURPLE` bg + white text; unselected: `bg-surface-secondary`
- Toggle disabled if notification permissions not granted
- If permissions denied: amber warning card above (reuse exact pattern from `notifications.tsx:301-321`)

#### Section B: Nap Count Selector

```
NUMBER OF NAPS                                        ← SectionHeader

┌─ Info card (bg: SLEEP_PURPLE_MUTED) ────────────────────────────┐
│  🌙 6-8 months                                                   │
│  Recommended: 2-3 naps per day                                   │
└──────────────────────────────────────────────────────────────────┘

  [1] [2] [3] [4] [5]               ← pills, 3 pre-selected
                                       recommended count(s) show dot
```

- Info card matches existing age group card pattern (`sleepGoals.ts` data)
- Nap count pills: same `px-5 py-3 rounded-button-lg` as quick goal buttons
- Changing count **regenerates** all wake window slots with new age-appropriate progressive defaults
- If user had custom values, confirmation alert before resetting
- No birth date: show tappable hint "Set birth date for recommendations"

#### Section C: Wake Window Slots (The Schedule Builder)

All slots in one card. Nap slots grouped, bedtime separated by thicker divider:

```
WAKE WINDOWS                                          ← SectionHeader

┌─ Card (bg-surface-card, rounded-card) ──────────────────────────┐
│  🌤 Before Nap 1                                    2h 00m      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  🌤 Before Nap 2                                    2h 20m      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  🌤 Before Nap 3                                    2h 40m      │
│                                                                  │
│  ════════════════════════════════════════════════════════════════ │  ← 2px divider
│                                                                  │
│  🌙 Before Bedtime                                  3h 00m      │  ← purple text
└──────────────────────────────────────────────────────────────────┘
```

**Tapping a row** expands inline to show duration preset pills:

```
│  🌤 Before Nap 1                                    2h 00m  ▾   │
│                                                                  │
│    [1.5h] [2h] [2.5h] [3h]                                      │
│    Custom: [____] min       [Set]                                │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
```

**Preset pills are adaptive to age group:**

| Age Group | Pill Options |
|-----------|-------------|
| 0-2m | [30m] [40m] [50m] [60m] |
| 3-5m | [1h] [1.5h] [1:45] [2h] |
| 6-8m | [1.5h] [2h] [2.5h] [3h] |
| 9-12m | [2h] [2.5h] [3h] [3.5h] |
| 13-18m | [2.5h] [3h] [3.5h] [4h] |
| 19+m | [3h] [4h] [5h] [6h] |

Plus "Custom" → TextInput with `decimal-pad` keyboard + Set button.

- Only one slot expanded at a time
- Nap rows: sun icon (🌤), default text color
- Bedtime row: moon icon (🌙), `SLEEP_PURPLE` label color, 2px separator above, always last, never removable
- Animated expand/collapse via `Animated.View` maxHeight (same pattern as feeding hint)

#### Section D: Reset to Defaults

Only shown when source is "custom":

```
┌─ Card (bg-surface-secondary, tappable) ─────────────────────────┐
│  Use Age-Based Wake Windows                                      │
│  Reset to recommended values for 6-8 months                      │
└──────────────────────────────────────────────────────────────────┘
```

Same pattern as existing "Use Age-Based Goal" in sleep settings.

### Notification Settings Screen (`app/settings/notifications.tsx`)

Simple read-only navigational row between "Timer Alerts" and "Household Activity":

```
[Sleep Reminders]
  ┌─────────────────────────────────────────────────┐
  │ Wake Window Reminders                           │
  │ Configure in Sleep Settings                 ›   │
  └─────────────────────────────────────────────────┘
```

Tapping navigates to Sleep Settings.

### Dashboard Sleep Card Enhancement (`app/(tabs)/index.tsx`)

Sleep card secondary info currently shows "Awake Xh Ym". Enhance:

- **Normal**: "Awake 1h 23m · Nap 2 in 57m"
- **Window expiring**: "Awake 2h 30m · Nap time!"
- **Before bedtime**: "Awake 3h 10m · Bedtime in 20m"
- **No config / no data**: "Awake 1h 23m" (unchanged fallback)

---

## Data Model

### New: `src/types/wake-windows.ts`

```typescript
export interface NapSlotWindow {
  slotIndex: number;        // 0-based: 0 = before nap 1, last = bedtime
  label: string;            // "nap1", "nap2", ..., "bedtime"
  durationMinutes: number;
}

export interface WakeWindowConfig {
  napCount: number;         // number of naps (slots.length - 1)
  slots: NapSlotWindow[];   // ordered, last is always bedtime
  source: "age_based" | "custom";
}
```

### Modify: `src/types/notifications.ts`

```typescript
export type NotificationType = "feeding_reminder" | "timer_alert" | "wake_window_reminder";

export interface WakeWindowReminderSettings {
  enabled: boolean;
  headsUpMinutes: number; // 5, 10, or 15
}

// Add to NotificationSettings:
wakeWindowReminders: WakeWindowReminderSettings;
```

### Modify: `src/contexts/sleep-context.tsx` — SleepState

```typescript
export interface SleepState {
  // ... existing fields ...
  wakeWindowMinutes: number;           // KEEP for backward compat
  wakeWindowConfig: WakeWindowConfig;  // NEW: per-slot configuration
}
```

### Storage keys

- `@wake_window_config:${babyId}` — per-baby wake window config (AsyncStorage)
- `@wake_window_reminder_id:${babyId}` — scheduled notification ID for cancellation

### Database table: `wake_window_preferences`

New table (migration 032) mirroring `feeding_reminder_preferences`:

```sql
CREATE TABLE wake_window_preferences (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  heads_up_minutes INTEGER DEFAULT 10,
  nap_count INTEGER DEFAULT 2,
  wake_window_slots JSONB DEFAULT '[]',  -- Array of {slotIndex, label, durationMinutes}
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, baby_id)
);
```

Add `last_sleep_ended_at` column to `babies` table (like `last_fed_at`), updated by trigger on `sleep_sessions` insert.

RPC function: `get_due_wake_window_reminders()` — returns users/babies where wake window reminder is due.

---

## Algorithm

### Age-Based Default Configuration

New function in `src/utils/sleepGoals.ts`: `getDefaultWakeWindowConfig(birthDate)`

Generates progressive wake windows (linear interpolation from age group min → max):

| Age Group | Naps (avg) | Slots | Window Progression |
|-----------|-----------|-------|-------------------|
| 0-2m | 5 | 6 | 30 → 36 → 42 → 48 → 54 → 60 min |
| 3-5m | 4 | 5 | 60 → 75 → 90 → 105 → 120 min |
| 6-8m | 3 | 4 | 120 → 140 → 160 → 180 min |
| 9-12m | 2 | 3 | 150 → 180 → 210 min |
| 13-18m | 2 | 3 | 180 → 210 → 240 min |
| 19+m | 1 | 2 | 240 → 360 min |

Last slot is always "bedtime".

### Nap Slot Determination

```
on_baby_wakes(wake_time):
  naps_completed_today = count sleep entries today where type="nap" AND endedAt exists
  current_slot = wakeWindowConfig.slots[naps_completed_today]
  if current_slot doesn't exist → use last slot (bedtime fallback)

  reminder_time = wake_time + current_slot.durationMinutes - headsUpMinutes
  if reminder_time > now → schedule notification
```

### Nap vs Bedtime

Last slot always has `label: "bedtime"`. Notification text changes:
- Nap: "Nap Time Soon — Wake window ending in 10 minutes"
- Bedtime: "Bedtime Soon — Wake window for bedtime ending in 10 minutes"

### Triggers

| Event | Action |
|-------|--------|
| Sleep timer stops (baby wakes) | Schedule reminder for next slot |
| Sleep timer starts (baby sleeps) | Cancel pending reminder |
| Manual sleep entry with endedAt | Recalculate and schedule |
| Sleep entry deleted | Recalculate nap count, reschedule |
| App launches/foregrounds | Check if reminder needed |
| Settings changed | Reschedule or cancel |

---

## Notification Execution

### How feeding reminders work today (pattern to follow)

1. User enables feeding reminder → saved to `feeding_reminder_preferences` table
2. Feeding logged → trigger updates `babies.last_fed_at`
3. pg_cron runs `check-feeding-reminders` edge function every 5 minutes
4. Edge function calls `get_due_feeding_reminders()` RPC which finds users where `last_fed_at + interval_hours <= NOW()` and haven't been notified since last feeding
5. Sends direct APNs push using `user_push_tokens.device_token`
6. Updates `last_notified_at`

### Wake window reminders — same pattern

1. User enables wake window reminders → saved to `wake_window_preferences` table (synced from app)
2. Sleep session ends → trigger updates `babies.last_sleep_ended_at`
3. pg_cron runs `check-wake-window-reminders` edge function every 2 minutes (more frequent than feeding since wake windows can be as short as 30 min)
4. Edge function calls `get_due_wake_window_reminders()` RPC:
   ```sql
   -- Find users where:
   -- 1. wake window reminders are enabled
   -- 2. baby's last_sleep_ended_at + slot_duration - heads_up_minutes <= NOW()
   -- 3. haven't been notified since last sleep ended
   -- 4. baby is not currently sleeping (no active timer)
   ```
5. Edge function determines which slot applies (counts today's completed naps from `sleep_sessions`)
6. Sends APNs push with nap vs bedtime text
7. Updates `last_notified_at`

### New edge function: `supabase/functions/check-wake-window-reminders/index.ts`

Follows exact same APNs JWT pattern as `check-feeding-reminders`:
- Uses `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID` env vars (already configured)
- Posts to `https://api.push.apple.com/3/device/{deviceToken}`
- Topic: `com.sofibaby.app`
- Handles 410/400 (invalid token cleanup)
- Uses `user_push_tokens.device_token` (native APNs, not Expo push)

### New migration: `supabase/migrations/032_wake_window_reminders.sql`

```sql
-- 1. wake_window_preferences table
-- 2. RLS policies
-- 3. last_sleep_ended_at column on babies
-- 4. Trigger on sleep_sessions to update last_sleep_ended_at
-- 5. get_due_wake_window_reminders() RPC function
-- 6. pg_cron schedule for check-wake-window-reminders (every 2 minutes)
```

### Local notifications (complement to server-side)

In addition to the server-side cron, schedule a **local notification** when the sleep timer stops (as a fallback for offline/instant scheduling). The edge function handles the case where the app is killed. Both paths set `last_notified_at` to prevent duplicates.

---

## Widget Updates

### Current sleep data sent to widget

```typescript
sleep: {
  lastTime: string | null,
  todayMinutes: number,
  goalMinutes: number,
  lastDurationMinutes: number | null,
  isActive: boolean,
  sleepType: SleepType | null
}
```

### New data to add

```typescript
sleep: {
  // ... existing fields ...
  wakeWindowMinutes: number | null,     // current slot's wake window duration
  wakeWindowSlotLabel: string | null,   // "nap2" or "bedtime"
  lastSleepEndedAt: string | null,      // ISO timestamp of last wake-up
  napCountToday: number,                // completed naps today
}
```

### Widget Swift changes (`targets/widget/index.swift`)

Update `WidgetDataModel` to parse new sleep fields. For sleep widgets, show:

**Small widget (sleep selected):**
- Currently: "Sleep · Xh Ym / Zh goal"
- Enhanced: "Awake 1h 23m · Nap 2 in 57m" (or "Bedtime in 20m")

**Summary widget (large, sleep row):**
- Add wake window progress bar alongside the daily goal progress
- Show next nap/bedtime countdown text

**Lock screen widget (sleep):**
- Show "Nap in Xm" or "Bedtime in Xm" as compact text

The widget reads data from UserDefaults (App Group). The React Native side writes via `ExtensionStorage`. No network calls needed from the widget for this — just display pre-computed data.

### `buildWidgetData()` changes (`src/contexts/widget-context.tsx`)

Add wake window fields to the sleep section of widget data. Compute from sleep context's `getCurrentNapSlot()` and last sleep session.

---

## File-by-File Changes

### Phase 1: Data Model & Storage

| # | File | Action | Changes |
|---|------|--------|---------|
| 1 | `src/types/wake-windows.ts` | NEW | `NapSlotWindow`, `WakeWindowConfig` interfaces |
| 2 | `src/types/notifications.ts` | MODIFY | Add `wake_window_reminder` type, `WakeWindowReminderSettings`, extend `NotificationSettings` |
| 3 | `src/utils/sleepGoals.ts` | MODIFY | Add `getDefaultWakeWindowConfig(birthDate)`, `getPresetPillsForAge(birthDate)` |
| 4 | `src/services/sleep-storage.ts` | MODIFY | Add `getWakeWindowConfig`, `setWakeWindowConfig`, `clearWakeWindowConfig` |

### Phase 2: Database & Edge Function

| # | File | Action | Changes |
|---|------|--------|---------|
| 5 | `supabase/migrations/032_wake_window_reminders.sql` | NEW | `wake_window_preferences` table, `last_sleep_ended_at` column, trigger, RPC, cron job |
| 6 | `supabase/functions/check-wake-window-reminders/index.ts` | NEW | Edge function: query due reminders, count naps, determine slot, send APNs push |

### Phase 3: Notification Infrastructure

| # | File | Action | Changes |
|---|------|--------|---------|
| 7 | `src/constants/notifications.ts` | MODIFY | Add `WAKE_WINDOW_REMINDERS` channel, `WAKE_WINDOW_HEADS_UP_OPTIONS`, default settings, `getWakeWindowReminderMessage()` |
| 8 | `src/utils/notification-scheduler.ts` | MODIFY | Add `calculateWakeWindowReminder()` |
| 9 | `src/services/notification-storage.ts` | MODIFY | Add wake window reminder notification ID methods |
| 10 | `src/services/notification-service.ts` | MODIFY | Add Android channel for wake window reminders |
| 11 | `src/services/push-token-service.ts` | MODIFY | Add `upsertWakeWindowPreference()` to sync settings to Supabase |

### Phase 4: Context & Hook Integration

| # | File | Action | Changes |
|---|------|--------|---------|
| 12 | `src/contexts/sleep-context.tsx` | MODIFY | Add `wakeWindowConfig` state, `SET_WAKE_WINDOW_CONFIG` action, `getCompletedNapsToday()`, `getCurrentNapSlot()`, `setCustomWakeWindows()`, `resetToAgeBasedWakeWindows()`, `setNapCount()`. Update `getWakeWindowProgress()` to use per-slot duration. |
| 13 | `src/contexts/notification-context.tsx` | MODIFY | Add `scheduleWakeWindowReminder()`, `cancelWakeWindowReminder()`. Handle rescheduling on settings change. |
| 14 | `src/hooks/useWakeWindowReminderIntegration.ts` | NEW | Watches sleep state, determines nap slot, schedules/cancels local notifications. Syncs preferences to Supabase. |

### Phase 5: UI

| # | File | Action | Changes |
|---|------|--------|---------|
| 15 | `app/sleep/settings.tsx` | MODIFY | Add full Wake Windows section: reminder toggle + heads-up pills, nap count selector, per-slot duration editors with adaptive preset pills, bedtime visual distinction, reset to age-based, permission warning |
| 16 | `app/settings/notifications.tsx` | MODIFY | Add read-only navigational row "Wake Window Reminders → Configure in Sleep Settings" |
| 17 | `app/(tabs)/index.tsx` | MODIFY | Enhance sleep card secondary info with nap/bedtime countdown |

### Phase 6: Watcher & Wiring

| # | File | Action | Changes |
|---|------|--------|---------|
| 18 | `app/_layout.tsx` | MODIFY | Mount `WakeWindowReminderWatcher` component |

### Phase 7: Widget

| # | File | Action | Changes |
|---|------|--------|---------|
| 19 | `src/contexts/widget-context.tsx` | MODIFY | Add wake window fields to `buildWidgetData()` sleep section |
| 20 | `targets/widget/index.swift` | MODIFY | Parse new sleep fields in `WidgetDataModel`, show wake window countdown in sleep widgets (small, summary, lock screen) |

### Phase 8: i18n

| # | File | Action | Changes |
|---|------|--------|---------|
| 21 | `src/i18n/locales/en.json` | MODIFY | Add all wake window translation keys |
| 22 | `src/i18n/locales/sr.json` | MODIFY | Serbian translations |
| 23 | `src/i18n/locales/es.json` | MODIFY | Spanish translations |

### Phase 9: Tests

| # | File | Action | Changes |
|---|------|--------|---------|
| 24 | `src/utils/__tests__/sleepGoals.test.ts` | MODIFY | Tests for `getDefaultWakeWindowConfig`, `getPresetPillsForAge` |
| 25 | `src/utils/__tests__/notification-scheduler.test.ts` | MODIFY | Tests for `calculateWakeWindowReminder` |
| 26 | `src/hooks/__tests__/useWakeWindowReminderIntegration.test.ts` | NEW | Hook integration tests |

---

## Edge Cases

| Case | Handling |
|------|----------|
| No birth date | Fall back to 2-nap config with 150min windows. Hint to set birth date. |
| No sleep data yet | No reminder scheduled. Dashboard shows normal "Awake" text. |
| Missed nap (window expired) | Notification fires normally. Progress shows 100%+. No nagging. |
| Short nap (<10 min) | Counts as completed nap, advances slot. Can delete if accidental. |
| Crossing midnight | Timer based on timestamps. "Today's naps" count resets at midnight. |
| Night sleep ends in morning | Triggers slot 0 (before nap 1) — shortest window, correct. |
| Baby sleeps before reminder | `startSleep` cancels pending local notification. Edge function checks for active timer. |
| App killed | Server-side cron handles reminder delivery via APNs push. |
| App restart | On launch, check last sleep endedAt, schedule local notification if window hasn't expired. |
| Multiple babies | Config is per-baby. Reminders track selectedBaby. |
| Quiet hours | `getDelayedNotificationTime()` handles local notifications. Edge function should also check. |
| Permissions denied | Toggle disabled. Amber warning card with link to device settings. |
| Duplicate notifications | Both local and server set `last_notified_at`. Edge function skips if already notified since last sleep. Local notification cancelled when server sends. |
| Nap count changed | Regenerate all slots with new defaults. Confirmation if custom values exist. |

---

## Existing Code to Reuse

| Utility | File |
|---------|------|
| `getSleepAgeGroupForBaby(birthDate)` | `src/utils/sleepGoals.ts` |
| `getWakeWindowForAge(birthDate)` | `src/utils/sleepGoals.ts` |
| `getNapsForAge(birthDate)` | `src/utils/sleepGoals.ts` |
| `SLEEP_AGE_GROUPS` | `src/utils/sleepGoals.ts` |
| `isInQuietHours()` | `src/utils/notification-scheduler.ts` |
| `getDelayedNotificationTime()` | `src/utils/notification-scheduler.ts` |
| `NotificationService.scheduleNotification()` | `src/services/notification-service.ts` |
| `NotificationStorageService` | `src/services/notification-storage.ts` |
| `upsertFeedingReminderPreference()` pattern | `src/services/push-token-service.ts` |
| APNs JWT construction | `supabase/functions/check-feeding-reminders/index.ts` |
| `get_due_feeding_reminders()` RPC pattern | `supabase/migrations/031*` |
| `SectionHeader`, `SettingsRow` | `app/settings/notifications.tsx` |
| `SLEEP_PURPLE`, `SLEEP_PURPLE_MUTED` | `app/sleep/settings.tsx` |
| `buildWidgetData()` | `src/contexts/widget-context.tsx` |
| `WidgetDataModel` | `targets/widget/index.swift` |

---

## Verification

1. **Branch**: Create `feature/wake-window-reminders` from main
2. **Typecheck**: `npm run typecheck`
3. **Unit tests**: `npm run test:unit`
4. **Manual testing**:
   - Open Sleep Settings → verify age-based wake windows auto-populate
   - Change nap count → verify slots regenerate with progressive defaults
   - Tap a slot → verify adaptive preset pills appear for age group
   - Customize a slot duration → verify "custom" source, persistence after restart
   - Reset to age-based → verify defaults restore
   - Enable reminder toggle → verify heads-up time pills appear
   - Test with permissions denied → verify amber card, disabled toggle
   - Start sleep timer → verify any pending reminder cancels
   - Stop sleep timer → verify local reminder schedules for correct slot
   - Wait for reminder → verify notification text (nap vs bedtime)
   - Kill app → verify server-side cron sends push after wake window expires
   - Check dashboard sleep card → verify countdown text
   - Check widget → verify wake window countdown displays
   - Notification settings → verify navigational row links to sleep settings
   - Test quiet hours → verify reminder delays appropriately
5. **Edge function**: Deploy `check-wake-window-reminders`, verify cron triggers and APNs delivery
6. **Migration**: Apply migration 032, verify table/trigger/RPC created correctly
