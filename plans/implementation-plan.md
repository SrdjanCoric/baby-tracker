# Baby Tracker App - Comprehensive Implementation Plan

## Overview

A privacy-first, ad-free baby tracking app for iOS and Android with Apple Watch support, home screen widgets, and real-time multi-caregiver sync.

**Development Approach:**
- **TDD (Test-Driven Development)** - ALWAYS write tests FIRST before implementing new features
  - Write failing tests that define the expected behavior
  - Implement the minimum code to make tests pass
  - Refactor while keeping tests green
- **Testable First** - Prioritize getting working, testable features before completing all infrastructure
- Feature Branch Workflow - Each feature on separate branch, merge to main when complete
- CI/CD with GitHub Actions - Automated testing on every PR
- **Frontend Design Skill** - Use `/frontend-design` for all UI components to ensure production-grade, beautiful interfaces
- **Create PR Skill** - Use `/createpr feature-name` to create pull requests with proper formatting
- **Manual Developer Testing** - Every feature must be manually tested and verified by developer before merging

**TDD Workflow for Every Feature:**
1. Create feature branch
2. Write unit tests for validators/utilities FIRST (these tests will fail)
3. Implement validators/utilities to make tests pass
4. Write integration tests if needed
5. Implement UI components
6. Manual testing
7. Create PR

---

## Current Progress

### Completed
- [x] Expo + TypeScript project with NativeWind v4
- [x] Path aliases and folder structure
- [x] Vitest for unit tests
- [x] i18n with i18next + English translations
- [x] Base UI components (Button, Card, Input)
- [x] ESLint 9 + Prettier + GitHub Actions CI
- [x] Navigation with Expo Router (4 tabs: Home, Timeline, Stats, Profile)
- [x] UI/UX Foundation with design system and core components
  - [x] Design tokens (colors, typography, spacing) in tailwind.config.js
  - [x] Activity-specific color palette (6 activities with unique colors)
  - [x] DashboardCard component with time-since display
  - [x] QuickActionButton component
  - [x] TimerDisplay component
  - [x] TimelineItem component
  - [x] TodaySummary component
  - [x] BabyHeader component
  - [x] Home dashboard with 6 activity cards
  - [x] Dark mode support with useColorScheme
- [x] Comprehensive Test Foundation (203 tests)
  - [x] Time utilities with tests (formatDuration, timeSince, calculateDuration, formatDayHeader)
  - [x] Volume utilities with tests (mlToOz, ozToMl, formatVolume, parseVolume)
  - [x] Activity constants with tests (STOOL_COLORS, ACTIVITY_CONFIG, type guards)
  - [x] Baby validators with tests (validateBabyName, validateBirthDate, calculateBabyAge)
  - [x] Feeding validators with tests (validateBreastfeeding, validateBottleFeeding)
  - [x] BabyStorageService with tests (AsyncStorage CRUD operations)
  - [x] BabyContext reducer with tests (state management)
- [x] Baby Profile Management (Ready for Manual Testing)
  - [x] BabyStorageService for AsyncStorage persistence
  - [x] BabyContext provider with state management
  - [x] BabyProfileForm component with validation
  - [x] BabySelector component for switching babies
  - [x] Add Baby screen (/baby/add)
  - [x] Edit Baby screen (/baby/[id])
  - [x] BabyHeader integrated with real data
- [x] Breastfeeding Timer (Ready for Manual Testing)
  - [x] FeedingStorageService for AsyncStorage persistence (with 20 tests)
  - [x] FeedingContext provider with timer state management (with 18 tests)
  - [x] Breastfeeding screen with timer and side selection
  - [x] Side memory (suggests opposite side from last feeding)
  - [x] Timer persists through app restarts (via AsyncStorage)
  - [x] Home screen shows time since last feeding
  - [x] Timeline shows real feeding entries
- [x] Bottle Feeding (Ready for Manual Testing)
  - [x] Bottle feeding validators with content type validation (5 new tests, 209 total)
  - [x] BottleContentType added to activity constants
  - [x] Storage service updated with contentType support
  - [x] Bottle feeding screen with volume input (ml/oz toggle)
  - [x] Quick amount buttons (1-6 oz or 30-180 ml)
  - [x] Formula/Breast milk content type selection
  - [x] FeedingTypeMenu modal for choosing feeding type from home
  - [x] Timeline displays bottle feedings with content type and amount
- [x] Manual Feeding Entry (Ready for Manual Testing)
  - [x] Manual feeding validators (19 new tests, 228 total)
  - [x] validateStartTimeNotInFuture with 10s tolerance
  - [x] validateManualFeedingDuration (1 min to 2 hours)
  - [x] validateManualBreastfeeding and validateManualBottleFeeding
  - [x] Manual feeding screen with date/time picker
  - [x] Tab-based UI for breastfeeding vs bottle selection
  - [x] Quick duration buttons (5, 10, 15, 20, 30, 45 min)
  - [x] FeedingTypeMenu updated with "Log Past Feeding" option
- [x] Solid Food Tracking (Ready for Manual Testing)
  - [x] SolidAmount type (aLittle, some, aLot) and SOLID_AMOUNTS constant
  - [x] Common foods list in src/constants/foods.ts
  - [x] Solid feeding validators with 17 new tests (245 total)
  - [x] validateFoodType, validateSolidAmount, validateSolidFeeding
  - [x] Solid feeding screen with food selection and amount
  - [x] Recent foods quick selection from feeding history
  - [x] FeedingTypeMenu updated with "Solid Food" option
  - [x] Timeline displays solid feedings with food type and amount
- [x] Sleep Tracking (Ready for Manual Testing)
  - [x] Sleep validators with 45 new tests (335 total)
  - [x] validateSleepType, validateSleepDuration, determineSleepType
  - [x] SleepStorageService for AsyncStorage persistence (22 tests)
  - [x] SleepContext provider with timer state management (18 tests)
  - [x] Sleep tracking screen with timer and nap/night selection
  - [x] Auto-detection of sleep type based on time of day
  - [x] Timer persists through app restarts (via AsyncStorage)
  - [x] Home screen shows time since last sleep
  - [x] Timeline shows real sleep entries
- [x] Sleep Manual Entry (Ready for Manual Testing)
  - [x] Manual sleep screen with date/time picker
  - [x] Duration picker with quick duration buttons
  - [x] Nap/night type selector
  - [x] "Log Past Sleep" option accessible from home screen
  - [x] Validation prevents future times and unreasonable durations
  - [x] Entries appear correctly in Timeline
- [x] Diaper Tracking (Ready for Manual Testing)
  - [x] Diaper validators with 24 new tests (394 total)
  - [x] validateDiaperType, validateStoolColor, validateDiaperEntry, validateManualDiaper
  - [x] DiaperStorageService for AsyncStorage persistence (21 tests)
  - [x] DiaperContext provider with state management (14 tests)
  - [x] Diaper tracking screen with type selection (wet/dirty/mixed)
  - [x] Visual color picker for stool color (7 colors)
  - [x] Manual diaper entry with date/time picker
  - [x] Home screen shows time since last diaper
  - [x] Timeline shows diaper entries with type and color
  - [x] Today's diaper count in summary
- [x] Growth Tracking (Ready for Manual Testing)
  - [x] Growth validators with 38 tests (577 total)
  - [x] validateWeightKg, validateHeightCm, validateHeadCircumferenceCm, validateGrowthMeasurement
  - [x] Growth utility functions with 36 tests (kgToLbs, lbsToKg, cmToInches, formatWeight, formatHeight)
  - [x] GrowthStorageService for AsyncStorage persistence (20 tests)
  - [x] GrowthContext provider with state management (14 tests)
  - [x] Growth tracking screen with weight, height, head circumference inputs
  - [x] Home screen shows last measurement date
  - [x] Timeline shows growth entries with measurements
- [x] Tummy Time Tracking (Ready for Manual Testing)
  - [x] Tummy time validators with 48 tests (664 total)
  - [x] validateTummyTimeStartTime, validateTummyTimeDuration, validateManualTummyTime
  - [x] calculateDailyProgress, calculateTodaysTotalSeconds utility functions
  - [x] TummyTimeStorageService for AsyncStorage persistence (23 tests)
  - [x] TummyTimeContext provider with state management (16 tests)
  - [x] Tummy time tracking screen with timer and progress ring
  - [x] Daily goal with visual progress indicator
  - [x] Manual tummy time entry with quick duration buttons
  - [x] Home screen shows time since last session and daily progress %
  - [x] Timeline shows tummy time entries with duration
- [x] Tummy Time Smart Goals
  - [x] Age-based default goals (15-60 min based on baby age from AAP/WHO research)
  - [x] User customization with settings screen
  - [x] Goal suggestion modal at age milestones (1mo, 2mo, 3mo, 6mo)
  - [x] 6+ month transition messaging about floor play
- [x] Sleep Smart Goals (Age-Based Targets)
  - [x] Add age-based sleep constants in src/utils/sleepGoals.ts
    - Total sleep hours by age (0-2mo: 15-17h, 3-5mo: 14-15h, 6-8mo: 14h, 9-12mo: 13-14h, 13-18mo: 13-14h, 19+mo: 11-12h)
    - Number of naps by age (0-2mo: 4-5, 3-5mo: 3-4, 6-8mo: 2-3, 9-12mo: 2, 13-18mo: 1-2, 19+mo: 0-1)
    - Wake windows by age (0-2mo: 30-60min, 3-5mo: 1-2h, 6-8mo: 2-3h, 9-12mo: 2.5-3.5h, 13-18mo: 3-4h, 19+mo: 4-6h)
  - [x] Add getSleepGoalForAge() utility function with tests (47 tests)
  - [x] Add getWakeWindowForAge() utility function with tests
  - [x] Update SleepContext to use age-based wake window (replaced hardcoded 150 min)
  - [x] Update Sleep dashboard card to show "Xh Xm / Yh" with progress bar
  - [x] Add user customization for sleep goals (similar to tummy time)
    - [x] Store custom goals in AsyncStorage per baby
    - [x] Sleep settings screen to adjust daily sleep goal
    - [x] Goal suggestion modal at age milestones
  - [x] Add translation keys for sleep goals
  - [x] Simplified dashboard UX: Sleep shows only "Awake: Xh Xm", Tummy Time shows only session count
- [x] One-Tap Feeding (Tabbed UI)
  - [x] Remove FeedingTypeMenu modal entirely (removed from dashboard)
  - [x] Create new unified FeedingScreen with tabs at top (🤱 Breast | 🍼 Bottle | 🥣 Solids)
  - [x] Store last-used feeding type in AsyncStorage (default: breastfeeding)
  - [x] On open, automatically select last-used tab
  - [x] Each tab shows its respective form inline (no navigation)
  - [x] Add "Log Past" button at bottom of each tab section
  - [x] Update manual.tsx to accept type parameter for type-specific past logging (already done)
  - [x] Add solid food manual entry support (already done)
  - [x] Update navigation: Feed card opens /feeding directly (no menu)
  - [x] Uses existing translation keys (breastfeedingTab, bottleTab, solidFood)

### Next Milestone: Testable App
**Goal:** Baby Profile + First Tracking Feature

| Step | Feature | Manual Test | Status |
|------|---------|-------------|--------|
| 1 | Navigation with Expo Router | Tap between tabs | ✅ Done |
| 2 | **UI/UX Foundation** (see below) | Visual design matches ui-ux-design-plan | ✅ Done |
| 3 | Baby profile management | Add baby, see in header | ✅ Done |
| 4 | Breastfeeding timer | Start/stop timer, see in timeline | ✅ Done |

---

## Step 2: UI/UX Foundation Implementation

**Reference:** See `plans/ui-ux-design-plan.md` for complete design specifications.

### Branch: `feature/ui-ux-foundation`
**Scope:** Implement the visual design system and core UI components using `/frontend-design` skill

### Tasks

#### 2.1 Design System Setup
Use `/frontend-design` to establish:

1. **Color Palette** (from ui-ux-design-plan.md):
   | Activity | Color | Hex |
   |----------|-------|-----|
   | Sleep | Soft Purple/Blue | #6B5B95 |
   | Feeding | Soft Green | #88B04B |
   | Diaper | Soft Peach | #F7CAC9 |
   | Pumping | Light Blue | #92A8D1 |
   | Growth | Teal | #009B77 |

2. **Light Mode Colors**:
   - Background: #FAFAFA
   - Card background: #FFFFFF
   - Primary text: #1A1A1A
   - Secondary text: #6B6B6B
   - Primary action: #2E7D32 (calming green)

