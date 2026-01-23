# Implementation Plan: New Features for Baby Tracker

> **Features:** Health Tracking, Dashboard Customization, Quick-Log, Milestones, Night Mode Redesign
> **Created:** January 2026

---

## Overview

This plan organizes 5 feature sets into separate branches that can be developed independently. Dependencies are noted where they exist.

| Branch | Feature | Dependencies |
|--------|---------|--------------|
| `feature/health-tracking` | Medication, Temperature, Vaccine | None |
| `feature/dashboard-customization` | Card reorder/hide | None |
| `feature/quick-log` | Gestures, quick-log modals | Dashboard customization (optional) |
| `feature/milestones` | Developmental milestones with photos | None |
| `feature/night-mode-redesign` | Improved night mode UI | None |

---

## Feature 1: Health Tracking

**Branch:** `feature/health-tracking`

### Scope
- Medication tracking (name, dosage, frequency, reminders)
- Temperature logging (value, unit, method, symptoms)
- Vaccine records (vaccine name, date, batch, next due)

### Data Models

```typescript
// src/constants/health.ts
type MedicationFrequency = "once" | "twice_daily" | "three_times_daily" | "every_4_hours" | "every_6_hours" | "as_needed";
type DosageUnit = "ml" | "mg" | "drops" | "tablets" | "tsp";
type TemperatureUnit = "fahrenheit" | "celsius";
type TemperatureMethod = "oral" | "ear" | "forehead" | "rectal" | "armpit";

// Storage interfaces follow existing patterns
interface StoredMedicationEntry {
  id: string;
  babyId: string;
  medicationName: string;
  dosageAmount: number;
  dosageUnit: DosageUnit;
  frequency: MedicationFrequency;
  administeredAt: string;  // ISO string
  scheduledAt?: string;    // ISO string
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}

interface StoredTemperatureEntry {
  id: string;
  babyId: string;
  temperature: number;
  unit: TemperatureUnit;
  method: TemperatureMethod;
  recordedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}

interface StoredVaccineEntry {
  id: string;
  babyId: string;
  vaccineName: string;
  isCustomVaccine: boolean;
  administeredAt: string;
  batchNumber?: string;
  administrator?: string;
  location?: string;
  nextDueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}
```

### Files to Create

```
src/
├── constants/health.ts                 # Types and constants
├── services/
│   ├── medication-storage.ts           # CRUD operations
│   ├── medication-storage-sync.ts      # Sync transforms
│   ├── temperature-storage.ts
│   ├── temperature-storage-sync.ts
│   ├── vaccine-storage.ts
│   └── vaccine-storage-sync.ts
├── contexts/
│   ├── medication-context.tsx          # State management
│   ├── temperature-context.tsx
│   └── vaccine-context.tsx
├── utils/
│   └── health-statistics.ts            # Stats calculations
├── components/
│   ├── HealthDashboardCard.tsx         # Expandable health card
│   └── TemperatureChart.tsx            # Temp trend visualization
app/
├── medication/
│   ├── _layout.tsx
│   ├── index.tsx                       # Log medication
│   └── manual.tsx                      # Past entry
├── temperature/
│   ├── _layout.tsx
│   ├── index.tsx                       # Log temperature
│   └── manual.tsx
├── vaccine/
│   ├── _layout.tsx
│   ├── index.tsx                       # Log vaccine
│   └── history.tsx                     # Vaccine schedule view
└── edit/
    ├── medication.tsx
    ├── temperature.tsx
    └── vaccine.tsx
```

### Files to Modify

- `src/constants/activities.ts` - Add health activity types + colors
- `src/services/sync/schema.ts` - Add health tables
- `app/_layout.tsx` - Add providers
- `app/(tabs)/index.tsx` - Add HealthDashboardCard
- `app/(tabs)/timeline.tsx` - Transform health entries
- `app/(tabs)/statistics.tsx` - Health statistics section
- `src/constants/notifications.ts` - Add medication reminder channel

### Activity Colors
- Medication: `#E91E63` (pink)
- Temperature: `#FF5722` (deep orange)
- Vaccine: `#4CAF50` (green)

