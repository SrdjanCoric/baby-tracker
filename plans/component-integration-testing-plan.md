# Component & Integration Testing Plan

## Overview

This document outlines all component and integration tests to be implemented for the baby-tracker app. Tests use **Jest + React Native Testing Library** (configured in `jest.config.js` and `jest.setup.js`).

**Test file naming:** `*.component.test.tsx` for component tests, `*.integration.test.tsx` for integration tests.

---

## Part 1: Component Tests

### Already Implemented (3 components)
- [x] `src/components/Button.component.test.tsx` - 22 tests
- [x] `src/components/TimerDisplay.component.test.tsx` - 22 tests
- [x] `app/settings/theme.component.test.tsx` - 11 tests

---

### 1.1 Card Component
**File:** `src/components/Card.component.test.tsx`
**Source:** `src/components/Card.tsx`

#### Card (View wrapper)
| Test | Description |
|------|-------------|
| renders children | Verify children content is displayed |
| applies default variant | Default variant has `bg-white` class |
| applies elevated variant | Elevated variant has `shadow-lg` class |
| applies outlined variant | Outlined variant has `border` class |
| merges custom className | Custom className is applied alongside variant |
| forwards ref | ref is forwarded to View |

#### PressableCard
| Test | Description |
|------|-------------|
| renders children | Verify children content is displayed |
| calls onPress when pressed | fireEvent.press triggers onPress callback |
| has button accessibility role | accessibilityRole is "button" |
| applies default variant (elevated) | Default is elevated with shadow |
| applies outlined variant | Has border styles |
| forwards ref | ref is forwarded to View |

---

### 1.2 Input Component
**File:** `src/components/Input.component.test.tsx`
**Source:** `src/components/Input.tsx`

| Test | Description |
|------|-------------|
| renders without label | Renders TextInput when no label provided |
| renders with label | Label text is displayed above input |
| renders with error state | Error message displayed, red border styling |
| renders with hint | Hint text displayed below input |
| renders with left icon | Left icon is visible |
| renders with right icon | Right icon is visible |
| handles focus state | Border color changes on focus |
| handles blur state | Border returns to normal on blur |
| handles disabled state | Input is not editable when disabled |
| shows disabled styling | Gray background when disabled |
| forwards value changes | onChangeText receives text input |
| has accessibility label from label prop | accessibilityLabel matches label |
| has accessibility state for disabled | accessibilityState.disabled is true when disabled |
| applies custom className | className is merged with container |

---

### 1.3 DashboardCard Component
**File:** `src/components/DashboardCard.component.test.tsx`
**Source:** `src/components/DashboardCard.tsx`

| Test | Description |
|------|-------------|
| renders activity icon | Correct emoji for each activity type (feeding🤱, sleep😴, diaper🚼, pumping🫙, growth📏, tummyTime💪) |
| renders label | Activity label is displayed |
| renders timeSince | Time since value is displayed |
| renders subtitle when provided | Subtitle text appears |
| renders secondaryInfo when provided | Secondary info text appears |
| shows active state styling | Border appears when isActive=true |
| shows active indicator dot | Dot visible when isActive=true |
| shows activeLabel when active | activeLabel text replaces timeSince |
| calls onPress when card pressed | Card press triggers onPress |
| calls onActionPress when action button pressed | Action button press triggers onActionPress |
| action button shows stop icon when active | "⏹" when isActive |
| action button shows "+" when not active | "+" when not active |
| renders progress bar when progress provided | Progress bar visible with correct width |
| progress bar shows 100% styling | Green color when progress >= 100 |
| has correct accessibility label | Includes label and time info |
| has button accessibility role | accessibilityRole is "button" |

---

### 1.4 TodaySummary Component
**File:** `src/components/TodaySummary.component.test.tsx`
**Source:** `src/components/TodaySummary.tsx`

| Test | Description |
|------|-------------|
| renders "Today" header | Header text is displayed |
| renders feedingTotal | Feeding count/total displayed |
| renders napCount | Nap count displayed |
| renders diaperCount | Diaper count displayed |
| renders sleepTotal when provided | Sleep total displayed |
| hides sleepTotal when not provided | Sleep section not rendered |
| uses singular "Feeding" for count of 1 | Label changes based on count |
| uses plural "Feedings" for count > 1 | Label changes based on count |
| uses singular "Nap" for count of 1 | Label changes based on count |
| uses singular "Diaper" for count of 1 | Label changes based on count |
| renders dividers between stats | Visual dividers present |
| applies correct colors to stats | Each stat has its activity color |