3. **Dark Mode Colors**:
   - Background: #121212
   - Card background: #1E1E1E
   - Primary text: #FFFFFF
   - Secondary text: #A0A0A0
   - Primary action: #81C784

4. **Typography**:
   - Headers: 20-24pt, semibold
   - Body: 16-18pt, regular
   - Captions: 14pt, secondary color

5. **Spacing**:
   - Base unit: 16px
   - Card padding: 16px
   - Between cards: 12px
   - Touch targets: minimum 48px (prefer 60px+)

#### 2.2 Core Components to Create/Update
Use `/frontend-design` for each:

1. **Updated Bottom Tab Navigation**
   - 4 tabs: Home, Timeline, Stats, Profile (not Settings)
   - Consider FAB (Floating Action Button) for quick logging

2. **Dashboard Cards** (Home Screen)
   - "Time since" display prominently
   - Activity-specific colors
   - One-tap action buttons [+]
   - Active timer highlight

3. **Quick Action Buttons**
   - Large touch targets (60px+)
   - Color-coded by activity type
   - Haptic feedback indication

4. **Timer Display Component**
   - Large, readable timer numbers
   - Side selector (L/R) for breastfeeding
   - Stop button prominent

5. **Timeline Item Component**
   - Color-coded activity icons
   - Time display (not "X hours ago")
   - Tap to edit functionality

6. **Stat Cards**
   - Large numbers, glanceable
   - Comparison to previous day/week

#### 2.3 Screen Layouts to Implement

1. **Home/Dashboard Screen**
   ```
   ┌─────────────────────────────────────┐
   │  [Baby Name & Photo]    [Settings]  │
   ├─────────────────────────────────────┤
   │  ┌──────────┐  ┌──────────┐        │
   │  │ FEEDING  │  │  SLEEP   │        │
   │  │ 2h 15m   │  │ Sleeping │        │
   │  │  [+]     │  │  [Stop]  │        │
   │  └──────────┘  └──────────┘        │
   │  ┌──────────┐  ┌──────────┐        │
   │  │  DIAPER  │  │  GROWTH  │        │
   │  │  45 min  │  │  Track   │        │
   │  │   [+]    │  │   [+]    │        │
   │  └──────────┘  └──────────┘        │
   │  ─────── TODAY ───────             │
   │  Total: 18oz | 3 naps | 6 diapers  │
   └─────────────────────────────────────┘
   │  [Home]  [Timeline]  [Stats]  [Me] │
   └─────────────────────────────────────┘
   ```

2. **Timeline Screen** (basic structure)
3. **Statistics Screen** (basic structure)
4. **Profile/Settings Screen** (basic structure)

### Definition of Done
- [x] Design tokens configured in NativeWind/Tailwind
- [x] Color palette implemented (light + dark mode)
- [x] Typography scale configured
- [x] Spacing scale configured
- [x] Dashboard cards component created
- [x] Quick action buttons created
- [x] Timer display component created
- [x] Timeline item component created
- [x] Home screen layout matches design
- [x] All touch targets >= 48px
- [x] Visual consistency across all screens
- [x] `/frontend-design` skill used for each component
- [x] Dark mode tested and working

### Deferred Until Later
- Supabase backend (needs UI first)
- PowerSync offline sync (needs UI first)
- Dark/Night mode toggle
- Maestro E2E tests

### Future Enhancements (Post-MVP)

#### Dashboard Customization
**Branch:** `feature/dashboard-customization`

1. **Custom Card Colors**
   - Allow users to customize the color of each activity card
   - Color picker UI in settings or long-press on card
   - Persist color preferences in user settings
   - Default colors remain as fallback

2. **Drag-and-Drop Card Reordering**
   - Allow users to reorder dashboard cards via drag-and-drop
   - Use `react-native-reanimated` + `react-native-gesture-handler` for smooth animations
   - Persist card order in user settings
   - Reset to default option available

---

## UI/UX Design Guidelines

### Design Philosophy
Simple, beautiful, and functional. The app must be usable by sleep-deprived parents with one hand while holding a baby.

### Use Frontend Design Skill For:
- **All new screens** - Use `/frontend-design` skill when creating any new screen
- **Core components** - Timers, forms, cards, buttons, navigation
- **Design system setup** - Color palette, typography, spacing in Phase 0
- **Feature-specific UI** - Each tracking feature (feeding, sleep, diaper, etc.)
- **Not just polish** - Use throughout development, not just at the end

### Core Design Principles

| Principle | Requirement | Implementation |
|-----------|-------------|----------------|
| **One-Hand Operation** | Usable with thumb only | Bottom navigation, large buttons at bottom of screen |
| **3-Tap Maximum** | Log any activity in ≤3 taps | Quick actions on home, smart defaults |
| **Large Touch Targets** | Minimum 44x44 points | All interactive elements |
| **Sleep-Deprived Friendly** | Clear, obvious actions | High contrast, clear labels, no ambiguity |
| **Dark/Night Mode** | Essential for night feedings | System-aware + manual toggle + extra-dim red mode |

### Visual Design Standards

```
Typography:
├── Headings: Bold, clear hierarchy
├── Body: Readable at a glance
├── Numbers: Large, prominent (timers, stats)
└── Labels: Subtle but legible

Colors:
├── Primary: Calming, not clinical
├── Accent: For active timers, CTAs
├── Success: Subtle celebration (goal completion)
├── Warning: Non-alarming alerts
└── Night mode: Warm reds, minimal blue light

Spacing:
├── Generous padding (touch-friendly)
├── Clear visual grouping
├── Breathing room between elements
└── Consistent rhythm throughout
```

### Component Library (Create in Phase 0/1)

| Component | Use For | Design Notes |
|-----------|---------|--------------|
| `TimerDisplay` | All timers | Large, prominent, easy to read at a glance |
| `QuickActionButton` | Home screen actions | Large, colorful, one-tap logging |
| `SideSelector` | Left/Right breast | Clear visual distinction, remembers last |
| `ColorPicker` | Stool color selection | Visual swatches, not text dropdown |
| `StatCard` | Statistics display | Glanceable numbers, subtle labels |
| `TimelineItem` | Activity entries | Icon + summary, swipe actions |
| `ProgressRing` | Tummy time goals | Visual progress, celebratory at 100% |
| `FormInput` | All inputs | Large, clear, with unit toggles |

### Screen-by-Screen Design Approach

**Phase 1 - Design with frontend-design skill:**
1. **Home/Timeline** - First impression, must be beautiful and functional
2. **Log Screen** - Quick action grid, visually distinct categories
3. **Timer Screens** - Large timer display, prominent side/stop buttons
4. **Statistics** - Clean charts, glanceable summaries
5. **Settings** - Clean list, clear sections

**Phase 4 - Design with frontend-design skill:**
1. **Onboarding** - Welcoming, not overwhelming, beautiful illustrations
2. **Growth Charts** - Professional, pediatrician-worthy

**Phase 5 - Polish with frontend-design skill:**
1. Review all screens for consistency
2. Add micro-animations (button feedback, transitions)
3. Polish empty states
4. Ensure dark/night mode looks great

### Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|------------|
| Tiny buttons | Large, thumb-friendly touch targets |
| Text-heavy screens | Icons + minimal text |
| Hidden actions | Obvious, visible buttons |
| Complex navigation | Flat, simple structure |
| Clinical/medical look | Warm, friendly, personal |
| Generic stock app feel | Distinctive, memorable design |
| Cluttered screens | Focused, single-purpose views |

### Design Review Checklist (Per Screen)

Before merging any screen:
- [ ] Works with one hand (thumb reach)
- [ ] Primary action achievable in ≤3 taps
- [ ] Touch targets ≥44x44 points
- [ ] Readable in light mode
- [ ] Readable in dark mode
- [ ] Readable in night mode (dim red)
- [ ] Clear visual hierarchy
- [ ] Consistent with other screens
- [ ] Empty state designed
- [ ] Loading state designed
- [ ] Error state designed

---

## Phase 0: Project Setup & Infrastructure

### Objective
Establish the complete development environment, project structure, CI/CD pipeline, and foundational architecture.

### Feature Branches

#### Branch: `setup/project-initialization`
**Scope:** Initialize React Native project with Expo prebuild workflow

**TDD Approach:**
- No tests yet (infrastructure setup)

**Tasks:**
1. Create React Native project with Expo (git repo already exists)
   ```bash
   npx create-expo-app@latest baby-tracker --template expo-template-blank-typescript
   ```
2. Configure for bare workflow (expo prebuild)
3. Set up TypeScript with strict mode
4. Configure NativeWind (Tailwind CSS)
5. Set up path aliases (@components, @screens, @utils, etc.)
6. Create folder structure:
   ```
   src/
   ├── components/
   ├── screens/
   ├── navigation/
   ├── hooks/
   ├── utils/
   ├── services/
   ├── types/
   ├── constants/
   ├── contexts/
   ├── validators/
   └── i18n/
       ├── index.ts
       ├── types.ts
       └── locales/
           └── en.json
   ```

**Definition of Done:**
- [ ] Project runs on iOS simulator
- [ ] Project runs on Android emulator
- [ ] TypeScript compiles without errors
- [ ] NativeWind styles work correctly
- [ ] Path aliases resolve correctly

---

#### Branch: `setup/testing-infrastructure`
**Scope:** Configure testing frameworks

**Note:** Using Vitest + Maestro only (skipping Jest due to React 19 peer dependency conflicts with react-test-renderer). Maestro E2E tests provide UI coverage that component tests would provide.

**TDD Approach:**
- Write sample tests to verify each framework works

**Tasks:**
1. Configure Vitest for unit tests
   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       include: ['src/**/*.test.ts'],
       exclude: ['**/__tests__/**', 'e2e/**'],
       environment: 'node',
     },
   });
   ```
2. Set up Maestro for E2E tests
3. Create test utilities and helpers
4. Add test scripts to package.json:
   ```json
   {
     "test:unit": "vitest run",
     "test:unit:watch": "vitest",
     "test:e2e": "maestro test e2e/",
     "test:all": "npm run test:unit"
   }
   ```

**Sample Tests to Verify Setup:**
```typescript
// src/utils/sample.test.ts (Vitest)
import { describe, it, expect } from 'vitest';