### Common Vaccines List
```typescript
const COMMON_VACCINES = [
  "Hepatitis B",
  "DTaP",
  "Hib",
  "Polio (IPV)",
  "Pneumococcal (PCV)",
  "Rotavirus",
  "MMR",
  "Varicella",
  "Hepatitis A",
  "Influenza",
  "COVID-19",
  "Other"
];
```

### Implementation Order
1. Create types and constants (`src/constants/health.ts`)
2. Create storage services (follow `feeding-storage.ts` pattern)
3. Create contexts (follow `feeding-context.tsx` pattern)
4. Create entry screens
5. Create edit screens
6. Add to dashboard as expandable Health card
7. Integrate with timeline
8. Add medication reminders to notification system
9. Add to statistics

---

## Feature 2: Dashboard Customization

**Branch:** `feature/dashboard-customization`

### Scope
- Reorder dashboard cards via drag-and-drop
- Show/hide cards based on user preference
- Persist configuration per user
- Settings UI for customization

### Data Model

```typescript
// src/services/dashboard-config-storage.ts
interface DashboardCardConfig {
  activity: ActivityType;
  visible: boolean;
  order: number;
}

interface DashboardConfig {
  version: number;
  cards: DashboardCardConfig[];
  lastModified: string;
}

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  version: 1,
  cards: [
    { activity: "feeding", visible: true, order: 0 },
    { activity: "sleep", visible: true, order: 1 },
    { activity: "diaper", visible: true, order: 2 },
    { activity: "pumping", visible: true, order: 3 },
    { activity: "tummyTime", visible: true, order: 4 },
    { activity: "growth", visible: true, order: 5 },
  ],
  lastModified: new Date().toISOString(),
};
```

### Files to Create

```
src/
├── services/dashboard-config-storage.ts
├── contexts/dashboard-config-context.tsx
├── components/DraggableDashboardGrid.tsx
app/
└── settings/dashboard.tsx              # Customization UI
```

### Files to Modify

- `app/(tabs)/index.tsx` - Refactor from hardcoded to data-driven
- `app/settings/index.tsx` - Add link to dashboard settings
- `app/_layout.tsx` - Add DashboardConfigProvider

### Key Changes to `app/(tabs)/index.tsx`

**Current (hardcoded):**
```tsx
<View className="flex-row gap-3">
  <DashboardCard activity="feeding" ... />
  <DashboardCard activity="sleep" ... />
</View>
// ... repeated for all rows
```

**New (data-driven):**
```tsx
const { visibleCards } = useDashboardConfig();

// Group cards into rows of 2
const rows = useMemo(() => {
  const result: DashboardCardConfig[][] = [];
  for (let i = 0; i < visibleCards.length; i += 2) {
    result.push(visibleCards.slice(i, i + 2));
  }
  return result;
}, [visibleCards]);

return (
  <View className="gap-3">
    {rows.map((row, rowIndex) => (
      <View key={rowIndex} className="flex-row gap-3">
        {row.map((cardConfig) => (
          <DashboardCardRenderer key={cardConfig.activity} activity={cardConfig.activity} />
        ))}
        {row.length === 1 && <View className="flex-1" />}
      </View>
    ))}
  </View>
);
```

### Settings Screen UI

```
Dashboard Customization

[Show/Hide Cards]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤱 Feeding                [✓]
😴 Sleep                  [✓]
🚼 Diaper                 [✓]
🍼 Pumping                [ ]  ← Hidden
💪 Tummy Time             [✓]
📏 Growth                 [✓]

[Card Order]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
≡ 🤱 Feeding
≡ 😴 Sleep
≡ 🚼 Diaper
≡ 💪 Tummy Time
≡ 📏 Growth

[Reset to Default]
```

### Implementation Order
1. Create storage service (follow `theme-storage.ts` pattern)
2. Create context with default config
3. Refactor dashboard to use config (without drag initially)
4. Create settings screen with toggles
5. Add drag-and-drop reordering (using react-native-reanimated)
6. Add reset to default functionality

---

## Feature 3: Quick-Log Improvements

**Branch:** `feature/quick-log`

### Scope
- Long-press on card opens quick-log modal
- Swipe gestures for common actions
- Haptic feedback
- Reduce taps for most common activities

### Minimal Data Per Activity

