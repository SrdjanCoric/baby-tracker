# Interactive Features Design Document

**Status: APPROVED — Final design agreed upon.**

**Final mockup: `docs/dashboard-refined-v5.html`** (dark + light, collapsed + expanded tip states)

## Goal

Make the baby tracker app more interactive and engaging — moving from a passive data logger to an active companion that gives parents actionable insights, celebrates milestones, and predicts sleep patterns. Primary competitors are Huckleberry (paid, sleep-focused) and Nara Baby (free, tracking-focused). We aim to match Huckleberry's smartest features while remaining free.

---

## Feature 1: Milestone Celebrations (Auto-Detected Achievements)

### What It Is

When a baby hits a milestone that can be detected from logged activity data, the app shows a celebration UI — either a toast (minor) or a full-screen story-style modal (major). The detection happens client-side at the moment of logging, not via push notifications.

### Detection Trigger

Runs in the context reducer after an entry is saved (e.g., `ADD_SLEEP` in sleep-context). When a milestone condition is met, sets a `pendingCelebration` state. A global `MilestoneCelebrationModal` component mounted in `_layout.tsx` picks it up — same pattern as the existing `BirthdayCelebrationModal`.

Should also trigger on `REMOTE_INSERT` (when a household member logs an entry that syncs).

### Milestone Categories (v1)

#### Major (Story-style full-screen modal with educational note)

**Sleep stretch firsts:**
- First 4-hour night sleep
- First 5-hour night sleep
- First 6-hour night sleep
- First 8-hour night sleep
- First 10-hour night sleep
- First 12-hour night sleep

Detection: Single sleep entry with duration >= threshold, nighttime only (start time between ~6pm-midnight).

#### Minor (Slide-in toast, auto-dismisses)

**Tummy time session firsts:**
- First 5-minute session
- First 10-minute session
- First 15-minute session
- First 30-minute session

Detection: Single tummy time entry with duration >= threshold.

**First solid food:**
- First entry with feeding type = "solid"

Detection: First-ever solid food entry for the baby.

### Educational Notes

Each milestone includes a 1-2 sentence educational note. Notes are **age-bracketed** — the text changes based on the baby's actual age at the time of the milestone. For example, a 6-hour sleep milestone:

- Under 3 months: "This is exceptional for a baby this young! Their developing nervous system is already learning to consolidate sleep cycles."
- 3-4 months: "Your baby's stomach is growing large enough to sustain longer stretches without feeding."
- 5-6 months: "Most babies reach this milestone around this age. Your baby's sleep cycles are maturing beautifully."
- 7+ months: "Your baby has consolidated their nighttime sleep — a sign their circadian rhythm is well established."

### Celebration UI

**Major milestones: Story-style full-screen modal**
- Full-screen overlay with ambient glow orbs and sparkle particles
- Large floating emoji (e.g., 🌙 for sleep)
- "Achievement Unlocked" label (purely decorative, no collection/badge system behind it)
- Milestone title (e.g., "First 6-Hour Sleep!")
- Age-bracketed educational note
- "Tap anywhere to continue" dismiss
- Supports both light and dark mode via `useTheme()` + `isDark` ternary (same pattern as `BirthdayCelebrationModal`)

**Minor milestones: Slide-in toast**
- Slides in from top
- Icon + title + "Next goal: X" subtitle
- Auto-dismiss progress bar (4 seconds)
- Green-tinted background

### Storage

- Store detected achievements per baby: `@achievements:{babyId}` as JSON array of `{ id: string, detectedAt: string }`
- Once detected and stored, never re-trigger
- Each detector is a pure function: `(entries, babyProfile) => Achievement | null`

### Design Mockups

- `docs/milestone-celebration-designs.html` — 5 UI design options explored (full celebration, elegant card, tiered, story-style, gamified)
- Decision: Story-style for major, toast for minor

---

## Feature 2: Sleep Prediction

### What It Is

Predict the next nap or bedtime based on the baby's actual recent sleep data, displayed subtly on the home dashboard. Similar to Huckleberry's SweetSpot feature.

### Algorithm

Not fancy ML — straightforward averaging:

1. Look at the last 5-7 days of sleep data
2. Calculate average wake windows between sleep sessions, weighted by nap position (wake window before nap 1 is typically shorter than before nap 3)
3. From the baby's last wake-up time + averaged wake window for current nap position = predicted next nap time
4. Fall back to age-based defaults from `WAKE_WINDOW_PROGRESSIONS` in `sleepGoals.ts` when less than 5 days of data

The existing infrastructure already supports this:
- `WAKE_WINDOW_PROGRESSIONS` defines progressive windows per nap position
- `getCurrentNapSlot()` knows which nap the baby is on
- `sleeps` array has all historical data
- Wake window reminder system already calculates remaining time