---

### 1.5 FeedingTypeMenu Component
**File:** `src/components/FeedingTypeMenu.component.test.tsx`
**Source:** `src/components/FeedingTypeMenu.tsx`

| Test | Description |
|------|-------------|
| renders when visible=true | Modal content visible |
| does not render when visible=false | Modal not visible |
| renders breastfeeding option | 🤱 Breastfeeding option visible |
| renders bottle option | 🍼 Bottle option visible |
| renders solids option | 🥣 Solid Food option visible |
| renders cancel button | Cancel button visible |
| calls onSelect with "breastfeed" | Breastfeed option triggers correct callback |
| calls onSelect with "bottle" | Bottle option triggers correct callback |
| calls onSelect with "solids" | Solids option triggers correct callback |
| calls onClose when cancel pressed | Cancel triggers onClose |
| calls onClose when backdrop pressed | Backdrop press triggers onClose |
| renders option descriptions | Each option has description text |

---

### 1.6 BabySelector Component
**File:** `src/components/BabySelector.component.test.tsx`
**Source:** `src/components/BabySelector.tsx`

**Mock required:** `@/contexts` (useBaby hook)

| Test | Description |
|------|-------------|
| shows loading skeleton when isLoading | Loading UI displayed |
| shows "Add Baby" button when no selectedBaby | Add baby prompt visible |
| renders selected baby name | Baby name displayed |
| renders baby age when birthDate provided | Age calculation displayed |
| shows dropdown indicator when multiple babies | "▾" visible when babies.length > 1 |
| hides dropdown when single baby | No indicator for single baby |
| opens modal when pressed | Modal becomes visible |
| renders all babies in modal | All babies from context listed |
| marks selected baby in modal | Checkmark on selected baby |
| calls selectBaby when different baby selected | selectBaby called with baby ID |
| closes modal after selection | Modal closes after selecting |
| shows "Add Another Baby" button in modal | Add button visible in modal |
| calls onAddBaby when add button pressed | onAddBaby callback triggered |
| has correct accessibility labels | Labels describe baby and actions |

---

### 1.7 QuickActionButton Component
**File:** `src/components/QuickActionButton.component.test.tsx`
**Source:** `src/components/QuickActionButton.tsx`

| Test | Description |
|------|-------------|
| renders label | Label text displayed |
| renders sublabel when provided | Sublabel text displayed |
| renders correct icon for type | Each type shows correct emoji |
| applies correct background color | Type-specific muted background |
| calls onPress when pressed | Press triggers callback |
| disabled state prevents press | onPress not called when disabled |
| disabled state shows reduced opacity | opacity-50 applied |
| has button accessibility role | accessibilityRole is "button" |
| has correct accessibility label | Label + sublabel combined |

#### BreastfeedingButtons Compound Component
| Test | Description |
|------|-------------|
| renders Left and Right buttons | Both side buttons visible |
| shows "Suggested" on correct side | Sublabel based on lastSide |
| calls onLeftPress when left pressed | Left button triggers callback |
| calls onRightPress when right pressed | Right button triggers callback |

#### DiaperButtons Compound Component
| Test | Description |
|------|-------------|
| renders Wet, Dirty, Both buttons | All three buttons visible |
| calls correct handler for each | Each button triggers its callback |

---

### 1.8 TimelineItem Component
**File:** `src/components/TimelineItem.component.test.tsx`
**Source:** `src/components/TimelineItem.tsx`

| Test | Description |
|------|-------------|
| renders time | Time string displayed |
| renders title | Title text displayed |
| renders subtitle when provided | Subtitle text displayed |
| renders details when provided | Details text displayed |
| renders correct activity icon | Emoji for activity type |
| applies activity-specific colors | Color from activityConfig |
| calls onPress when pressed | Press triggers callback |
| has button accessibility role | accessibilityRole is "button" |
| has correct accessibility label | Combines title, time, subtitle |
| renders edit indicator | "›" chevron visible |

#### TimelineDayHeader
| Test | Description |
|------|-------------|
| renders title | Day title displayed |
| renders date when provided | Date string displayed |

#### TimelineDivider
| Test | Description |
|------|-------------|
| renders divider line | Horizontal line visible |

---