| Activity | Quick-Log Data | Full Form |
|----------|---------------|-----------|
| Feeding (Breast) | Side only | Duration, notes |
| Feeding (Bottle) | Amount + type | Notes |
| Diaper | Type (wet/dirty/mixed) | Stool color, notes |
| Sleep | Start timer | Type, notes |
| Pumping | Side only | Volume, notes |
| Tummy Time | Start timer | Notes |

### Files to Create

```
src/
├── components/
│   ├── QuickLogModal.tsx
│   └── QuickLogContent/
│       ├── QuickFeedingContent.tsx
│       ├── QuickDiaperContent.tsx
│       ├── QuickSleepContent.tsx
│       ├── QuickPumpingContent.tsx
│       └── QuickTummyTimeContent.tsx
├── utils/haptics.ts
```

### Files to Modify

- `src/components/DashboardCard.tsx` - Add gesture handlers
- `app/(tabs)/index.tsx` - Wire up quick log modal
- `package.json` - Add `expo-haptics` if not present

### Gesture Implementation

```typescript
// In DashboardCard.tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface DashboardCardProps {
  // existing props...
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const longPressGesture = Gesture.LongPress()
  .minDuration(500)
  .onStart(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runOnJS(onLongPress)?.();
  });

const panGesture = Gesture.Pan()
  .onEnd((e) => {
    if (e.translationX < -50) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      runOnJS(onSwipeLeft)?.();
    }
    if (e.translationX > 50) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      runOnJS(onSwipeRight)?.();
    }
  });

const composedGesture = Gesture.Race(panGesture, longPressGesture);
```

### Swipe Actions

| Activity | Swipe Left | Swipe Right |
|----------|-----------|-------------|
| Feeding | Quick bottle log | Start breastfeeding (suggested side) |
| Diaper | Log wet diaper | Log dirty diaper |
| Sleep | Log "woke up now" | Start sleep timer |
| Pumping | Quick log (last side) | Start pumping timer |
| Tummy Time | Log 5-min session | Start timer |

### Quick Diaper Modal Example

```tsx
function QuickDiaperContent({ onLog, onClose }) {
  return (
    <View className="p-4">
      <Text className="text-lg font-semibold mb-4">Quick Diaper Log</Text>

      <View className="flex-row gap-3">
        <QuickActionButton
          icon="💧"
          label="Wet"
          onPress={() => {
            onLog({ type: "diaper", diaperType: "wet" });
            onClose();
          }}
        />
        <QuickActionButton
          icon="💩"
          label="Dirty"
          onPress={() => {
            onLog({ type: "diaper", diaperType: "dirty" });
            onClose();
          }}
        />
        <QuickActionButton
          icon="🚼"
          label="Both"
          onPress={() => {
            onLog({ type: "diaper", diaperType: "mixed" });
            onClose();
          }}
        />
      </View>

      <Pressable onPress={onClose} className="mt-4">
        <Text className="text-center text-content-secondary">More options...</Text>
      </Pressable>
    </View>
  );
}
```

### Implementation Order
1. Add haptics utility
2. Create QuickLogModal component shell
3. Create quick content components per activity
4. Add long-press handler to DashboardCard
5. Add swipe gestures
6. Wire up in dashboard
7. Test on devices

---

## Feature 4: Developmental Milestones

**Branch:** `feature/milestones`

### Scope
- Track milestones (first smile, first steps, etc.)
- Photo attachments
- Predefined milestones by age range
- Custom milestones
- Gallery view ("Baby Firsts")
- Timeline integration

### Data Models