### Nap Count Toggle

A segmented control showing age-appropriate nap count options:

| Age | Toggle Options |
|-----|---------------|
| 0-3 months | 4 / 5 naps |
| 3-5 months | 3 / 4 naps |
| 6-8 months | 2 / 3 naps |
| 9-12 months | 2 (no toggle — single option) |
| 13-18 months | 1 / 2 naps |
| 19+ months | 0 / 1 nap |

Data comes from `napsMin` and `napsMax` in `SLEEP_AGE_GROUPS`. Toggle hidden when min === max.

**Two levels of control:**
- **Dashboard toggle**: Quick daily override. Resets to default each new day.
- **Settings toggle**: Persistent default nap count (in existing wake window settings screen).

### Contextual Display

The prediction area adapts based on state — only shows when relevant:

| State | What Shows |
|-------|-----------|
| Baby is awake, nap > 2h away | "Awake 1h 28m" / "Nap time near **11:15 AM**" |
| Baby is awake, nap < 2h away | Same, but countdown becomes more prominent |
| Nap time now (wake window exceeded) | "**Nap time now**" / "Awake 2h 15m · Wake window reached" |
| Baby is sleeping | Prediction hidden. Shows "Emma is sleeping · 42m" with pulsing dot |
| All naps done | "All 3 naps done · Bedtime near **7:00 PM**" (no nap toggle) |
| After bedtime | Prediction area hidden entirely |
| < 5 days of data | Shows prediction from age defaults + "Log 3 more days for personalized predictions" |

### Prediction UI

**Decision: Subtle prediction card** — a barely-there tinted card between the header and activity cards.

```
┌─────────────────────────────────────┐
│ SLEEP PREDICTION        Awake 1h 28m│
│ Nap time near 11:15 AM              │
│ Based on Emma's recent sleep patterns│
│ [3-nap day] [4-nap day]             │
└─────────────────────────────────────┘
```

- Purple-tinted background (`rgba(166,141,200,0.06)`) with subtle border
- "SLEEP PREDICTION" label top-left, "Awake Xh Xm" top-right
- Predicted time in accent color (bold)
- "near" language communicates uncertainty naturally (no confidence scores)
- Segmented control for nap count toggle at bottom
- Tappable to open sleep settings for more configuration

Separated from activity cards below by a **gradient separator** — a subtle purple-tinted line that fades from transparent at edges to `rgba(166,141,200,0.2)` at center.

### Design Mockups

- `docs/dashboard-final-designs.html` — 2 prediction card styles + 5 contextual states
- `docs/dashboard-redesign-minimal.html` — 5 minimal prediction placement options explored
- Decision: Subtle prediction card with gradient separator

---

## Feature 3: Dashboard Redesign

### Problem

The current dashboard treats all 8 activity cards equally (2-column grid, same size). But usage frequency varies dramatically — Feeding/Sleep/Diaper are used 10+ times daily, while Growth/Milestones/Health might be used weekly or monthly. Adding a prediction card and moving tips creates an opportunity to rethink the layout.

### Decision: Hybrid Layout

**Primary activities (2-column grid, full cards):** Feeding, Sleep, Diaper, Pumping, Tummy Time

**Secondary activities (compact horizontal rows):** Growth, Milestones, Health

**Layout order:**
1. Baby header
2. Sleep prediction card (contextual — hidden when not relevant)
3. Gradient separator
4. 5 primary cards in 2-column grid (last card centered if odd count)
5. "Health & Growth" section label
6. 3 compact horizontal rows
7. Compact single-line daily tip (at bottom)

### Card Specifications

**Primary cards** (unchanged from current):
- 2-column grid, `min-height: 120px` (reduced from 200px)
- `border-radius: 20px`, 14px padding
- Color-coded left border (3px)
- Icon + label header, value, subtitle, optional progress bar
- Circular "+" button bottom-right

**Compact rows** (new):
- Full-width horizontal layout
- `border-radius: 14px`, 10px vertical / 12px horizontal padding
- Icon | Label + Value + Subtitle (all inline) | "+" button
- Same color-coded left border
- ~40-45px total height (vs ~120px for grid cards)
- Smaller icon (0.85rem) and button (26px diameter)

**Section label:**
- "HEALTH & GROWTH" in uppercase, 0.55rem, 700 weight, 2px letter spacing
- Uses tertiary text color (38% opacity)
- 20px top margin for intentional spacing from grid

### Daily Tips

Moved from top to bottom of dashboard. Changed from full swipeable carousel to compact single-line format:
- Single row: icon | tip text | dismiss "×" button
- Same warm-tinted background as current tip card but smaller
- Still dismissable per day, still swipeable if multiple tips