### 1.9 InsightCard Component
**File:** `src/components/InsightCard.component.test.tsx`
**Source:** `src/components/InsightCard.tsx`

| Test | Description |
|------|-------------|
| renders direction icon for increase | "📈" shown for increase direction |
| renders direction icon for decrease | "📉" shown for decrease direction |
| renders direction icon for stable | "➡️" shown for stable direction |
| renders activity icon | Correct emoji for insight.type (sleep😴, feeding🤱, diaper👶, pumping🫙, tummyTime💪) |
| renders insight message | Translated message displayed |
| renders "compared to last week" text | Comparison text visible |
| displays percentage in message | Percentage value passed to translation |

---

### 1.10 TrendIndicator Component
**File:** `src/components/TrendIndicator.component.test.tsx`
**Source:** `src/components/TrendIndicator.tsx`

| Test | Description |
|------|-------------|
| renders up arrow for increase | "↑" displayed |
| renders down arrow for decrease | "↓" displayed |
| renders right arrow for stable | "→" displayed |
| applies green color for increase | #22c55e color |
| applies red color for decrease | #ef4444 color |
| applies gray color for stable | #6b7280 color |
| formats positive percentage | "+X%" format for increase |
| formats negative percentage | "-X%" format for decrease |
| formats zero percentage for stable | "0%" displayed |
| renders absoluteChangeFormatted when provided | Absolute change text visible |
| compact mode shows arrow and percentage only | Simplified view |
| full mode shows "vs last week" text | Comparison label visible |

---

### 1.11 SimpleBarChart Component
**File:** `src/components/SimpleBarChart.component.test.tsx`
**Source:** `src/components/SimpleBarChart.tsx`

| Test | Description |
|------|-------------|
| renders correct number of bars | Bar count matches data length |
| renders labels below bars | Each bar has label text |
| renders value above bars | Values displayed for non-zero |
| hides value for zero bars | No value text for zero |
| applies provided color to bars | Bar background is color prop |
| calculates bar heights relative to max | Tallest bar uses full height |
| uses maxValue when provided | Heights scaled to maxValue |
| uses largest data value when no maxValue | Auto-calculates max |
| applies custom formatValue | Value formatting function used |
| zero values have reduced opacity | opacity 0.2 for zero bars |

---

### 1.12 BabyHeader Component
**File:** `src/components/BabyHeader.component.test.tsx`
**Source:** `src/components/BabyHeader.tsx`

**Mock required:** `@/contexts` (useBaby hook)

| Test | Description |
|------|-------------|
| shows loading skeleton when isLoading | Placeholder UI displayed |
| shows "Add Baby" when no selectedBaby | Add baby button visible |
| calls router.push("/baby/add") when add pressed | Navigation triggered |
| renders BabySelector when baby selected | Selector component present |
| renders edit button when baby selected | ✏️ button visible |
| calls router.push with baby ID when edit pressed | Edit navigation works |
| renders settings button when onSettingsPress provided | ⚙️ button visible |
| calls onSettingsPress when settings pressed | Callback triggered |
| hides settings button when onSettingsPress not provided | No settings button |
| has correct accessibility labels | "Add your first baby", "Edit baby profile", "Settings" |

---

### 1.13 BabyProfileForm Component
**File:** `src/components/BabyProfileForm.component.test.tsx`
**Source:** `src/components/BabyProfileForm.tsx`

*Component handles baby name, birth date, and gender input - read full component to specify tests*

---

### 1.14 MilestoneSuggestionModal Component
**File:** `src/components/MilestoneSuggestionModal.component.test.tsx`
**Source:** `src/components/MilestoneSuggestionModal.tsx`

*Modal for feeding milestone suggestions - read component to specify tests*

---

### 1.15 SleepMilestoneSuggestionModal Component
**File:** `src/components/SleepMilestoneSuggestionModal.component.test.tsx`
**Source:** `src/components/SleepMilestoneSuggestionModal.tsx`

*Modal for sleep milestone suggestions - read component to specify tests*

---

## Part 2: Screen Component Tests

### 2.1 Home Screen (Dashboard)
**File:** `app/(tabs)/index.component.test.tsx`
**Source:** `app/(tabs)/index.tsx`

**Mocks required:** All activity contexts (useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime), expo-router