```typescript
// src/types/milestones.ts
type MilestoneCategory = "motor" | "language" | "social" | "cognitive" | "custom";
type AgeRange = "0-3m" | "3-6m" | "6-9m" | "9-12m" | "12-18m" | "18-24m" | "24m+";

interface PredefinedMilestone {
  id: string;
  titleKey: string;           // i18n key
  descriptionKey?: string;
  category: MilestoneCategory;
  ageRange: AgeRange;
  icon: string;
  sortOrder: number;
}

interface StoredMilestoneEntry {
  id: string;
  babyId: string;
  predefinedMilestoneId?: string;
  title: string;
  category: MilestoneCategory;
  achievedAt: string;
  photoUri?: string;
  notes?: string;
  loggedBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Predefined Milestones

```typescript
// src/data/predefined-milestones.ts
export const PREDEFINED_MILESTONES: PredefinedMilestone[] = [
  // 0-3 months
  { id: 'first-smile', titleKey: 'milestones.firstSmile', category: 'social', ageRange: '0-3m', icon: '😊', sortOrder: 1 },
  { id: 'holds-head', titleKey: 'milestones.holdsHead', category: 'motor', ageRange: '0-3m', icon: '💪', sortOrder: 2 },
  { id: 'first-coo', titleKey: 'milestones.firstCoo', category: 'language', ageRange: '0-3m', icon: '🗣️', sortOrder: 3 },
  { id: 'tracks-objects', titleKey: 'milestones.tracksObjects', category: 'cognitive', ageRange: '0-3m', icon: '👀', sortOrder: 4 },

  // 3-6 months
  { id: 'rolls-over', titleKey: 'milestones.rollsOver', category: 'motor', ageRange: '3-6m', icon: '🔄', sortOrder: 1 },
  { id: 'first-laugh', titleKey: 'milestones.firstLaugh', category: 'social', ageRange: '3-6m', icon: '😂', sortOrder: 2 },
  { id: 'reaches-objects', titleKey: 'milestones.reachesObjects', category: 'motor', ageRange: '3-6m', icon: '🤲', sortOrder: 3 },

  // 6-9 months
  { id: 'sits-independently', titleKey: 'milestones.sitsIndependently', category: 'motor', ageRange: '6-9m', icon: '🧒', sortOrder: 1 },
  { id: 'first-babble', titleKey: 'milestones.firstBabble', category: 'language', ageRange: '6-9m', icon: '👶', sortOrder: 2 },
  { id: 'stranger-anxiety', titleKey: 'milestones.strangerAnxiety', category: 'social', ageRange: '6-9m', icon: '😟', sortOrder: 3 },

  // 9-12 months
  { id: 'first-crawl', titleKey: 'milestones.firstCrawl', category: 'motor', ageRange: '9-12m', icon: '🐛', sortOrder: 1 },
  { id: 'first-word', titleKey: 'milestones.firstWord', category: 'language', ageRange: '9-12m', icon: '💬', sortOrder: 2 },
  { id: 'waves-bye', titleKey: 'milestones.wavesBye', category: 'social', ageRange: '9-12m', icon: '👋', sortOrder: 3 },
  { id: 'pincer-grasp', titleKey: 'milestones.pincerGrasp', category: 'motor', ageRange: '9-12m', icon: '🤏', sortOrder: 4 },

  // 12-18 months
  { id: 'first-steps', titleKey: 'milestones.firstSteps', category: 'motor', ageRange: '12-18m', icon: '🚶', sortOrder: 1 },
  { id: 'more-words', titleKey: 'milestones.moreWords', category: 'language', ageRange: '12-18m', icon: '📖', sortOrder: 2 },
  { id: 'follows-directions', titleKey: 'milestones.followsDirections', category: 'cognitive', ageRange: '12-18m', icon: '👆', sortOrder: 3 },

  // 18-24 months
  { id: 'runs', titleKey: 'milestones.runs', category: 'motor', ageRange: '18-24m', icon: '🏃', sortOrder: 1 },
  { id: 'two-word-phrases', titleKey: 'milestones.twoWordPhrases', category: 'language', ageRange: '18-24m', icon: '💭', sortOrder: 2 },
  { id: 'pretend-play', titleKey: 'milestones.pretendPlay', category: 'social', ageRange: '18-24m', icon: '🎭', sortOrder: 3 },

  // 24+ months
  { id: 'jumps', titleKey: 'milestones.jumps', category: 'motor', ageRange: '24m+', icon: '⬆️', sortOrder: 1 },
  { id: 'sentences', titleKey: 'milestones.sentences', category: 'language', ageRange: '24m+', icon: '📝', sortOrder: 2 },
];
```

### Files to Create

```
src/
├── types/milestones.ts
├── data/predefined-milestones.ts
├── constants/milestones.ts             # Colors, category config
├── services/
│   ├── milestone-storage.ts
│   └── milestone-storage-sync.ts
├── contexts/milestone-context.tsx
├── utils/milestone-age.ts              # Age calculation utilities
├── components/
│   ├── MilestoneCard.tsx
│   ├── MilestoneGalleryItem.tsx
│   ├── MilestoneProgress.tsx
│   ├── MilestoneSelector.tsx
│   └── MilestoneCategoryFilter.tsx
app/
├── milestone/
│   ├── _layout.tsx
│   ├── index.tsx                       # List view with categories
│   ├── gallery.tsx                     # Photo gallery ("Baby Firsts")
│   ├── add.tsx                         # Add milestone
│   └── [id].tsx                        # Detail view
└── edit/milestone.tsx
```

### Files to Modify

- `src/constants/activities.ts` - Add "milestone" to ActivityType
- `app/(tabs)/timeline.tsx` - Include milestones
- `app/(tabs)/index.tsx` - Add milestone dashboard card
- `app/_layout.tsx` - Add MilestoneProvider
- `src/services/sync/schema.ts` - Add milestones table
- `src/i18n/locales/en.json` - Add milestone translations

### Activity Color
- Milestone: `#F39C12` (golden yellow - achievement/celebration)