Rationale: The prediction card is more actionable and time-sensitive than a tip. Tips are nice-to-have educational content; the prediction is "what to do next." Actionable content gets the prime slot.

### Separator

Gradient line between prediction and cards:
```css
background: linear-gradient(90deg, transparent, rgba(166,141,200,0.2), transparent);
height: 1px;
margin: 16px 0;
```

### Design Mockups

- `docs/dashboard-redesign-mockups.html` — 5 initial heavy redesign options (rejected as too complex)
- `docs/dashboard-layout-options.html` — 5 layout options with compact cards explored
- `docs/dashboard-horizontal-cards.html` — 3 all-horizontal card designs explored
- `docs/dashboard-hybrid-refined.html` — **Final hybrid design** in dark mode, light mode, and centered-odd-card variant

---

## Technical Architecture Notes

### Existing Infrastructure to Leverage

- `BirthdayCelebrationModal` — pattern for global celebration modals mounted in `_layout.tsx`
- `useBirthdayCelebration` hook — pattern for milestone detection + seen-state tracking
- `SLEEP_AGE_GROUPS` and `WAKE_WINDOW_PROGRESSIONS` in `sleepGoals.ts` — age-based nap counts and wake windows
- `getCurrentNapSlot()` — current nap position detection
- `wakeWindowConfig` — existing wake window reminder infrastructure
- `DashboardConfig` — existing card visibility/ordering customization
- `useTheme()` with `isDark` — light/dark mode pattern (inline styles, not NativeWind `dark:` variants)
- `TipCarousel` and `tip-storage.ts` — existing tip system

### Key Patterns to Follow

- Use `useTheme()` + `isDark` ternary for all color decisions (avoid NativeWind `dark:` to prevent crashes under rapid re-renders)
- Store per-baby data with `@prefix:{babyId}` key pattern in AsyncStorage
- Pure detection functions: `(data, profile) => result | null`
- Mount global modals in `_layout.tsx` wrapper components
- i18n: all user-facing strings through `t()`, age-bracketed educational notes as translation keys

### What Needs to Be Built

1. **Achievement detection service** — pure functions that check milestone conditions
2. **Achievement storage** — AsyncStorage with per-baby keys
3. **MilestoneCelebrationModal** — story-style modal component (major milestones)
4. **MilestoneToast** — slide-in toast component (minor milestones)
5. **Sleep prediction calculator** — average wake windows from recent data
6. **SleepPredictionCard** — dashboard component with contextual display
7. **Nap count toggle** — segmented control with age-appropriate options
8. **CompactActivityRow** — new component for secondary activities
9. **Dashboard layout refactor** — reorder components, add section label, move tips
10. **Compact tip component** — single-line tip bar

### Implementation Priority

1. Milestone celebrations (achievement detection + modals) — standalone, no dashboard changes needed
2. Sleep prediction (calculator + card) — adds to dashboard but doesn't change existing cards
3. Dashboard redesign (hybrid layout + compact rows + tip relocation) — biggest change, touches existing components

---

## Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| Reactive celebrations vs proactive guidance first? | Reactive celebrations first | Simpler, existing modal pattern, genuine whitespace vs competitors |
| Push notification or in-app? | In-app only (at moment of logging) | Huckleberry does it this way, simpler, no edge function needed |
| Detection at screen level or context level? | Context/global level | Catches household member syncs, keeps screens clean, matches birthday modal pattern |
| Which milestones in v1? | Sleep stretches (major), tummy time firsts + first solid (minor) | Baby-centric, universally relevant, simple single-entry detection |
| Growth milestones? | Excluded from v1 | Requires birth weight storage, added complexity |
| Celebration UI style? | Story-style for major, toast for minor | Tiered approach prevents celebration fatigue |
| Educational notes? | Age-bracketed variants | Personalized touch, makes parents feel app knows their baby |
| Sleep prediction approach? | Average wake windows from last 5-7 days, fall back to age defaults | 80% of Huckleberry's value with 10% complexity |
| Prediction UI? | Subtle tinted card between header and activity cards | Minimalist, contextual (hides when not relevant), doesn't compete with tips |
| Nap count toggle location? | Both dashboard (daily override) and settings (persistent default) | Quick daily adjustments + stable default |
| Dashboard card layout? | Hybrid: 4 grid cards (primary) + 4 compact rows (secondary) | Visual hierarchy matches usage frequency. Option E layout. |
| Primary grid cards? | Feeding, Sleep, Diaper, Tummy Time | These are the "big 4" used multiple times daily |
| Compact row cards? | Pumping, Growth, Milestones, Health | Used less frequently, don't need full card treatment |
| Daily tip placement? | Toggle in header (💡 icon), expands panel on tap | Keeps dashboard clean by default, tips one tap away |
| Separator style? | Increased section spacing (24px between sections vs 12px within) | Spacing alone groups things; no visible separator line needed |
| Prediction card visual treatment? | Hero treatment: gradient bg, accent top border, corner glow | Clearly distinguishes prediction from logging cards |
| Card category tints? | Faint accent-color gradient wash on each card | Unifies visual language, every card "belongs" to its category |
| Tummy Time accent color? | Shifted toward warm gold (#DABB78 dark / #C9A55C light) | Differentiates from Diaper's pink (#EAB8B2 / #E0A099) |
| Light/dark mode? | Required for all new components | App supports both, use isDark ternary pattern |

---

## Visual Design Details (v5 — Final)

### Color System (from `colors.ts`)

| Activity | Light Accent | Dark Accent | Tint Direction |
|----------|-------------|-------------|----------------|
| Feeding | `#8CB369` (green) | `#A5C88A` | Top-left gradient |
| Sleep | `#8B7BA0` (purple) | `#A68DC8` | Top-left gradient |
| Diaper | `#E0A099` (pink) | `#EAB8B2` | Top-left gradient |
| Tummy Time | `#C9A55C` (gold) | `#DABB78` | Top-left gradient |
| Pumping | `#7BA3A8` (teal) | `#96B8BC` | Left-to-right gradient |
| Growth | `#6AAB9C` (green-teal) | `#88BEB0` | Left-to-right gradient |
| Milestones | `#C9A55C` (gold) | `#DABB78` | Left-to-right gradient |
| Health | `#D4836B` (coral) | `#E09B85` | Left-to-right gradient |

### Surface Colors

| Element | Light | Dark |
|---------|-------|------|
| Background | `#F5EDE8` | `#121110` |
| Card | `#FFFFFF` | `#2A2725` |

### Prediction Card Hero Treatment

- **Dark**: `linear-gradient(165deg, rgba(166,141,200,0.14), rgba(166,141,200,0.05))`, border `rgba(166,141,200,0.18)`, top border `2px solid rgba(166,141,200,0.35)`, corner glow orbs
- **Light**: `linear-gradient(165deg, rgba(139,123,160,0.08), rgba(139,123,160,0.02))`, border `rgba(139,123,160,0.12)`, top border `2px solid rgba(139,123,160,0.25)`

### Card Category Tints

Grid cards: `linear-gradient(165deg, rgba(accent,0.06) 0%, cardBg 60%)`
Compact rows: `linear-gradient(90deg, rgba(accent,0.05) 0%, cardBg 50%)`

### Section Spacing

- Between sections (prediction → grid, grid → compact rows): `24px`
- Within grid: `12px` gap
- Within compact rows: `6px` gap
- Result: eye automatically groups related items without needing separator lines or labels

### Tip Toggle (💡)

- **Available**: Warm-tinted circle in header row, notification dot shows new tip available
- **Expanded**: Panel slides down between header and prediction card with same carousel content
- **Dismissed**: Bulb dims to 50% opacity, dot disappears, no tip content on screen

### Design Mockups (Final)

- `docs/dashboard-refined-v5.html` — **Final design**: 4 states (dark collapsed, light collapsed, dark expanded tips, light expanded tips) using real app colors
- `docs/milestone-celebration-designs.html` — Celebration modal designs

### Earlier Explorations (for reference)

- `docs/dashboard-redesign-mockups.html` — Initial heavy redesign options (rejected)
- `docs/dashboard-redesign-minimal.html` — Minimal prediction placement options
- `docs/dashboard-final-designs.html` — Prediction card + contextual states
- `docs/dashboard-layout-options.html` — Layout options with compact cards
- `docs/dashboard-horizontal-cards.html` — All-horizontal card designs
- `docs/dashboard-hybrid-refined.html` — First hybrid attempt
- `docs/dashboard-tip-toggle.html` — Tip toggle concept
- `docs/dashboard-refined-v3.html` / `v4.html` — Incremental refinements

---

## Open Questions

1. How should the nap count toggle interact with the existing wake window settings? Should changing nap count on dashboard also update the wake window config, or are they independent?
2. Should achievements be synced to Supabase for household members to see, or are they local-only per device?
3. Should there be a way to view past achievements (an achievements history screen), or is the celebration moment the only surface?
4. What happens when a user has dashboard card customization that conflicts with the new hybrid layout (e.g., they've hidden Pumping but it's in the compact rows)?
5. Should the tummy time color change (`#D4A574` → `#C9A55C` / `#E0B990` → `#DABB78`) be applied globally across the app, or only on the dashboard?