| Test | Description |
|------|-------------|
| renders BabyHeader | Header component present |
| renders all 6 DashboardCards | Feeding, Sleep, Diaper, Pumping, TummyTime, Growth |
| renders TodaySummary | Summary section present |
| navigates to /feeding when feeding card pressed | router.push called |
| navigates to /sleep when sleep card pressed | router.push called |
| navigates to /diaper when diaper card pressed | router.push called |
| navigates to /pumping when pumping card pressed | router.push called |
| navigates to /tummyTime when tummyTime card pressed | router.push called |
| navigates to /growth when growth card pressed | router.push called |
| shows active state for feeding when timer running | DashboardCard isActive |
| shows active state for sleep when timer running | DashboardCard isActive |
| displays correct time since values | Data from contexts displayed |
| displays suggested side for breastfeeding | "Next: Left/Right side" |
| displays sleep progress | Progress bar percentage |

---

### 2.2 Feeding Screen
**File:** `app/feeding/index.component.test.tsx`
**Source:** `app/feeding/index.tsx`

**Mocks required:** useFeeding, useBaby, expo-router

| Test | Description |
|------|-------------|
| renders header with baby name | Header shows selected baby |
| renders tab bar with 3 tabs | Breast, Bottle, Solids tabs |
| breast tab is default | Breast tab initially selected |
| switches to bottle tab when pressed | Tab changes on press |
| switches to solids tab when pressed | Tab changes on press |
| shows "No baby selected" when no baby | Error state rendered |
| hides tab bar when timer running | Tab bar not visible during timer |

#### Breastfeeding Form
| Test | Description |
|------|-------------|
| renders side selection buttons | Left, Right, Both buttons |
| shows suggested side indicator | Suggested side highlighted |
| calls startBreastfeeding with "left" | Left button triggers timer |
| calls startBreastfeeding with "right" | Right button triggers timer |
| calls startBreastfeeding with "both" | Both button triggers timer |
| navigates to manual entry | Log past button navigates |

#### Breastfeeding Timer View
| Test | Description |
|------|-------------|
| displays elapsed time | Timer shows formatted duration |
| shows side selector | L, B, R buttons visible |
| selected side is highlighted | Current side marked selected |
| calls changeSide when side changed | Side button triggers callback |
| calls stopBreastfeeding when stop pressed | Stop button ends timer |
| navigates back after stopping | router.back called |

#### Bottle Form
| Test | Description |
|------|-------------|
| renders content type selection | Breast Milk, Formula buttons |
| renders amount input | Text input for amount |
| renders quick amount buttons | Preset amount buttons |
| renders unit toggle (oz/ml) | Unit switch visible |
| selects content type on press | Button selection works |
| updates amount from input | Text input updates state |
| selects quick amount on press | Quick button fills input |
| toggles unit between oz and ml | Unit switch works |
| shows validation when save without data | Error message shown |
| calls addFeeding on valid save | addFeeding called with data |
| navigates back after save | router.back called |

#### Solids Form
| Test | Description |
|------|-------------|
| renders food input | Text input for food name |
| renders suggested/recent foods | Food suggestion buttons |
| renders reaction buttons | Loved, Meh, Refused buttons |
| selects food from suggestions | Button fills input |
| selects reaction | Reaction button selection |
| shows validation when save without food | Error message shown |
| calls addFeeding on valid save | addFeeding called with data |

---

## Part 3: Integration Tests

Integration tests verify complete user flows across multiple components and contexts.

### 3.1 Feeding Flow Integration
**File:** `src/__tests__/feeding-flow.integration.test.tsx`

**Setup:** Mock AsyncStorage, render with real contexts

| Test | Description |
|------|-------------|
| Complete breastfeeding flow | Start timer → change side → stop → entry saved to context |
| Complete bottle feeding flow | Select type → enter amount → save → entry in context |
| Complete solids flow | Enter food → select reaction → save → entry in context |
| Timer persists across renders | Start timer → remount → timer still running |
| Suggested side alternates | Log left → suggested is right → log right → suggested is left |
| Recent foods appear in suggestions | Log food → appears in recent foods list |

### 3.2 Sleep Flow Integration
**File:** `src/__tests__/sleep-flow.integration.test.tsx`

| Test | Description |
|------|-------------|
| Start sleep timer | Press start → timer running → shows in dashboard |
| Stop sleep timer | Running timer → stop → entry saved |
| Manual sleep entry | Manual entry → appears in timeline |
| Sleep progress updates | Log sleep → daily progress percentage changes |
| Sleep goal tracking | Total sleep updates relative to daily goal |