### Photo Storage
- Local: `${FileSystem.documentDirectory}milestones/${id}.jpg`
- Sync: Upload to Supabase Storage, store URL in `photo_url` field

### UI Flow

**Main Milestone Screen:**
```
[Category Tabs: All | Motor | Language | Social | Cognitive | Custom]

[Progress Summary Card]
┌─────────────────────────────────┐
│ 🎯 12 of 28 milestones achieved │
│ [████████░░░░░░░░░] 43%         │
└─────────────────────────────────┘

[Milestone List]
┌─────────────────────────────────┐
│ [Photo] First Smile        ✓   │
│         Achieved Jan 15, 2024   │
├─────────────────────────────────┤
│ [Photo] Holds Head Up      ✓   │
│         Achieved Jan 22, 2024   │
├─────────────────────────────────┤
│ [   ]   Rolls Over         ○   │
│         Expected: 3-6 months    │
└─────────────────────────────────┘

[+ Add Milestone] (FAB)
```

**Gallery View ("Baby Firsts"):**
```
┌─────┬─────┬─────┐
│ 📷  │ 📷  │ 📷  │
│Smile│Steps│Word │
├─────┼─────┼─────┤
│ 📷  │ 📷  │ 📷  │
│Crawl│Wave │Laugh│
└─────┴─────┴─────┘
```

### Implementation Order
1. Create types and predefined milestones data
2. Create storage service
3. Create context
4. Create list screen with category tabs
5. Create add screen with milestone selector + photo capture
6. Create gallery view
7. Create detail/edit screens
8. Add to timeline
9. Add dashboard card

---

## Feature 5: Night Mode Redesign

**Branch:** `feature/night-mode-redesign`

### Current Problems

The current night mode is a simple overlay:
```tsx
// NightModeOverlay.tsx (current)
<View pointerEvents="none" className="absolute inset-0 bg-night-bg/50" />
```

Issues:
1. **Too red/bright** - Uses `#ef4444` range (harsh red)
2. **Overlay-only approach** - No component-level theming
3. **Poor contrast** - Some text becomes unreadable
4. **No warmth** - Should use amber/orange tones for blue light reduction, not pure red

### Design Goals

1. **Warm amber tones** instead of harsh red (actually reduce blue light)
2. **Component-level night colors** (not just overlay)
3. **Proper contrast** for readability
4. **Dimmed but usable** UI

### New Night Mode Color Palette

```javascript
// Replace in tailwind.config.js
night: {
  // Warm amber palette (not harsh red)
  bg: "#0D0906",              // Very dark warm brown
  surface: "#1A1410",         // Dark warm surface
  "surface-elevated": "#241D17",
  card: "#1F1812",

  text: {
    primary: "#E8DDD4",       // Warm off-white
    secondary: "#A89888",     // Muted warm gray
    tertiary: "#6B5D52",      // Dim warm gray
  },

  accent: "#D4A574",          // Warm amber accent
  border: "#3D3228",          // Subtle warm border

  // Activity colors for night (dimmed warm versions)
  activity: {
    feeding: "#5A7832",       // Dimmed sage
    sleep: "#4A4170",         // Dimmed lavender
    diaper: "#8B5A5A",        // Dimmed coral
    pumping: "#5A6A8A",       // Dimmed blue
    growth: "#006B52",        // Dimmed teal
    tummyTime: "#9A5A1A",     // Dimmed amber
  }
}
```