describe('Testing infrastructure', () => {
  it('should run vitest tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Definition of Done:**
- [x] Vitest runs and passes sample test
- [ ] Maestro can launch app and run basic flow
- [ ] All test commands work from package.json

---

#### Branch: `setup/i18n-infrastructure`
**Scope:** Set up internationalization infrastructure for future multi-language support

**TDD Approach:**
```typescript
// src/i18n/i18n.test.ts
describe('i18n setup', () => {
  it('should load English translations', () => {});
  it('should fall back to English for missing translations', () => {});
  it('should detect device locale', () => {});
  it('should format dates according to locale', () => {});
  it('should format numbers according to locale', () => {});
});
```

**Tasks:**
1. Install i18n dependencies:
   ```bash
   npm install i18next react-i18next expo-localization
   ```
2. Create i18n configuration:
   ```typescript
   // src/i18n/index.ts
   import i18n from 'i18next';
   import { initReactI18next } from 'react-i18next';
   import * as Localization from 'expo-localization';
   import en from './locales/en.json';

   i18n.use(initReactI18next).init({
     resources: { en: { translation: en } },
     lng: Localization.locale.split('-')[0],
     fallbackLng: 'en',
     interpolation: { escapeValue: false },
   });
   ```
3. Create translation file structure:
   ```
   src/i18n/
   ├── index.ts           (i18n configuration)
   ├── locales/
   │   └── en.json        (English - primary)
   └── types.ts           (TypeScript types for translations)
   ```
4. Create English translation file with all UI strings organized by feature:
   ```json
   {
     "common": {
       "save": "Save",
       "cancel": "Cancel",
       "delete": "Delete",
       "edit": "Edit"
     },
     "feeding": {
       "breast": "Breastfeed",
       "bottle": "Bottle",
       "solid": "Solid Food",
       "leftSide": "Left Side",
       "rightSide": "Right Side"
     },
     "stoolColors": {
       "yellow": "Yellow (mustard)",
       "brown": "Brown",
       "green": "Green",
       "black": "Black (meconium)",
       "white": "White/Pale",
       "red": "Red-tinged",
       "orange": "Orange"
     }
   }
   ```
5. Create useTranslation hook wrapper for type safety
6. Set up date/number formatting utilities using Intl API
7. Document translation key conventions in README

**Note:** Ship with English only initially. This infrastructure enables easy addition of languages later without refactoring.

**Definition of Done:**
- [ ] i18n library configured and working
- [ ] All UI strings extracted to en.json
- [ ] Type-safe translation keys
- [ ] Date formatting respects locale
- [ ] Number formatting respects locale (ml/oz display)
- [ ] Device locale detection works
- [ ] Fallback to English works

---

#### Branch: `setup/design-system`
**Scope:** Establish design system foundation using frontend-design skill

**Tasks:**
1. **Use `/frontend-design` skill** to create the design system:
   - Color palette (primary, secondary, accent, semantic colors)
   - Typography scale (headings, body, labels, numbers)
   - Spacing scale (consistent padding/margins)
   - Border radius tokens
   - Shadow tokens
2. Configure NativeWind/Tailwind theme with design tokens:
   ```javascript
   // tailwind.config.js
   module.exports = {
     theme: {
       extend: {
         colors: {
           primary: { /* calming blue-green palette */ },
           accent: { /* warm accent for CTAs */ },
           night: { /* warm reds for night mode */ },
         },
         fontSize: {
           'timer': ['3rem', { lineHeight: '1' }],
           'stat': ['2rem', { lineHeight: '1.2' }],
         },
         spacing: {
           'touch': '44px', // minimum touch target
         },
       },
     },
   };
   ```
3. Create base UI components with frontend-design skill:
   - `Button` (primary, secondary, ghost variants)
   - `Card` (for timeline items, stat cards)
   - `Input` (large, touch-friendly)
   - `IconButton` (44x44 minimum)
4. Create theme context for dark/light/night modes
5. Document design system in Storybook or markdown

**Definition of Done:**
- [ ] Color palette defined and documented
- [ ] Typography scale configured
- [ ] Spacing scale configured
- [ ] Base Button component created
- [ ] Base Card component created
- [ ] Base Input component created
- [ ] Dark mode colors defined
- [ ] Night mode colors defined (warm reds)
- [ ] All components meet 44x44 touch target minimum
- [ ] Design tokens accessible via NativeWind classes

---

#### Branch: `setup/ci-cd-pipeline`
**Scope:** GitHub Actions for automated testing and builds

**Tasks:**
1. Create `.github/workflows/test.yml`:
   ```yaml
   name: Test
   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]

   jobs:
     lint-and-typecheck:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'
         - run: npm ci
         - run: npm run lint
         - run: npm run typecheck

     unit-tests:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'
         - run: npm ci
         - run: npm run test:unit
   ```

2. Create `.github/workflows/build.yml` for EAS builds
3. Set up branch protection rules documentation
4. Configure ESLint and Prettier
5. Add pre-commit hooks with Husky

**Definition of Done:**
- [ ] PR to main triggers test workflow
- [ ] All checks pass before merge allowed
- [ ] Linting catches style issues
- [ ] TypeScript errors fail the build

---

#### Branch: `setup/supabase-backend`
**Scope:** Set up Supabase project and database schema

**TDD Approach:**
- Write database migration tests

**Tasks:**
1. Create Supabase project (free tier)
2. Implement database migrations:

```sql
-- migrations/001_initial_schema.sql

-- Households (for multi-caregiver grouping)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  household_id UUID REFERENCES households(id),
  email VARCHAR(255),
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Babies
CREATE TABLE babies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  birth_date DATE,
  gender VARCHAR(10),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedings
CREATE TABLE feedings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('breast', 'bottle', 'solid')),
  side VARCHAR(10) CHECK (side IN ('left', 'right', 'both')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  amount_ml DECIMAL(6,2),
  food_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sleep Sessions
CREATE TABLE sleep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('nap', 'night')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diapers
CREATE TABLE diapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('wet', 'dirty', 'mixed')),
  stool_color VARCHAR(30),
  changed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pumping Sessions
CREATE TABLE pumping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  amount_ml DECIMAL(6,2),
  side VARCHAR(10) CHECK (side IN ('left', 'right', 'both')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth Measurements
CREATE TABLE growth_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  measured_at DATE NOT NULL,
  weight_kg DECIMAL(5,3),
  height_cm DECIMAL(5,2),
  head_cm DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tummy Time Sessions
CREATE TABLE tummy_time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tummy Time Goals
CREATE TABLE tummy_time_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  daily_goal_seconds INTEGER NOT NULL DEFAULT 1800,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pumping_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tummy_time_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tummy_time_goals ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access data from their household
CREATE POLICY "Users can view own household" ON households
  FOR SELECT USING (id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view household babies" ON babies
  FOR ALL USING (household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  ));

-- (Similar policies for all tables)
```

3. Set up Row Level Security (RLS) policies
4. Create database types for TypeScript
5. Set up Supabase client configuration

**Definition of Done:**
- [ ] All tables created in Supabase
- [ ] RLS policies prevent cross-household access
- [ ] TypeScript types generated from schema
- [ ] Connection test passes from app

---

#### Branch: `setup/powersync-offline`
**Scope:** Configure PowerSync for offline-first sync

**TDD Approach:**
- Write sync tests for offline/online transitions

**Tasks:**
1. Install PowerSync SDK
2. Configure PowerSync schema (mirrors Supabase)
3. Set up sync rules
4. Implement connection status handling
5. Create sync service wrapper

**Tests:**
```typescript
// src/services/sync.test.ts
describe('SyncService', () => {
  it('should queue changes when offline', async () => {});
  it('should sync queued changes when coming online', async () => {});
  it('should handle conflict resolution', async () => {});
});
```

**Definition of Done:**
- [ ] App works completely offline
- [ ] Data syncs when connection restored
- [ ] Sync status indicator works
- [ ] No data loss during offline/online transitions

---

### Phase 0 Gate Checklist

**All items must be checked before proceeding to Phase 1:**

- [x] React Native + Expo project runs on both platforms
- [x] TypeScript strict mode enabled, no errors
- [x] NativeWind configured and working
- [x] Vitest configured with passing sample test (469 tests)
- [ ] Maestro configured and can run basic flow (DEFERRED - E2E tests)
- [x] GitHub Actions CI pipeline runs on PRs
- [x] ESLint + Prettier configured
- [x] i18n infrastructure configured (i18next + expo-localization)
- [x] English translation file created with all UI strings (300+ keys)
- [x] Design system established (colors, typography, spacing)
- [x] Base UI components created (Button, Card, Input, DashboardCard, etc.)
- [x] Dark mode themes configured
- [x] All components meet 44x44 touch target minimum
- [ ] Supabase project created (DEFERRED - needs UI first)
- [ ] All database tables created with RLS (DEFERRED)
- [ ] PowerSync configured for offline-first (DEFERRED - needs Supabase first)
- [x] Environment variables properly configured (.env.example)
- [x] README.md with setup instructions
- [ ] All setup branches merged to main (in progress)

---

## Phase 1: Core MVP (Single User)

### Objective
Build a fully functional single-user baby tracking app with all core tracking features.

### Feature Branches

#### Branch: `feature/navigation-structure`
**Scope:** Set up app navigation with Expo Router

**Design:** Use `/frontend-design` skill to create:
- Bottom tab bar with clear icons and labels
- Tab icons that work in light/dark/night modes
- Smooth transitions between screens

**TDD Approach:**
```typescript
// Tests to write FIRST
describe('Navigation', () => {
  it('should render bottom tab navigator', () => {});
  it('should navigate to Timeline screen', () => {});
  it('should navigate to Log screen', () => {});
  it('should navigate to Statistics screen', () => {});
  it('should navigate to Settings screen', () => {});
});
```

**Tasks:**
1. Install Expo Router
2. Create tab navigation structure:
   - Timeline (home)
   - Log (quick actions)
   - Statistics
   - Settings
3. Implement stack navigators for detail screens
4. Add navigation types

**Definition of Done:**
- [x] All navigation tests pass
- [x] Tab bar renders with icons
- [x] Navigation between all screens works
- [x] Deep linking configured

---

#### Branch: `feature/ui-ux-foundation`
**Scope:** Implement visual design system and core UI components based on ui-ux-design-plan.md

**Design:** Use `/frontend-design` skill to create:
- Complete design system (colors, typography, spacing)
- Dashboard with "time since" cards
- Activity-specific color coding
- Quick action components
- Timer display component
- All components optimized for one-handed, sleep-deprived parent use

**Reference:** See `plans/ui-ux-design-plan.md` and "Step 2: UI/UX Foundation Implementation" section above for complete specifications.

**Key Design Requirements:**
- Maximum 2 taps to log any activity
- Touch targets minimum 48px, prefer 60px+
- "Time since last" prominently displayed
- Auto-suggest opposite breast for feeding
- Color-coded activities (Sleep: #6B5B95, Feeding: #88B04B, Diaper: #F7CAC9)

**Tasks:**
1. Configure design tokens in NativeWind/Tailwind config
2. Update tab navigation to: Home, Timeline, Stats, Profile
3. Create DashboardCard component with time-since display
4. Create QuickActionButton component
5. Create TimerDisplay component (for feeding/sleep)
6. Create TimelineItem component
7. Build Home/Dashboard screen layout
8. Ensure dark mode support throughout

**Definition of Done:**
- [ ] Design tokens configured
- [ ] Color palette implemented (light + dark)
- [ ] Typography and spacing scales configured
- [ ] DashboardCard component created
- [ ] QuickActionButton component created
- [ ] TimerDisplay component created
- [ ] TimelineItem component created
- [ ] Home screen matches ui-ux-design-plan layout
- [ ] All touch targets >= 48px
- [ ] Dark mode tested and working
- [ ] `/frontend-design` skill used for components

---

#### Branch: `feature/baby-profile-management`
**Scope:** Create, edit, and select baby profiles

**TDD Approach:**
```typescript
// Unit tests (Vitest)
describe('Baby validators', () => {
  it('should validate baby name is required', () => {});
  it('should validate birth date is not in future', () => {});
  it('should calculate age correctly', () => {});
  it('should calculate age in weeks for newborns', () => {});
});

// Component tests (Jest + RNTL)
describe('BabyProfileForm', () => {
  it('should render all required fields', () => {});
  it('should show validation errors', () => {});
  it('should call onSubmit with valid data', () => {});
});

describe('BabySelector', () => {
  it('should display current baby name', () => {});
  it('should show list of babies on press', () => {});
  it('should switch selected baby', () => {});
});
```

**E2E Test (Maestro):**
```yaml
# e2e/baby-profile.yaml
appId: com.babytracker.app
---
- launchApp
- tapOn: "Add Baby"
- inputText:
    id: "baby-name-input"
    text: "Emma"
- tapOn: "Select Birth Date"
- tapOn: "Confirm"
- tapOn: "Save"
- assertVisible: "Emma"
```

**Tasks:**
1. Create BabyProfile type and validators
2. Build BabyProfileForm component
3. Build BabySelector component (header dropdown)
4. Implement local storage for baby data
5. Create BabyContext for selected baby state
6. Build Add/Edit Baby screens

**Definition of Done:**
- [x] All unit tests pass
- [ ] All component tests pass (skipped - React 19 peer dependency issues)
- [ ] E2E test passes (Maestro not yet configured)
- [x] Can add multiple babies
- [x] Can edit baby profile
- [x] Can switch between babies
- [x] Selected baby persists across app restarts

---

#### Branch: `feature/feeding-breastfeeding`
**Scope:** Breastfeeding tracking with timer and side memory

**Design:** Use `/frontend-design` skill to create:
- Large, prominent timer display (easily readable at a glance)
- Left/Right side selector with clear visual distinction
- Large Stop button (easy to tap one-handed)
- Side memory indicator showing last used side

**TDD Approach:**
```typescript
// Unit tests (Vitest)
describe('Timer utilities', () => {
  it('should format seconds to HH:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
  it('should calculate duration between timestamps', () => {});
  it('should handle timer persistence across app closure', () => {});
});

describe('Feeding validators', () => {
  it('should require start time', () => {});
  it('should validate side is left, right, or both', () => {});
  it('should calculate duration from start/end times', () => {});
});

// Component tests
describe('BreastfeedingTimer', () => {
  it('should display left/right side buttons', () => {});
  it('should start timer on side selection', () => {});
  it('should show running time', () => {});
  it('should remember last used side', () => {});
  it('should allow switching sides', () => {});
  it('should save feeding on stop', () => {});
});
```

**E2E Test (Maestro):**
```yaml
# e2e/breastfeeding-flow.yaml
appId: com.babytracker.app
---
- launchApp
- tapOn: "Log"
- tapOn: "Breastfeed"
- tapOn: "Left"
- assertVisible: "Timer Running"
- extendedWaitUntil:
    visible: "0:00:05"
    timeout: 10000
- tapOn: "Stop"
- assertVisible: "Feeding Saved"
- tapOn: "Timeline"
- assertVisible: "Left Breast"
- assertVisible: "5s"
```

**Tasks:**
1. Create timer utility functions
2. Build BreastfeedingTimer component
3. Implement side memory (AsyncStorage)
4. Create feeding service for data persistence
5. Build timer notification (foreground service)
6. Add feeding to Timeline

**Edge Cases to Handle:**
- Timer continues when app is backgrounded
- Timer persists if app is killed (store start time)
- Side memory persists across sessions
- Handle timezone changes during feeding

**Definition of Done:**
- [ ] All unit tests pass
- [ ] All component tests pass
- [ ] E2E test passes
- [ ] Timer accurate to the second
- [ ] Timer survives app background
- [ ] Timer survives app kill/restart
- [ ] Side memory works
- [ ] Feeding saved to database

---

#### Branch: `feature/feeding-bottle`
**Scope:** Bottle feeding tracking with volume

**TDD Approach:**
```typescript
// Unit tests
describe('Volume utilities', () => {
  it('should convert ml to oz', () => {
    expect(mlToOz(30)).toBeCloseTo(1.01, 1);
  });
  it('should convert oz to ml', () => {
    expect(ozToMl(1)).toBeCloseTo(29.57, 1);
  });
  it('should validate volume is positive', () => {});
});

describe('Bottle feeding validators', () => {
  it('should require volume', () => {});
  it('should require content type (formula/breast milk)', () => {});
  it('should validate volume within reasonable range', () => {});
});

// Component tests
describe('BottleFeedingForm', () => {
  it('should render volume input', () => {});
  it('should toggle between ml and oz', () => {});
  it('should show formula/breast milk selector', () => {});
  it('should save feeding with correct data', () => {});
});
```

**Tasks:**
1. Create volume conversion utilities
2. Build BottleFeedingForm component
3. Implement unit preference (ml/oz) setting
4. Add bottle feeding to Timeline

**Definition of Done:**
- [x] All tests pass
- [x] Volume input works in ml and oz
- [ ] Unit preference persists (deferred - requires user settings feature)
- [x] Formula/breast milk selection works
- [x] Quick volume buttons (1oz, 2oz, etc.)

---

#### Branch: `feature/feeding-manual-entry`
**Scope:** Manual/retroactive entry for breastfeeding and bottle feeding

**Why This Feature:**
- Parents often forget to start the timer, especially during night feedings
- Another caregiver fed the baby and reports it verbally
- Phone died or app crashed during feeding
- Logging past feedings when first setting up the app

**TDD Approach:**
```typescript
// Unit tests
describe('Manual feeding validators', () => {
  it('should validate start time is not in the future', () => {});
  it('should validate end time is after start time', () => {});
  it('should calculate duration from start and end time', () => {});
  it('should validate duration is reasonable (1 min to 2 hours)', () => {});
});

// Component tests
describe('ManualFeedingEntry', () => {
  it('should render date/time picker for start time', () => {});
  it('should render duration input or end time picker', () => {});
  it('should show side selector for breastfeeding', () => {});
  it('should save feeding with correct timestamps', () => {});
});
```

**Tasks:**
1. Add time validation utilities (not in future, reasonable duration)
2. Create ManualFeedingEntry component with:
   - Date/time picker for start time (defaults to now)
   - Duration picker OR end time picker (user choice)
   - Side selector (for breastfeeding)
   - Content type selector (for bottle feeding)
   - Amount input (for bottle feeding)
3. Update FeedingTypeMenu to show "Log Past Feeding" option
4. Add to breastfeeding screen: toggle between Timer and Manual modes

**Definition of Done:**
- [x] All tests pass (228 tests, including 19 new manual feeding validator tests)
- [x] Can manually enter breastfeeding with start time, duration, and side
- [x] Can manually enter bottle feeding with start time and amount
- [x] Start time defaults to current time but can be changed
- [x] Validation prevents future times and unreasonable durations
- [x] Entries appear correctly in Timeline

---

#### Branch: `feature/feeding-solids`
**Scope:** Solid food tracking

**TDD Approach:**
```typescript
// Unit tests
describe('Solid feeding validators', () => {
  it('should require food type', () => {});
  it('should allow multiple food items', () => {});
});

// Component tests
describe('SolidFeedingForm', () => {
  it('should render food type input', () => {});
  it('should suggest common foods', () => {});
  it('should allow custom food entry', () => {});
  it('should track amount (a little, some, a lot)', () => {});
});
```

**Tasks:**
1. Create common foods list
2. Build SolidFeedingForm component
3. Implement food suggestions/autocomplete
4. Add amount selector

**Definition of Done:**
- [x] All tests pass (245 tests, including 17 new solid feeding validator tests)
- [x] Can log food type via quick select or custom input
- [x] Food suggestions work (recent foods from history, common foods fallback)
- [x] Amount tracking works (a little, some, a lot)
- [x] Recent foods shown for quick entry

**Architecture Rethink - Reaction-Based Tracking:**

Based on research of 10 baby tracker apps (Huckleberry, Solid Starts, Glow Baby, etc.), replaced amount tracking with reaction tracking since parents care more about whether baby liked the food than how much they ate.

- [x] Added `SolidReaction` type: `"loved" | "meh" | "refused"` (3 options like Huckleberry)
- [x] Updated storage interfaces to support reaction field
- [x] Added `validateSolidReaction()` validator with tests
- [x] Replaced amount buttons with emoji reaction buttons (😍 Loved it | 😐 Meh | 😣 Refused)
- [x] Updated timeline to display reaction with emoji (e.g., "Banana · 😍 Loved it")
- [x] Added reaction translations to i18n
- [x] Fixed food input styling (min-height 48px, proper padding, light green background)
- [x] All 250 tests pass

---

#### Branch: `feature/feeding-log-past-ux`
**Scope:** Update "Log Past Feeding" UX to match diaper/sleep pattern

**Why This Change:**
- Currently "Log Past Feeding" is a 4th option in FeedingTypeMenu alongside breastfeeding, bottle, and solid
- Diaper and sleep screens have "Log Past" buttons within the activity screen itself
- This change makes the feeding UX consistent with other activities

**Tasks:**
1. Remove "Log Past Feeding" option from `FeedingTypeMenu.tsx`
2. Add "Log Past Breastfeeding" button to `breastfeed.tsx` (shown when timer not running)
3. Add "Log Past Bottle Feeding" button to `bottle.tsx`
4. Add "Log Past Solid Food" button to `solids.tsx`
5. Update `manual.tsx` to accept `type` query parameter (breastfeed/bottle/solids)
6. When type param provided, show only that type's form (no tabs)
7. Add solid food manual entry support to `manual.tsx`
8. Add new translation keys

**Files to Modify:**
- `src/components/FeedingTypeMenu.tsx` - Remove manual option
- `app/feeding/breastfeed.tsx` - Add "Log Past" button
- `app/feeding/bottle.tsx` - Add "Log Past" button
- `app/feeding/solids.tsx` - Add "Log Past" button
- `app/feeding/manual.tsx` - Accept type param, add solids support
- `src/i18n/locales/en.json` - Add new translations
- `app/(tabs)/index.tsx` - Remove manual option handling

**Definition of Done:**
- [ ] FeedingTypeMenu shows only 3 options (breastfeed, bottle, solids)
- [ ] Breastfeeding screen shows "Log Past Breastfeeding" button
- [ ] Bottle screen shows "Log Past Bottle Feeding" button
- [ ] Solids screen shows "Log Past Solid Food" button
- [ ] Manual entry shows type-specific UI when type param provided
- [ ] Can manually log past solid food entries
- [ ] All unit tests pass
- [ ] UX matches diaper/sleep pattern

---

#### Branch: `feature/sleep-tracking`
**Scope:** Sleep tracking with timer, nap vs night distinction

**TDD Approach:**
```typescript
// Unit tests
describe('Sleep utilities', () => {
  it('should determine if sleep is nap or night based on time', () => {});
  it('should calculate total sleep for a day', () => {});
  it('should format sleep duration', () => {});
});

describe('Sleep validators', () => {
  it('should require start time', () => {});
  it('should validate end time is after start', () => {});
  it('should auto-categorize based on duration and time', () => {});
});

// Component tests
describe('SleepTimer', () => {
  it('should start sleep timer', () => {});
  it('should show nap/night toggle', () => {});
  it('should display running duration', () => {});
  it('should save sleep session on stop', () => {});
});
```

**E2E Test (Maestro):**
```yaml
# e2e/sleep-flow.yaml
appId: com.babytracker.app
---
- launchApp
- tapOn: "Log"
- tapOn: "Sleep"
- tapOn: "Start Sleep"
- assertVisible: "Sleep Timer Running"
- tapOn: "Nap"
- extendedWaitUntil:
    visible: "0:00:03"
    timeout: 5000
- tapOn: "Wake Up"
- assertVisible: "Sleep Saved"
```

**Tasks:**
1. Create sleep utility functions
2. Build SleepTimer component
3. Implement nap/night auto-detection
4. Add sleep to Timeline
5. Build sleep notification

**Edge Cases:**
- Sleep spanning midnight
- Very long sleep sessions (>12 hours)
- Multiple short naps

**Definition of Done:**
- [x] All tests pass (335 tests, including 45 sleep validator tests, 22 sleep storage tests, 18 sleep context tests)
- [x] Timer works correctly
- [x] Nap/night distinction works (auto-detection based on time of day)
- [x] Timer survives app background/kill (via AsyncStorage persistence)
- [x] Sleep displayed in Timeline
- [x] Home dashboard shows real sleep data
- [x] Sleep tracking screen with timer UI

---

#### Branch: `feature/sleep-manual-entry`
**Scope:** Manual/retroactive sleep entry (similar to feeding manual entry)

**TDD Approach:**
```typescript
// Unit tests
describe('Manual sleep validators', () => {
  it('should validate start time is not in future', () => {});
  it('should require duration for manual entry', () => {});
  it('should validate duration is at least 1 minute', () => {});
  it('should validate duration is not over 24 hours', () => {});
  it('should require sleep type (nap or night)', () => {});
});
```

**Tasks:**
1. Create manual sleep screen (`app/sleep/manual.tsx`)
2. Add date/time picker for start time (defaults to now)
3. Add duration picker with quick duration buttons (15, 30, 45 min, 1h, 2h, etc.)
4. Add nap/night type selector
5. Reuse existing `validateManualSleep` validator
6. Add "Log Past Sleep" option accessible from home screen sleep card

**Definition of Done:**
- [x] All tests pass
- [x] Can manually enter nap with start time and duration
- [x] Can manually enter night sleep with start time and duration
- [x] Start time defaults to current time but can be changed
- [x] Validation prevents future times and unreasonable durations
- [x] Entries appear correctly in Timeline

---

#### Branch: `feature/diaper-tracking`
**Scope:** Diaper change tracking with type and stool color

**Design:** Use `/frontend-design` skill to create:
- Quick-tap buttons for Wet/Dirty/Mixed (one-tap logging for wet)
- Visual color picker with color swatches (not text dropdown)
- Color swatches that are colorblind-accessible (with labels)
- Confirmation feedback on save

**TDD Approach:**
```typescript
// Unit tests
describe('Diaper validators', () => {
  it('should require diaper type', () => {});
  it('should validate stool color is from predefined list', () => {});
  it('should allow stool color only for dirty/mixed', () => {});
});

describe('Stool color constants', () => {
  it('should have predefined color options', () => {
    expect(STOOL_COLORS).toContain('yellow');
    expect(STOOL_COLORS).toContain('brown');
    expect(STOOL_COLORS).toContain('green');
    expect(STOOL_COLORS).toContain('black');
    expect(STOOL_COLORS).toContain('white');
    expect(STOOL_COLORS).toContain('red');
  });
});

// Component tests
describe('DiaperForm', () => {
  it('should render wet/dirty/mixed buttons', () => {});
  it('should show color picker for dirty diapers', () => {});
  it('should hide color picker for wet diapers', () => {});
  it('should save diaper change', () => {});
});
```

**Tasks:**
1. Create diaper constants (types, colors)
2. Build DiaperForm component
3. Create color picker component
4. Add diaper to Timeline
5. Include color in export reports

**Stool Color Options:**
- Yellow (mustard)
- Brown
- Green
- Black (meconium)
- White/Pale
- Red-tinged
- Orange

**Definition of Done:**
- [x] All tests pass (394 tests, including 24 diaper validator tests, 21 diaper storage tests, 14 diaper context tests)
- [x] Quick log with single tap (wet)
- [x] Color selection for dirty/mixed
- [ ] Colors included in data export (deferred - data export not yet implemented)
- [x] Displayed in Timeline

---

#### Branch: `feature/diaper-manual-entry`
**Scope:** Allow retroactive diaper logging with custom time

**TDD Approach:**
```typescript
// Unit tests
describe('Manual diaper validators', () => {
  it('should validate change time is not in future', () => {});
  it('should require diaper type', () => {});
});
```

**Tasks:**
1. Add date/time picker to diaper form (defaults to now)
2. Allow user to change time for retroactive logging
3. Reuse existing diaper validators

**Definition of Done:**
- [x] All tests pass (implemented as part of diaper-tracking)
- [x] Can log diaper change with custom time
- [x] Time defaults to now but can be changed
- [x] Entries appear correctly in Timeline with correct time

---

#### Branch: `feature/pumping-tracking`
**Scope:** Pumping session tracking with timer and volume

**TDD Approach:**
```typescript
// Unit tests
describe('Pumping validators', () => {
  it('should require start time', () => {});
  it('should validate volume is positive', () => {});
  it('should validate side is left, right, or both', () => {});
});

// Component tests
describe('PumpingTimer', () => {
  it('should start pumping timer', () => {});
  it('should allow side selection', () => {});
  it('should prompt for volume on stop', () => {});
  it('should save pumping session', () => {});
});
```

**Tasks:**
1. Build PumpingTimer component
2. Implement volume input after timer stop
3. Add side tracking (left/right/both)
4. Add pumping to Timeline

**Definition of Done:**
- [x] All tests pass
- [x] Timer works correctly
- [x] Volume entry in ml/oz
- [x] Side tracking works
- [x] Displayed in Timeline

---

#### Branch: `feature/pumping-manual-entry`
**Scope:** Manual/retroactive pumping entry (similar to feeding manual entry)

**TDD Approach:**
```typescript
// Unit tests
describe('Manual pumping validators', () => {
  it('should validate start time is not in future', () => {});
  it('should require volume for manual entry', () => {});
  it('should validate volume is positive and reasonable', () => {});
  it('should validate side is left, right, or both', () => {});
});
```

**Tasks:**
1. Create manual pumping screen (`app/pumping/manual.tsx`)
2. Add date/time picker for start time (defaults to now)
3. Add duration picker with quick duration buttons (5, 10, 15, 20, 30 min)
4. Add volume input with ml/oz toggle
5. Add side selector (left/right/both)
6. Add "Log Past Pumping" option accessible from home screen

**Definition of Done:**
- [x] All tests pass
- [x] Can manually enter pumping with start time, duration, and volume
- [x] Side selection works
- [x] Start time defaults to current time but can be changed
- [x] Validation prevents future times and unreasonable values
- [x] Entries appear correctly in Timeline

---

#### Branch: `feature/growth-tracking`
**Scope:** Height, weight, head circumference tracking

**TDD Approach:**
```typescript
// Unit tests
describe('Growth utilities', () => {
  it('should convert kg to lbs', () => {});
  it('should convert lbs to kg', () => {});
  it('should convert cm to inches', () => {});
  it('should calculate BMI', () => {});
});

describe('Growth validators', () => {
  it('should require at least one measurement', () => {});
  it('should validate weight within reasonable range', () => {});
  it('should validate height within reasonable range', () => {});
  it('should require measurement date', () => {});
});

// Component tests
describe('GrowthForm', () => {
  it('should render weight input', () => {});
  it('should render height input', () => {});
  it('should render head circumference input', () => {});
  it('should toggle between metric and imperial', () => {});
  it('should save measurement', () => {});
});
```

**Tasks:**
1. Create growth utility functions
2. Build GrowthForm component
3. Implement unit preferences (kg/lbs, cm/in)
4. Create growth history view
5. Add growth to Timeline

**Definition of Done:**
- [x] All tests pass (577 tests, including 36 growth utility tests, 38 growth validator tests, 20 growth storage tests, 14 growth context tests)
- [x] All measurements can be recorded (weight, height, head circumference)
- [ ] Unit preferences work (deferred - requires user settings feature)
- [ ] History view shows all measurements (deferred - can add in future enhancement)
- [x] Displayed in Timeline
- [x] Growth tracking screen with form for weight, height, head circumference
- [x] Integrated with Home dashboard (shows last measurement date)
- [x] GrowthStorageService for AsyncStorage persistence
- [x] GrowthContext provider with state management

---

#### Branch: `feature/tummy-time`
**Scope:** Tummy time tracking with daily goals

**Design:** Use `/frontend-design` skill to create:
- Circular progress ring showing daily goal progress
- Timer display similar to other timers (consistency)
- Goal completion celebration (subtle animation/feedback)
- Easy goal adjustment in settings

**TDD Approach:**
```typescript
// Unit tests
describe('Tummy time utilities', () => {
  it('should calculate daily total', () => {});
  it('should calculate progress toward goal', () => {
    expect(calculateProgress(900, 1800)).toBe(50); // 50%
  });
  it('should format goal progress', () => {});
});

describe('Tummy time validators', () => {
  it('should require start time', () => {});
  it('should validate daily goal is positive', () => {});
});

// Component tests
describe('TummyTimeTimer', () => {
  it('should display current session timer', () => {});
  it('should show daily progress', () => {});
  it('should show goal completion status', () => {});
});

describe('TummyTimeGoalSetting', () => {
  it('should allow setting daily goal in minutes', () => {});
  it('should persist goal setting', () => {});
});
```

**Tasks:**
1. Create tummy time utilities
2. Build TummyTimeTimer component
3. Build goal setting component
4. Create daily progress indicator
5. Add celebration for goal completion

**Definition of Done:**
- [x] All tests pass
- [x] Timer works correctly
- [x] Daily goal can be set
- [x] Progress toward goal displayed
- [x] Goal completion celebrated

---

#### Branch: `feature/tummy-time-manual-entry`
**Scope:** Manual/retroactive tummy time entry

**TDD Approach:**
```typescript
// Unit tests
describe('Manual tummy time validators', () => {
  it('should validate start time is not in future', () => {});
  it('should require duration for manual entry', () => {});
  it('should validate duration is at least 1 minute', () => {});
  it('should validate duration is reasonable (max 2 hours)', () => {});
});
```

**Tasks:**
1. Create manual tummy time screen (`app/tummy-time/manual.tsx`)
2. Add date/time picker for start time (defaults to now)
3. Add duration picker with quick duration buttons (1, 2, 3, 5, 10, 15 min)
4. Update daily progress after manual entry
5. Add "Log Past Tummy Time" option accessible from home screen

**Definition of Done:**
- [x] All tests pass
- [x] Can manually enter tummy time with start time and duration
- [x] Start time defaults to current time but can be changed
- [x] Manual entries count toward daily goal progress
- [x] Validation prevents future times and unreasonable durations
- [x] Entries appear correctly in Timeline

---

#### Branch: `feature/tummy-time-smart-goals`
**Scope:** Age-based smart goals with user customization based on AAP/WHO research

**Research-Backed Goals:**
| Baby Age | Default Goal | Rationale |
|----------|--------------|-----------|
| 0-4 weeks | 15 min | Realistic for newborns |
| 1-2 months | 30 min | WHO baseline |
| 2-3 months | 45 min | Building toward 60 min |
| 3-6 months | 60 min | AAP target |
| 6+ months | 60 min | With transition note |

**TDD Approach:**
```typescript
// Unit tests for goal utilities
describe('Tummy time goal utilities', () => {
  it('should return 15 min goal for 0-4 weeks', () => {});
  it('should return 30 min goal for 1-2 months', () => {});
  it('should return 45 min goal for 2-3 months', () => {});
  it('should return 60 min goal for 3-6 months', () => {});
  it('should return 60 min goal for 6+ months', () => {});
  it('should return age group label for birthdate', () => {});
  it('should suggest goal update when crossing milestone', () => {});
});

// Storage tests
describe('TummyTimeStorageService goal methods', () => {
  it('should detect if user has custom goal set', () => {});
  it('should return age-based goal when no custom goal', () => {});
  it('should return custom goal when set', () => {});
  it('should track goal suggestion dismissals', () => {});
});
```

**Tasks:**
1. Add goal calculation utilities to `src/utils/tummyTime.ts`
2. Update TummyTimeStorageService with hasCustomGoal, goal suggestion tracking
3. Update TummyTimeContext with goalSource, setDailyGoal
4. Create goal settings screen (`app/tummyTime/settings.tsx`)
5. Add goal suggestion modal component
6. Update main tummy time screen with settings link and goal source
7. Add 6+ months transition note
8. Add new translation keys

**Definition of Done:**
- [ ] All tests pass
- [ ] Goal defaults to age-appropriate value based on baby birthdate
- [ ] User can customize goal from settings screen
- [ ] Goal source shown ("Based on AAP guidelines" vs "Your custom goal")
- [ ] Suggestion modal appears when baby crosses age milestone
- [ ] User can dismiss suggestion or update goal
- [ ] 6+ month babies see transition note about floor play
- [ ] Custom goal persists and isn't overwritten

---

#### Branch: `feature/timeline-view`
**Scope:** Chronological list of all entries

**Design:** Use `/frontend-design` skill to create:
- Clean timeline cards with activity icons
- Clear day grouping headers
- "Time since" display for recent entries
- Swipe-to-delete with confirmation
- Empty state for new users (encouraging, not empty)

**TDD Approach:**
```typescript
// Unit tests
describe('Timeline utilities', () => {
  it('should merge all activity types chronologically', () => {});
  it('should group activities by day', () => {});
  it('should format relative time', () => {});
});

// Component tests
describe('Timeline', () => {
  it('should render activities in reverse chronological order', () => {});
  it('should show day headers', () => {});
  it('should render different activity types with correct icons', () => {});
  it('should allow infinite scroll', () => {});
  it('should show empty state when no activities', () => {});
});

describe('TimelineItem', () => {
  it('should display activity details', () => {});
  it('should navigate to edit on tap', () => {});
  it('should show delete option on long press', () => {});
});
```

**E2E Test:**
```yaml
# e2e/timeline-flow.yaml
appId: com.babytracker.app
---
- launchApp
- assertVisible: "Timeline"
- scroll:
    direction: DOWN
- assertVisible: "Yesterday"
- tapOn:
    id: "timeline-item-0"
- assertVisible: "Edit"
```

**Tasks:**
1. Create timeline data merging logic
2. Build Timeline screen
3. Build TimelineItem component
4. Implement infinite scroll
5. Add day grouping headers
6. Implement edit navigation
7. Add delete with confirmation

**Definition of Done:**
- [ ] All tests pass
- [ ] All activity types shown
- [ ] Chronological order correct
- [ ] Day headers displayed
- [ ] Edit works for all types
- [ ] Delete works with confirmation
- [ ] Performance good with 1000+ items

---

#### Branch: `feature/edit-delete-entries`
**Scope:** Edit and delete any logged entry

**TDD Approach:**
```typescript
// Unit tests
describe('Entry editing', () => {
  it('should preserve original created_at', () => {});
  it('should update updated_at on edit', () => {});
});

// Component tests
describe('EditEntryScreen', () => {
  it('should load existing entry data', () => {});
  it('should save changes', () => {});
  it('should show delete button', () => {});
  it('should confirm before delete', () => {});
});
```

**Tasks:**
1. Create edit screens for each entry type
2. Implement update logic
3. Add delete confirmation modal
4. Update Timeline after edit/delete

**Definition of Done:**
- [ ] All tests pass
- [ ] Can edit all entry types
- [ ] Can delete all entry types
- [ ] Delete confirmation required
- [ ] Timeline updates immediately

---

#### Branch: `feature/basic-statistics`
**Scope:** Daily/weekly summaries and charts

**Design:** Use `/frontend-design` skill to create:
- Glanceable stat cards with large numbers
- Clean, simple charts (not cluttered)
- Day/week toggle with smooth transition
- Tummy time goal progress prominently displayed

**TDD Approach:**
```typescript
// Unit tests
describe('Statistics calculations', () => {
  it('should calculate total feedings per day', () => {});
  it('should calculate average feeding duration', () => {});
  it('should calculate total sleep per day', () => {});
  it('should calculate diaper counts by type', () => {});
  it('should calculate weekly averages', () => {});
  it('should calculate tummy time progress', () => {});
});

// Component tests
describe('StatisticsScreen', () => {
  it('should display daily summary', () => {});
  it('should display weekly summary', () => {});
  it('should render feeding chart', () => {});
  it('should render sleep chart', () => {});
});
```

**Tasks:**
1. Create statistics calculation utilities
2. Build daily summary component
3. Build weekly summary component
4. Implement basic charts (bar/line)
5. Add tummy time goal progress

**Definition of Done:**
- [ ] All tests pass
- [ ] Daily stats accurate
- [ ] Weekly stats accurate
- [ ] Charts render correctly
- [ ] Tummy time progress shown

---

#### Branch: `feature/dark-mode`
**Scope:** System-aware dark theme

**TDD Approach:**
```typescript
// Unit tests
describe('Theme utilities', () => {
  it('should detect system theme', () => {});
  it('should apply dark theme colors', () => {});
  it('should apply light theme colors', () => {});
});

// Component tests
describe('ThemeProvider', () => {
  it('should provide theme context', () => {});
  it('should switch theme based on system', () => {});
  it('should allow manual override', () => {});
});
```

**Tasks:**
1. Create theme constants
2. Build ThemeProvider context
3. Implement system theme detection
4. Apply dark/light styles throughout app
5. Add manual theme toggle in settings

**Definition of Done:**
- [ ] All tests pass
- [ ] Follows system theme
- [ ] Manual override works
- [ ] All screens support both themes
- [ ] Theme persists across restarts

---

#### Branch: `feature/night-mode`
**Scope:** Extra dim/red mode for late night

**TDD Approach:**
```typescript
// Component tests
describe('NightMode', () => {
  it('should apply red tint overlay', () => {});
  it('should reduce brightness', () => {});
  it('should toggle from settings', () => {});
  it('should auto-enable based on time (optional)', () => {});
});
```

**Tasks:**
1. Create night mode styles (red tint, low contrast)
2. Add night mode toggle
3. Implement optional auto-enable (sunset to sunrise)
4. Apply night mode overlay

**Definition of Done:**
- [ ] All tests pass
- [ ] Night mode reduces eye strain
- [ ] Easy to toggle
- [ ] Works with dark mode

---

#### Branch: `feature/settings-screen`
**Scope:** App settings and preferences

**TDD Approach:**
```typescript
// Component tests
describe('SettingsScreen', () => {
  it('should display unit preferences', () => {});
  it('should display theme settings', () => {});
  it('should display baby management', () => {});
  it('should display export options', () => {});
  it('should display about section', () => {});
});
```

**Tasks:**
1. Build Settings screen structure
2. Implement unit preferences (metric/imperial)
3. Add theme settings
4. Add baby management link
5. Add export options
6. Add about/version info

**Definition of Done:**
- [ ] All tests pass
- [ ] All settings persist
- [ ] Navigation to sub-screens works
- [ ] Settings applied immediately

---

### Phase 1 Gate Checklist

**All items must be checked before proceeding to Phase 2:**

- [ ] All feature branches merged to main
- [ ] All unit tests pass (100%)
- [ ] All component tests pass (100%)
- [ ] All E2E tests pass (100%)
- [ ] CI pipeline green
- [ ] App runs on iOS simulator without crashes
- [ ] App runs on Android emulator without crashes
- [ ] UI/UX Foundation complete:
  - [ ] Design tokens configured (colors, typography, spacing)
  - [ ] Dashboard cards show "time since" prominently
  - [ ] Activity color coding consistent
  - [ ] All touch targets >= 48px
  - [ ] Home screen matches ui-ux-design-plan layout
  - [ ] Dark mode works throughout
- [ ] Can add and switch between multiple babies
- [ ] All tracking features work:
  - [ ] Breastfeeding with timer and side memory
  - [ ] Bottle feeding with volume
  - [ ] Solid food tracking
  - [ ] Sleep tracking with timer
  - [ ] Diaper tracking with stool color
  - [x] Pumping tracking with timer
  - [ ] Growth measurements
  - [ ] Tummy time with goals
- [ ] Timers survive app background
- [ ] Timers survive app kill/restart
- [ ] Timeline shows all entries correctly
- [ ] Edit/delete works for all entry types
- [ ] Basic statistics display correctly
- [ ] Dark mode works
- [ ] Night mode works
- [ ] Settings persist across restarts
- [ ] Performance acceptable with 100+ entries
- [ ] No memory leaks detected
- [ ] Code coverage > 80%

**Developer Manual Testing Sign-off:**
- [ ] Developer has manually tested all Phase 1 features and confirmed working

---

## Phase 2: Multi-Caregiver Sync

### Objective
Enable real-time sync between multiple caregivers with offline-first architecture.

### Feature Branches

#### Branch: `feature/authentication`
**Scope:** Optional email authentication with Supabase Auth

**TDD Approach:**
```typescript
// Unit tests
describe('Auth validators', () => {
  it('should validate email format', () => {});
  it('should validate password requirements', () => {});
});

// Component tests
describe('AuthFlow', () => {
  it('should allow anonymous usage', () => {});
  it('should show sign up option', () => {});
  it('should show sign in option', () => {});
  it('should handle magic link auth', () => {});
  it('should handle email/password auth', () => {});
  it('should persist auth state', () => {});
});
```

**Tasks:**
1. Configure Supabase Auth
2. Implement anonymous auth (default)
3. Build sign up screen
4. Build sign in screen
5. Implement magic link auth
6. Build auth state management
7. Add upgrade from anonymous to email account

**Edge Cases:**
- Migrating data from anonymous to authenticated account
- Multiple devices with same account
- Session expiry handling

**Definition of Done:**
- [ ] All tests pass
- [ ] Anonymous usage works
- [ ] Email sign up works
- [ ] Email sign in works
- [ ] Magic link works
- [ ] Auth persists across restarts
- [ ] Anonymous to email upgrade preserves data

---

#### Branch: `feature/household-creation`
**Scope:** Create household and generate invite code

**TDD Approach:**
```typescript
// Unit tests
describe('Invite code utilities', () => {
  it('should generate 8-character alphanumeric code', () => {});
  it('should be case-insensitive for input', () => {});
  it('should exclude ambiguous characters (0, O, l, 1)', () => {});
});

// Component tests
describe('HouseholdSetup', () => {
  it('should create household on first sign up', () => {});
  it('should display invite code', () => {});
  it('should allow copying invite code', () => {});
  it('should allow sharing invite code', () => {});
});
```

**Tasks:**
1. Create invite code generator
2. Build household creation flow
3. Display invite code screen
4. Implement copy/share functionality
5. Link user to household

**Definition of Done:**
- [ ] All tests pass
- [ ] Household created automatically
- [ ] Invite code displayed clearly
- [ ] Copy to clipboard works
- [ ] Share sheet works

---

#### Branch: `feature/join-household`
**Scope:** Join existing household via invite code

**TDD Approach:**
```typescript
// Unit tests
describe('Join household validators', () => {
  it('should validate code length', () => {});
  it('should validate code format', () => {});
  it('should handle invalid codes gracefully', () => {});
});

// Component tests
describe('JoinHousehold', () => {
  it('should show code input', () => {});
  it('should validate code on submit', () => {});
  it('should show error for invalid code', () => {});
  it('should join household on valid code', () => {});
  it('should sync existing data after joining', () => {});
});
```

**E2E Test:**
```yaml
# e2e/join-household.yaml
appId: com.babytracker.app
---
- launchApp
- tapOn: "Join Family"
- inputText:
    id: "invite-code-input"
    text: "ABC123XY"
- tapOn: "Join"
- assertVisible: "Welcome to the family!"
```

**Tasks:**
1. Build join household screen
2. Implement code validation
3. Handle joining flow
4. Merge or replace local data
5. Start sync after joining

**Edge Cases:**
- User has existing local data when joining
- Code case sensitivity
- Network failure during join

**Definition of Done:**
- [ ] All tests pass
- [ ] Code input works
- [ ] Invalid codes show error
- [ ] Join successful syncs data
- [ ] Local data handled appropriately

---

#### Branch: `feature/realtime-sync`
**Scope:** Real-time sync between caregivers (< 5 seconds)

**TDD Approach:**
```typescript
// Integration tests
describe('Real-time sync', () => {
  it('should sync new entry within 5 seconds', async () => {});
  it('should sync edited entry within 5 seconds', async () => {});
  it('should sync deleted entry within 5 seconds', async () => {});
  it('should show sync status indicator', () => {});
  it('should handle temporary disconnection', async () => {});
});
```

**Tasks:**
1. Configure PowerSync real-time sync
2. Implement sync status indicator
3. Add sync status to header
4. Test sync latency
5. Implement retry logic

**Definition of Done:**
- [ ] All tests pass
- [ ] Sync happens < 5 seconds
- [ ] Sync indicator shows status
- [ ] Offline changes sync when reconnected
- [ ] No data loss during sync

---

#### Branch: `feature/conflict-resolution`
**Scope:** Handle simultaneous edits gracefully

**TDD Approach:**
```typescript
// Unit tests
describe('Conflict resolution', () => {
  it('should use last-write-wins for simple conflicts', () => {});
  it('should merge non-overlapping field changes', () => {});
  it('should preserve both entries for create conflicts', () => {});
  it('should handle delete conflicts', () => {});
});
```

**Conflict Scenarios:**
1. Same entry edited by two users → Last write wins
2. Same entry edited with different fields → Merge
3. Entry deleted by one, edited by another → Keep edited version with flag
4. Simultaneous creates → Both preserved

**Tasks:**
1. Implement conflict detection
2. Build conflict resolution logic
3. Add conflict logging for debugging
4. Handle edge cases

**Definition of Done:**
- [ ] All tests pass
- [ ] No data loss from conflicts
- [ ] Conflicts resolved automatically
- [ ] Users not bothered by conflicts

---

#### Branch: `feature/caregiver-management`
**Scope:** Add/remove caregivers, view household members

**TDD Approach:**
```typescript
// Component tests
describe('CaregiverManagement', () => {
  it('should display list of caregivers', () => {});
  it('should show caregiver names', () => {});
  it('should show invite code for adding more', () => {});
  it('should allow removing caregivers (owner only)', () => {});
  it('should confirm before removing', () => {});
});
```

**Tasks:**
1. Build caregivers list screen
2. Display caregiver information
3. Implement remove caregiver (with confirmation)
4. Show who logged each entry
5. Regenerate invite code option

**Definition of Done:**
- [ ] All tests pass
- [ ] Caregivers list displays correctly
- [ ] Remove caregiver works
- [ ] Entry shows who logged it
- [ ] Regenerate code works

---

#### Branch: `feature/offline-first`
**Scope:** Full functionality without internet

**TDD Approach:**
```typescript
// Integration tests
describe('Offline functionality', () => {
  it('should allow logging when offline', () => {});
  it('should queue changes for sync', () => {});
  it('should show offline indicator', () => {});
  it('should sync queue when online', () => {});
  it('should handle large offline queue', () => {});
});
```

**Tasks:**
1. Verify all features work offline
2. Add offline indicator
3. Show pending sync count
4. Test with airplane mode
5. Stress test with large queue

**Edge Cases:**
- App offline for days
- 100+ changes queued
- Conflicting offline changes from multiple devices

**Definition of Done:**
- [ ] All tests pass
- [ ] All features work offline
- [ ] Clear offline indicator
- [ ] Pending changes shown
- [ ] Large queue syncs correctly

---

### Phase 2 Gate Checklist

**All items must be checked before proceeding to Phase 3:**

- [ ] All feature branches merged to main
- [ ] All tests pass (100%)
- [ ] CI pipeline green
- [ ] Anonymous authentication works
- [ ] Email authentication works
- [ ] Magic link authentication works
- [ ] Household creation works
- [ ] Invite code generation works
- [ ] Join household works
- [ ] Real-time sync < 5 seconds
- [ ] Sync works between iOS and Android
- [ ] Conflict resolution works correctly
- [ ] Caregiver management works
- [ ] Full offline functionality
- [ ] Offline indicator visible
- [ ] Pending sync indicator works
- [ ] Data migration from anonymous works
- [ ] No data loss in any scenario tested
- [ ] Performance acceptable with sync
- [ ] Battery usage acceptable with sync

**Developer Manual Testing Sign-off:**
- [ ] Developer has manually tested all Phase 2 features and confirmed working

---

## Phase 3: Native Extensions

### Objective
Build Apple Watch app, iOS/Android widgets, Live Activities, and native background timers.

### Feature Branches

#### Branch: `feature/ios-watch-app`
**Scope:** Full Apple Watch app with complications

**TDD Approach:**
- Write XCTest unit tests for Watch logic
- Write UI tests for Watch flows

**Tasks:**
1. Create Watch app target (Swift/SwiftUI)
2. Set up App Groups for data sharing
3. Build Watch home screen:
   - Recent activity summary
   - Quick log buttons
4. Implement Watch timer for:
   - Breastfeeding (with side selection)
   - Sleep
   - Pumping
   - Tummy time
5. Build complications:
   - Current timer status
   - Last feeding time
   - Sleep summary
6. Implement Watch ↔ Phone sync via App Groups
7. Add haptic feedback

**Watch Screens:**
- Home (summary + quick actions)
- Feeding (type selection → timer)
- Sleep (start/stop)
- Diaper (quick log)
- Timer (running timer display)

**Definition of Done:**
- [ ] Watch app installs and launches
- [ ] All timers work on Watch
- [ ] Complications update correctly
- [ ] Data syncs to phone
- [ ] Haptic feedback works
- [ ] Double-tap quick action (watchOS 10+)

---

#### Branch: `feature/ios-widgets`
**Scope:** iOS home screen widgets (WidgetKit)

**TDD Approach:**
- Write unit tests for widget data formatting

**Tasks:**
1. Create Widget extension target
2. Set up App Groups for data sharing
3. Build widget sizes:
   - Small: Last feeding time, "time since"
   - Medium: Last feeding + sleep summary
   - Large: Day summary with quick actions
4. Implement widget deep links
5. Add widget configuration (select baby)

**Definition of Done:**
- [ ] All widget sizes work
- [ ] Data updates regularly
- [ ] Tap opens correct screen
- [ ] Baby selection works
- [ ] Widget gallery entry looks good

---

#### Branch: `feature/live-activities`
**Scope:** Lock screen timer display (iOS)

**TDD Approach:**
- Test Live Activity lifecycle

**Tasks:**
1. Create ActivityKit configuration
2. Implement Live Activity for timers:
   - Breastfeeding
   - Sleep
   - Pumping
   - Tummy time
3. Build Dynamic Island UI (if applicable)
4. Build Lock Screen UI
5. Implement start/stop from Lock Screen
6. Handle activity expiration

**Definition of Done:**
- [ ] Live Activity starts with timer
- [ ] Timer updates on Lock Screen
- [ ] Dynamic Island shows status
- [ ] Stop action works from Lock Screen
- [ ] Activity expires correctly

---

#### Branch: `feature/android-widgets`
**Scope:** Android home screen widgets

**TDD Approach:**
- Write unit tests for widget data

**Tasks:**
1. Create widget with Jetpack Glance or traditional approach
2. Build widget layouts:
   - Small: Last feeding + time since
   - Large: Day summary
3. Implement widget tap actions
4. Add widget configuration
5. Set up data refresh

**Definition of Done:**
- [ ] Widgets display correctly
- [ ] Data refreshes regularly
- [ ] Tap opens correct screen
- [ ] Configuration works
- [ ] Works on Android 10+

---

#### Branch: `feature/native-background-timers`
**Scope:** Bulletproof timer persistence

**TDD Approach:**
```typescript
// Integration tests
describe('Background timers', () => {
  it('should continue when app is backgrounded', () => {});
  it('should persist through app kill', () => {});
  it('should restore after device restart', () => {});
  it('should show notification while running', () => {});
});
```

**Tasks:**
1. Create native module for iOS timer persistence
2. Create native module for Android timer persistence
3. Implement foreground service (Android)
4. Store timer start time in native storage
5. Restore timer on app launch
6. Show persistent notification while timer running

**Edge Cases:**
- Device restart while timer running
- App force killed
- Low memory situation
- Doze mode (Android)

**Definition of Done:**
- [ ] Timer survives app background
- [ ] Timer survives app kill
- [ ] Timer survives device restart
- [ ] Notification shows while running
- [ ] Works on both platforms

---

#### Branch: `feature/siri-shortcuts`
**Scope:** Voice logging via Siri

**TDD Approach:**
- Test intent handling

**Tasks:**
1. Define App Intents:
   - "Log wet diaper"
   - "Log dirty diaper"
   - "Start breastfeeding"
   - "Start sleep"
   - "Stop timer"
2. Create intent handlers
3. Add to Shortcuts app
4. Test voice activation

**Shortcuts to Support:**
- "Hey Siri, log wet diaper for [baby name]"
- "Hey Siri, start breastfeeding"
- "Hey Siri, stop the timer"

**Definition of Done:**
- [ ] Intents defined correctly
- [ ] Voice commands work
- [ ] Appears in Shortcuts app
- [ ] Confirmation provided

---

### Phase 3 Gate Checklist

**All items must be checked before proceeding to Phase 4:**

- [ ] All feature branches merged to main
- [ ] All tests pass
- [ ] CI pipeline green
- [ ] Apple Watch app works:
  - [ ] Timer functionality
  - [ ] Quick logging
  - [ ] Complications
  - [ ] Data sync to phone
- [ ] iOS widgets work:
  - [ ] All sizes display correctly
  - [ ] Data updates
  - [ ] Deep links work
- [ ] Live Activities work:
  - [ ] Timer on Lock Screen
  - [ ] Dynamic Island (if applicable)
  - [ ] Actions work
- [ ] Android widgets work:
  - [ ] Display correctly
  - [ ] Data updates
  - [ ] Tap actions work
- [ ] Background timers bulletproof:
  - [ ] Survive app background
  - [ ] Survive app kill
  - [ ] Survive device restart
- [ ] Siri Shortcuts functional
- [ ] Battery usage acceptable
- [ ] All platforms tested on real devices

**Developer Manual Testing Sign-off:**
- [ ] Developer has manually tested all Phase 3 features and confirmed working

---

## Phase 4: Data Export & Advanced Features

### Objective
Complete data export, growth charts, notifications, and remaining features.

### Feature Branches

#### Branch: `feature/csv-export`
**Scope:** Export all data to CSV format

**TDD Approach:**
```typescript
// Unit tests
describe('CSV export', () => {
  it('should format feedings as CSV', () => {});
  it('should format sleep sessions as CSV', () => {});
  it('should format all data types', () => {});
  it('should handle special characters', () => {});
  it('should use correct date format', () => {});
  it('should include stool colors in diaper export', () => {});
});
```

**Tasks:**
1. Create CSV generation utilities
2. Build export selection screen
3. Implement date range selection
4. Generate CSV for each data type
5. Create combined export option
6. Implement file sharing

**CSV Columns for Diapers:**
- Date/Time
- Type (wet/dirty/mixed)
- Stool Color (if applicable)
- Notes
- Logged By

**Definition of Done:**
- [ ] All tests pass
- [ ] All data types exportable
- [ ] Date range selection works
- [ ] Share sheet works
- [ ] File opens correctly in Excel/Sheets

---

#### Branch: `feature/pdf-reports`
**Scope:** Formatted PDF reports for pediatrician

**TDD Approach:**
```typescript
// Unit tests
describe('PDF generation', () => {
  it('should generate feeding summary', () => {});
  it('should generate sleep summary', () => {});
  it('should generate growth chart', () => {});
  it('should generate diaper summary with colors', () => {});
  it('should format dates correctly', () => {});
});
```

**Tasks:**
1. Choose PDF library (react-native-pdf-lib or similar)
2. Design PDF template
3. Build report sections:
   - Baby info header
   - Feeding summary
   - Sleep summary
   - Diaper summary (with color data)
   - Growth measurements
   - Tummy time progress
4. Add charts to PDF
5. Implement date range selection
6. Add share/print functionality

**Definition of Done:**
- [ ] All tests pass
- [ ] PDF generates correctly
- [ ] All data types included
- [ ] Charts render in PDF
- [ ] Share/print works
- [ ] Looks professional

---

#### Branch: `feature/growth-charts`
**Scope:** WHO/CDC percentile charts

**TDD Approach:**
```typescript
// Unit tests
describe('Percentile calculations', () => {
  it('should calculate weight percentile correctly', () => {});
  it('should calculate height percentile correctly', () => {});
  it('should calculate head percentile correctly', () => {});
  it('should use correct chart based on gender', () => {});
  it('should use correct chart based on age', () => {});
});

describe('Growth chart rendering', () => {
  it('should plot measurements on chart', () => {});
  it('should show percentile lines', () => {});
  it('should show trend over time', () => {});
});
```

**Tasks:**
1. Obtain WHO/CDC growth data
2. Implement percentile calculation
3. Build chart visualization
4. Add weight-for-age chart
5. Add height-for-age chart
6. Add head-for-age chart
7. Add Down Syndrome charts option
8. Show percentile history

**Definition of Done:**
- [ ] All tests pass
- [ ] WHO charts work
- [ ] CDC charts work (optional)
- [ ] Down Syndrome charts work
- [ ] Percentiles calculated correctly
- [ ] Charts display beautifully

---

#### Branch: `feature/notifications`
**Scope:** Feeding reminders and timer alerts

**TDD Approach:**
```typescript
// Unit tests
describe('Notification scheduling', () => {
  it('should calculate next feeding reminder', () => {});
  it('should not schedule during sleep', () => {});
  it('should respect quiet hours', () => {});
});

// Component tests
describe('NotificationSettings', () => {
  it('should toggle feeding reminders', () => {});
  it('should set reminder interval', () => {});
  it('should set quiet hours', () => {});
});
```

**Tasks:**
1. Configure Expo Notifications
2. Build notification settings screen
3. Implement feeding reminders:
   - Configurable interval (2, 2.5, 3, 4 hours)
   - Based on last feeding time
4. Implement timer alerts:
   - Configurable max duration
   - Alert when exceeded
5. Add quiet hours setting
6. Handle notification permissions

**Definition of Done:**
- [ ] All tests pass
- [ ] Feeding reminders work
- [ ] Timer alerts work
- [ ] Quiet hours respected
- [ ] Settings persist
- [ ] Permissions handled gracefully

---

#### Branch: `feature/onboarding`
**Scope:** First-time user experience

**TDD Approach:**
```typescript
// Component tests
describe('Onboarding', () => {
  it('should show onboarding on first launch', () => {});
  it('should not show onboarding on subsequent launches', () => {});
  it('should allow skipping', () => {});
  it('should complete with baby creation', () => {});
});
```

**E2E Test:**
```yaml
# e2e/onboarding-flow.yaml
appId: com.babytracker.app
---
- launchApp:
    clearState: true
- assertVisible: "Welcome"
- swipeLeft
- assertVisible: "Track Everything"
- swipeLeft
- assertVisible: "Sync with Family"
- swipeLeft
- assertVisible: "Add Your Baby"
- inputText:
    id: "baby-name-input"
    text: "Emma"
- tapOn: "Get Started"
- assertVisible: "Timeline"
```

**Tasks:**
1. Design onboarding screens (use frontend-design skill)
2. Build welcome screen
3. Build feature highlights (3-4 screens)
4. Integrate baby creation as final step
5. Mark onboarding complete
6. Add skip option

**Definition of Done:**
- [ ] All tests pass
- [ ] E2E test passes
- [ ] Beautiful onboarding UI
- [ ] Baby created at end
- [ ] Skip works
- [ ] Not shown again after complete

---

#### Branch: `feature/account-deletion`
**Scope:** Complete data deletion per privacy requirements

**TDD Approach:**
```typescript
// Unit tests
describe('Account deletion', () => {
  it('should delete all user data', () => {});
  it('should remove from household', () => {});
  it('should handle last member of household', () => {});
});

// Component tests
describe('DeleteAccount', () => {
  it('should require confirmation', () => {});
  it('should show what will be deleted', () => {});
  it('should sign out after deletion', () => {});
});
```

**Tasks:**
1. Build account deletion screen
2. Show data deletion summary
3. Require typed confirmation
4. Implement cascading delete:
   - User record
   - Entries logged by user
   - If last in household: entire household
5. Clear local data
6. Sign out and return to onboarding

**Definition of Done:**
- [ ] All tests pass
- [ ] Clear warning shown
- [ ] Confirmation required
- [ ] All data deleted
- [ ] Local data cleared
- [ ] Returns to fresh state

---

### Phase 4 Gate Checklist

**All items must be checked before proceeding to Phase 5:**

- [ ] All feature branches merged to main
- [ ] All tests pass
- [ ] CI pipeline green
- [ ] CSV export works for all data types
- [ ] PDF reports generate correctly
- [ ] Growth charts display with percentiles
- [ ] WHO data integrated
- [ ] Notifications work:
  - [ ] Feeding reminders
  - [ ] Timer alerts
  - [ ] Quiet hours
- [ ] Onboarding flow complete
- [ ] Account deletion works completely
- [ ] All data exportable
- [ ] Reports look professional
- [ ] Permissions handled gracefully

**Developer Manual Testing Sign-off:**
- [ ] Developer has manually tested all Phase 4 features and confirmed working

---

## Phase 5: Polish, Testing & Launch Preparation

### Objective
Final testing, performance optimization, App Store preparation, and launch.

### Feature Branches

#### Branch: `feature/ui-polish`
**Scope:** Final UI/UX refinements using frontend-design skill

**Tasks:**
1. Review all screens with frontend-design skill
2. Ensure consistent styling
3. Optimize touch targets (44pt minimum)
4. Verify one-hand operation
5. Test 3-tap maximum rule
6. Add micro-animations
7. Polish empty states
8. Review error states

**Definition of Done:**
- [ ] All screens reviewed
- [ ] Consistent styling
- [ ] Touch targets adequate
- [ ] One-hand operation confirmed
- [ ] 3-tap rule verified
- [ ] Animations smooth
- [ ] Empty states designed
- [ ] Error states clear

---

#### Branch: `feature/performance-optimization`
**Scope:** Optimize for speed and battery

**TDD Approach:**
```typescript
// Performance tests
describe('Performance', () => {
  it('should render Timeline with 1000 items smoothly', () => {});
  it('should launch in under 2 seconds', () => {});
  it('should log activity in under 3 taps', () => {});
});
```

**Tasks:**
1. Profile app startup time
2. Optimize bundle size
3. Implement list virtualization
4. Optimize database queries
5. Profile memory usage
6. Test with large datasets (5000+ entries)
7. Optimize background sync
8. Test battery impact

**Performance Targets:**
- Cold start: < 2 seconds
- Warm start: < 0.5 seconds
- List scroll: 60 FPS
- Sync delay: < 5 seconds

**Definition of Done:**
- [ ] Cold start < 2 seconds
- [ ] Smooth scrolling with 1000+ items
- [ ] No memory leaks
- [ ] Battery impact minimal
- [ ] Bundle size optimized

---

#### Branch: `feature/accessibility`
**Scope:** Full accessibility support

**Tasks:**
1. Add accessibility labels to all interactive elements
2. Test with VoiceOver (iOS)
3. Test with TalkBack (Android)
4. Ensure adequate color contrast
5. Support Dynamic Type (iOS)
6. Support font scaling (Android)
7. Test keyboard navigation

**Definition of Done:**
- [ ] All elements have accessibility labels
- [ ] VoiceOver works throughout app
- [ ] TalkBack works throughout app
- [ ] Color contrast passes WCAG AA
- [ ] Text scales appropriately

---

#### Branch: `feature/error-handling`
**Scope:** Comprehensive error handling and recovery

**Tasks:**
1. Add global error boundary
2. Implement crash reporting (Sentry)
3. Add error recovery for common issues
4. Build offline error handling
5. Add sync error recovery
6. Create helpful error messages

**Definition of Done:**
- [ ] Errors caught and logged
- [ ] Crash reports sent to Sentry
- [ ] Graceful degradation
- [ ] Helpful error messages
- [ ] Recovery options provided

---

#### Branch: `feature/app-store-assets`
**Scope:** Screenshots, descriptions, and assets for stores

**Tasks:**
1. Create app icon (1024x1024)
2. Generate all required icon sizes
3. Create screenshots:
   - iPhone 6.7"
   - iPhone 6.5"
   - iPhone 5.5"
   - iPad 12.9" (if supporting)
   - Android Phone
   - Android Tablet (if supporting)
4. Create feature graphic (Android)
5. Write App Store description
6. Write Play Store description
7. Prepare privacy policy
8. Create promotional images

**Safe App Store Description:**
```
Track your baby's daily routine with ease.

FEATURES:
• Log breastfeeding with timer and side tracking
• Track bottle feedings and solid foods
• Monitor sleep patterns and duration
• Record diaper changes with detailed logging
• Chart growth with WHO percentiles
• Track tummy time with daily goals
• Sync instantly with your partner
• Apple Watch app for quick logging
• Home screen widgets
• Export data for pediatrician visits

PRIVACY FIRST:
• No ads, ever
• No data selling
• Your data stays yours
• Delete everything anytime

Perfect for new parents, caregivers, and anyone tracking baby's daily activities.
```

**Definition of Done:**
- [ ] App icon finalized
- [ ] All screenshots created
- [ ] Descriptions written
- [ ] Feature graphic created
- [ ] Privacy policy published
- [ ] All assets meet store requirements

---

#### Branch: `feature/developer-accounts`
**Scope:** Set up Apple and Google developer accounts

**Note:** Developer account registration happens in Phase 5, NOT at project start. Reasons:
- App name should be finalized first (check availability on stores)
- Store listings require assets (screenshots, descriptions) created in this phase
- Apple's $99/year fee timing starts from enrollment
- Use a working bundle ID (e.g., `com.yourcompany.babytracker`) during development

**Tasks:**
1. Finalize app name (check availability on App Store and Play Store)
2. Create Apple Developer account ($99/year):
   - Go to developer.apple.com/programs
   - Enroll as Individual or Organization
   - Complete verification (may take 24-48 hours)
3. Create Google Play Console account ($25 one-time):
   - Go to play.google.com/console
   - Accept Developer Agreement
   - Complete account details
3. Configure App Store Connect:
   - Create App ID
   - Configure bundle identifier
   - Set up certificates and provisioning
4. Configure Play Console:
   - Create app
   - Complete store listing
   - Complete content rating
   - Complete data safety form

**Definition of Done:**
- [ ] Apple Developer account active
- [ ] Google Play account active
- [ ] App Store Connect app created
- [ ] Play Console app created
- [ ] Certificates configured

---

#### Branch: `feature/eas-configuration`
**Scope:** Configure EAS for production builds

**Tasks:**
1. Configure eas.json for production
2. Set up build profiles
3. Configure submission credentials
4. Set up OTA update channel
5. Test production build on devices

**eas.json:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "YOUR_ASC_APP_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

**Definition of Done:**
- [ ] Development builds work
- [ ] Preview builds work
- [ ] Production build works
- [ ] iOS build installs on device
- [ ] Android build installs on device
- [ ] OTA updates work

---

#### Branch: `feature/comprehensive-e2e-testing`
**Scope:** Full E2E test suite with Maestro

**Tasks:**
1. Write E2E tests for all critical flows:
   - Onboarding
   - Add baby
   - Log breastfeeding (timer)
   - Log bottle feeding
   - Log solid food
   - Log sleep (timer)
   - Log diaper
   - Log pumping
   - Log tummy time
   - View timeline
   - Edit entry
   - Delete entry
   - View statistics
   - Export data
   - Join household
   - Sync between devices
2. Run tests on real devices
3. Fix any discovered issues
4. Document test coverage

**Definition of Done:**
- [ ] All critical flows have E2E tests
- [ ] Tests pass on iOS device
- [ ] Tests pass on Android device
- [ ] Test suite runs in CI
- [ ] Coverage documented

---

### Phase 5 Gate Checklist

**All items must be checked before app submission:**

- [ ] All feature branches merged to main
- [ ] All unit tests pass (100%)
- [ ] All component tests pass (100%)
- [ ] All E2E tests pass (100%)
- [ ] Code coverage > 80%
- [ ] CI pipeline green
- [ ] Performance targets met:
  - [ ] Cold start < 2 seconds
  - [ ] List scroll 60 FPS
  - [ ] Sync < 5 seconds
- [ ] Accessibility verified:
  - [ ] VoiceOver works
  - [ ] TalkBack works
  - [ ] Color contrast passes
- [ ] Error handling complete
- [ ] Crash reporting configured
- [ ] App Store assets ready:
  - [ ] App icon
  - [ ] Screenshots (all sizes)
  - [ ] Description
  - [ ] Feature graphic
- [ ] Privacy policy published
- [ ] Developer accounts set up:
  - [ ] Apple Developer ($99)
  - [ ] Google Play ($25)
- [ ] EAS production builds work
- [ ] Tested on real devices:
  - [ ] Multiple iPhones
  - [ ] Multiple Android devices
  - [ ] Apple Watch
- [ ] No known critical bugs
- [ ] App reviewed by beta testers

**Developer Manual Testing Sign-off:**
- [ ] Developer has manually tested complete app end-to-end and confirmed ready for submission

---

## App Store Submission Checklist

### iOS Submission
- [ ] Build production IPA via EAS
- [ ] Upload to App Store Connect
- [ ] Fill out App Store listing:
  - [ ] App name
  - [ ] Subtitle
  - [ ] Description
  - [ ] Keywords
  - [ ] Screenshots
  - [ ] App icon
- [ ] Complete App Privacy:
  - [ ] Privacy policy URL
  - [ ] Data collection types
  - [ ] Data usage purposes
- [ ] Set content rating (likely 4+)
- [ ] Select category: **Lifestyle** (not Health & Fitness)
- [ ] Add review notes:
  - "This is a baby activity tracking app for parents. No medical claims are made."
- [ ] Submit for review

### Android Submission
- [ ] Build production AAB via EAS
- [ ] Upload to Play Console
- [ ] Complete store listing:
  - [ ] App name
  - [ ] Short description
  - [ ] Full description
  - [ ] Screenshots
  - [ ] Feature graphic
  - [ ] App icon
- [ ] Complete Data Safety form
- [ ] Complete content rating (IARC)
- [ ] Set target audience (NOT children - this is for parents)
- [ ] Submit for review

---

## Post-Launch Tasks

- [ ] Monitor crash reports (Sentry)
- [ ] Respond to user reviews
- [ ] Monitor sync performance
- [ ] Plan first update based on feedback
- [ ] Consider premium features for future

---

## Edge Cases Reference

### Timer Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| App backgrounded | Timer continues via native module |
| App killed | Timer restored from stored start time |
| Device restart | Timer restored from persistent storage |
| Timezone change | Timer unaffected (uses UTC) |
| Timer running > 24 hours | Show warning, allow continuation |

### Sync Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| Offline for days | Queue syncs when online |
| Large offline queue (100+ changes) | Batch sync, show progress |
| Simultaneous edits | Last write wins, merge where possible |
| Delete vs edit conflict | Preserve edit with flag |
| Network failure mid-sync | Retry with exponential backoff |

### Data Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| Feeding spans midnight | Associate with start date |
| Sleep spans multiple days | Show correctly in timeline |
| Very old data (years) | Performant access |
| Large dataset (10,000+ entries) | Virtualized list |
| Corrupt local database | Recovery from cloud |

### Account Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| Anonymous → email upgrade | Preserve all data |
| Multiple devices same account | Sync all data |
| Session expired | Prompt re-auth, no data loss |
| Last household member deletes account | Delete entire household |
| Join household with existing data | Offer merge or replace |

---

## Testing Strategy Summary

**Note:** Using Vitest + Maestro only (skipping Jest/RNTL due to React 19 peer dependency conflicts).

| Test Type | Tool | Coverage Target | Run Frequency |
|-----------|------|-----------------|---------------|
| Unit Tests | Vitest | > 80% | Every commit |
| E2E Tests | Maestro | All critical flows + UI | Every PR |
| Manual Testing | Real devices | All features | Pre-release |
| Performance Testing | Profiler | Targets met | Weekly |
| Accessibility Testing | VoiceOver/TalkBack | All screens | Pre-release |

---

## Branch Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Setup | `setup/[name]` | `setup/project-initialization` |
| Feature | `feature/[name]` | `feature/feeding-breastfeeding` |
| Bug Fix | `fix/[issue]` | `fix/timer-persistence` |
| Hotfix | `hotfix/[issue]` | `hotfix/sync-crash` |
| Release | `release/[version]` | `release/1.0.0` |

---

## Merge Requirements

Every PR to main requires:
1. All CI checks pass (lint, typecheck, tests)
2. Code review approved
3. All tests pass locally
4. No merge conflicts
5. Branch is up-to-date with main
6. **Developer manual testing completed and verified** (see below)

### Commit Message Guidelines
- **Never** add "Co-Authored-By" lines to commits
- **Never** reference AI tools or assistants in commits or PRs
- Write clear, concise commit messages describing the changes

---

## Manual Developer Testing & Progress Tracking

### Marking Progress in This Plan

**IMPORTANT:** As features are implemented and verified:
1. Mark checkboxes as checked `[x]` in this plan file when:
   - Automated tests pass
   - Developer has manually tested the feature
   - Feature works correctly
2. Only proceed to the next phase when ALL checkboxes in the current phase gate checklist are marked `[x]`
3. This plan file serves as the source of truth for project progress

### Developer Testing Requirement

Before merging any feature branch:
1. Run the app and manually test the feature works as expected
2. Confirm: "Tested and working"

That's it. Developer confirms they tested, feature gets merged, checkbox gets marked.

---

*Plan created: January 2026*
*Approach: TDD + Feature Branch Workflow*
*Stack: React Native + Expo + Supabase + PowerSync*