### 3.3 Diaper Flow Integration
**File:** `src/__tests__/diaper-flow.integration.test.tsx`

| Test | Description |
|------|-------------|
| Log wet diaper | Select wet → save → wet count increments |
| Log dirty diaper | Select dirty → save → entry with type |
| Log mixed diaper | Select both → save → counts both |
| Color selection | Select stool color → saved in entry |
| Today's counts accurate | Multiple entries → counts match |

### 3.4 Theme Change Integration
**File:** `src/__tests__/theme-flow.integration.test.tsx`

| Test | Description |
|------|-------------|
| System theme follows device | Set system → resolvedMode matches device |
| Light theme overrides system | Set light → resolvedMode is light |
| Dark theme overrides system | Set dark → resolvedMode is dark |
| Theme persists after reload | Change theme → remount → theme preserved |
| isDark reflects resolved mode | dark mode → isDark is true |

### 3.5 Baby Selection Integration
**File:** `src/__tests__/baby-selection.integration.test.tsx`

| Test | Description |
|------|-------------|
| Add first baby | No babies → add → baby appears selected |
| Switch between babies | Multiple babies → select different → data changes |
| New baby starts with empty data | Add baby → no feedings/sleeps for new baby |
| Selected baby persists | Select baby → reload → same baby selected |

### 3.6 Timer Across Activities Integration
**File:** `src/__tests__/timer-activities.integration.test.tsx`

| Test | Description |
|------|-------------|
| Only one timer active at a time | Start feeding → start sleep → feeding stops |
| Timer shows on dashboard | Start timer → dashboard shows active state |
| Timer survives navigation | Start timer → navigate away → return → still running |

---

## Part 4: Implementation Notes

### Test File Structure
```
src/
├── components/
│   ├── Button.tsx
│   ├── Button.component.test.tsx
│   ├── Card.tsx
│   ├── Card.component.test.tsx
│   └── ...
├── __tests__/
│   ├── feeding-flow.integration.test.tsx
│   ├── sleep-flow.integration.test.tsx
│   └── ...
app/
├── (tabs)/
│   ├── index.tsx
│   ├── index.component.test.tsx
│   └── ...
├── feeding/
│   ├── index.tsx
│   ├── index.component.test.tsx
│   └── ...
└── settings/
    ├── theme.tsx
    ├── theme.component.test.tsx
    └── ...
```

### Mock Patterns

#### Context Mock Example
```typescript
jest.mock("@/contexts", () => ({
  useFeeding: () => ({
    feedings: [],
    activeTimer: null,
    startBreastfeeding: jest.fn(),
    stopBreastfeeding: jest.fn(),
    addFeeding: jest.fn(),
    // ... other methods
  }),
}));
```

#### Router Mock (already in jest.setup.js)
```typescript
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));
```

### Running Tests
```bash
# Run all component tests
npm run test:component

# Run specific test file
npx jest src/components/Card.component.test.tsx

# Run with coverage
npx jest --coverage
```

---

## Summary

| Category | Files | Estimated Tests |
|----------|-------|-----------------|
| Component Tests (existing) | 3 | 55 |
| Component Tests (new) | 12 | ~130 |
| Screen Tests | 2 | ~50 |
| Integration Tests | 6 | ~35 |
| **Total** | **23** | **~270** |

### Priority Order for Implementation

**High Priority (Core UI):**
1. Card.component.test.tsx
2. Input.component.test.tsx
3. DashboardCard.component.test.tsx
4. TodaySummary.component.test.tsx

**Medium Priority (User Flows):**
5. FeedingTypeMenu.component.test.tsx
6. BabySelector.component.test.tsx
7. QuickActionButton.component.test.tsx
8. TimelineItem.component.test.tsx
9. BabyHeader.component.test.tsx

**Lower Priority (Statistics/Charts):**
10. InsightCard.component.test.tsx
11. TrendIndicator.component.test.tsx
12. SimpleBarChart.component.test.tsx

**Screen Tests:**
13. app/(tabs)/index.component.test.tsx
14. app/feeding/index.component.test.tsx

**Integration Tests:**
15. feeding-flow.integration.test.tsx
16. sleep-flow.integration.test.tsx
17. diaper-flow.integration.test.tsx
18. theme-flow.integration.test.tsx
19. baby-selection.integration.test.tsx
20. timer-activities.integration.test.tsx