### Implementation Approach

**Recommended: Component-level theming**

Instead of just an overlay, components should check `isNight` and apply appropriate colors:

```typescript
// In DashboardCard.tsx
const { isNight, isDark } = useTheme();

const getBgColor = () => {
  if (isNight) return nightActivityColors[activity].muted;
  if (isDark) return config.mutedBgDark;
  return config.mutedBg;
};

const getTextColor = () => {
  if (isNight) return "#E8DDD4"; // Warm off-white
  if (isDark) return "#FFFFFF";
  return "#1A1A1A";
};
```

### Files to Modify

1. `tailwind.config.js` - Replace night colors with warm amber palette
2. `src/constants/design-tokens.ts` - Add night mode tokens
3. `src/components/NightModeOverlay.tsx` - Either improve or remove entirely
4. `src/components/DashboardCard.tsx` - Add night-specific colors
5. `src/components/TimelineItem.tsx` - Add night-specific colors
6. `src/components/StatCard.tsx` - Add night-specific colors (if exists)
7. Key screens that need night mode awareness

### Implementation Order
1. Design warm amber color palette
2. Update tailwind.config.js with new night colors
3. Add night color constants/design tokens
4. Update DashboardCard to use night-specific activity colors
5. Update TimelineItem
6. Update other key components
7. Improve or remove NightModeOverlay
8. Test contrast and readability across all screens

---

## Verification Plan

### Health Tracking
- [ ] Log medication with reminder, verify notification fires
- [ ] Log temperature, see in timeline
- [ ] Log vaccine, see in vaccine history
- [ ] Edit/delete health entries
- [ ] Health card shows on dashboard
- [ ] Health stats appear in statistics
- [ ] Check sync between devices

### Dashboard Customization
- [x] Reorder cards via drag-and-drop
- [x] Hide a card, verify it disappears from dashboard
- [x] Show hidden card, verify it reappears
- [x] Reset to default, verify original order restored
- [x] Reopen app, verify config persists
- [ ] New activities (health, milestones) appear in config

### Quick-Log
- [ ] Long-press card opens quick-log modal
- [ ] Log diaper via quick modal (1 tap after long-press)
- [ ] Log feeding via quick modal
- [ ] Swipe left/right triggers correct action
- [ ] Haptic feedback fires on gestures
- [ ] Quick-logged entries appear in timeline

### Milestones
- [ ] Add predefined milestone with photo
- [ ] Add custom milestone
- [ ] View milestone list by category
- [ ] View gallery ("Baby Firsts")
- [ ] See milestones in timeline
- [ ] Edit milestone
- [ ] Delete milestone
- [ ] Dashboard card shows recent/suggested milestone

### Night Mode
- [ ] Enable night mode
- [ ] Verify warm amber tones (not harsh red)
- [ ] All text readable with proper contrast
- [ ] Activity cards have appropriate dimmed colors
- [ ] Timeline readable
- [ ] Stats readable
- [ ] Toggle off, verify normal colors return
- [ ] Auto-enable works during night hours (22:00-05:00)

---

## Recommended Implementation Order

1. **Dashboard Customization** - Foundation for data-driven cards, helps with all subsequent features
2. **Health Tracking** - High user value, follows established patterns closely
3. **Milestones** - Can be developed in parallel with health tracking
4. **Quick-Log** - Benefits from dashboard customization being complete
5. **Night Mode Redesign** - Polish feature, can be done anytime

---

## Summary

| Feature | New Files | Modified Files | Complexity |
|---------|-----------|----------------|------------|
| Health Tracking | ~15 | ~8 | Medium-High |
| Dashboard Customization | ~4 | ~4 | Medium |
| Quick-Log | ~8 | ~2 | Medium |
| Milestones | ~12 | ~6 | Medium-High |
| Night Mode Redesign | ~1 | ~6 | Low-Medium |

---

## Reference Files (Patterns to Follow)

- `src/services/feeding-storage.ts` - Storage service pattern
- `src/contexts/feeding-context.tsx` - Context + reducer pattern
- `src/constants/activities.ts` - Activity type and config pattern
- `src/services/theme-storage.ts` - Simple preference storage pattern
- `app/diaper/index.tsx` - Entry screen UI pattern
- `app/edit/feeding.tsx` - Edit screen pattern
