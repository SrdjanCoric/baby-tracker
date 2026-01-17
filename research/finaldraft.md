# Baby Tracker App - Final Specification

## Overview

A privacy-first, ad-free baby tracking app for iOS and Android with Apple Watch support, home screen widgets, and real-time multi-caregiver sync.

---

## Part 1: Free Features to Implement

### Core Tracking

| Feature | Description | Priority |
|---------|-------------|----------|
| **Feeding - Breastfeeding** | Timer with left/right side memory, tracks duration | Must Have |
| **Feeding - Bottle** | Volume (oz/ml), formula or breast milk, timestamp | Must Have |
| **Feeding - Solids** | Food type, amount, notes | Must Have |
| **Sleep Tracking** | Start/stop timer, nap vs nighttime, duration | Must Have |
| **Diaper Changes** | Wet, dirty, mixed with timestamp | Must Have |
| **Pumping Sessions** | Timer with left/right, volume output | Must Have |
| **Growth Tracking** | Height, weight, head circumference | Must Have |
| **Growth Charts** | WHO/CDC percentiles, Down Syndrome charts | Must Have |
| **Multiple Children** | Support tracking more than one baby | Must Have |

### Timer Functionality

| Feature | Description | Priority |
|---------|-------------|----------|
| **Background Timer** | Timer continues when app is backgrounded | Must Have |
| **Timer Persistence** | Timer survives app closure (store start time) | Must Have |
| **Lock Screen Timer** | Show timer on lock screen (Live Activities) | Should Have |
| **Quick Resume** | Resume timer from notification or widget | Should Have |

### Data & History

| Feature | Description | Priority |
|---------|-------------|----------|
| **Timeline View** | Chronological list of all entries | Must Have |
| **Unlimited History** | No paywall on historical data | Must Have |
| **Basic Statistics** | Daily/weekly summaries | Must Have |
| **Charts** | Visual patterns for sleep, feeding | Must Have |
| **Notes** | Add notes to any entry | Must Have |
| **Edit Entries** | Correct mistakes after logging | Must Have |
| **Delete Entries** | Remove erroneous entries | Must Have |

### Multi-Caregiver Sync

| Feature | Description | Priority |
|---------|-------------|----------|
| **Real-time Sync** | < 5 second sync between caregivers | Must Have |
| **Invite via Code** | Simple code sharing (no account required to join) | Must Have |
| **Unlimited Caregivers** | Grandparents, nanny, etc. | Must Have |
| **Offline-First** | App works without internet | Must Have |
| **Conflict Resolution** | Handle simultaneous edits gracefully | Must Have |
| **Caregiver Management** | Add/remove caregivers | Must Have |

### Platform Support

| Feature | Description | Priority |
|---------|-------------|----------|
| **iOS App** | iPhone support (iOS 15+) | Must Have |
| **Android App** | Android support (Android 10+) | Must Have |
| **Apple Watch** | Full logging, timers, complications | Must Have |
| **iOS Widgets** | Home screen quick view | Must Have |
| **Android Widgets** | Home screen quick view | Must Have |
| **Live Activities** | Lock screen timer (iOS) | Should Have |
| **Siri Shortcuts** | Voice logging | Should Have |

### Data Export

| Feature | Description | Priority |
|---------|-------------|----------|
| **CSV Export** | All data in spreadsheet format | Must Have |
| **PDF Reports** | Formatted for pediatrician visits | Must Have |
| **Data Ownership** | Users own their data completely | Must Have |

### UI/UX

| Feature | Description | Priority |
|---------|-------------|----------|
| **Dark Mode** | System-aware dark theme | Must Have |
| **Night Mode** | Extra dim/red for late night | Should Have |
| **One-Hand Operation** | Large touch targets, bottom navigation | Must Have |
| **3-Tap Maximum** | Log any activity in 3 taps or less | Must Have |
| **Quick Actions** | Shortcuts for common activities | Must Have |

### Privacy & Account

| Feature | Description | Priority |
|---------|-------------|----------|
| **No Account Required** | Start using immediately | Must Have |
| **Optional Account** | Email for backup/recovery | Must Have |
| **Account Deletion** | Delete all data completely | Must Have |
| **No Ads** | Zero advertising | Must Have |
| **No Data Selling** | Never sell or share data | Must Have |
| **Local-First Storage** | Data stored on device primarily | Must Have |

### Notifications

| Feature | Description | Priority |
|---------|-------------|----------|
| **Feeding Reminders** | Customizable feeding alerts | Should Have |
| **Timer Notifications** | Alert when timer running too long | Should Have |
| **Caregiver Activity** | Notify when others log entries | Optional |

---

## Part 2: User Requirements

Based on competitive analysis, users want:

### Speed & Reliability

| Requirement | Target |
|-------------|--------|
| App launch time | < 2 seconds cold start |
| Logging an activity | < 3 taps |
| Sync delay | < 5 seconds between devices |
| Crash-free sessions | > 99.9% |
| Offline functionality | Full feature access offline |

### Data Accuracy

| Requirement | Description |
|-------------|-------------|
| Timer accuracy | Must not lose time when backgrounded |
| Sync accuracy | No data loss during sync |
| Edit capability | Fix mistakes easily |
| Data integrity | Never corrupt or lose data |

### Multi-Caregiver (Critical)

| Requirement | Description |
|-------------|-------------|
| Easy sharing | Share access without technical knowledge |
| Real-time updates | See partner's logs immediately |
| No conflicts | Handle simultaneous entries gracefully |
| Works for all | Grandparents can use it too |

### Privacy

| Requirement | Description |
|-------------|-------------|
| Minimal data collection | Only what's necessary |
| Transparent policy | Short, readable privacy policy |
| No tracking | No advertising identifiers |
| Data portability | Export everything, anytime |
| Right to delete | Complete data deletion |

### Usability

| Requirement | Description |
|-------------|-------------|
| One-hand use | Operable while holding baby |
| Dark/night mode | Essential for night feedings |
| Quick logging | Fastest possible entry |
| Clear interface | No clutter, obvious actions |
| Forgiving | Easy to correct mistakes |

---

## Part 3: Things to Avoid

### Monetization Mistakes

| Avoid | Why |
|-------|-----|
| Ads of any kind | Users hate ads during baby care |
| Aggressive upselling | Destroys trust |
| Paywalling basic features | Creates resentment |
| Hidden subscription costs | Leads to negative reviews |
| Difficult cancellation | App Store violation, bad UX |

### Technical Failures

| Avoid | Why |
|-------|-----|
| Sync that doesn't work | #1 complaint in competitor reviews |
| Data loss | Unforgivable - instant uninstall |
| Timer bugs | Core feature must be bulletproof |
| Slow app launch | Sleep-deprived parents have no patience |
| Crashes | Data trust is everything |
| Battery drain | Parents need phone battery |

### Privacy Violations

| Avoid | Why |
|-------|-----|
| Selling data | Your key differentiator is NOT doing this |
| Excessive permissions | Only request what you need |
| Unclear data practices | Transparency builds trust |
| Third-party tracking SDKs | Defeats privacy-first positioning |
| Sharing with employers | Documented issue with competitors |

### Design Problems

| Avoid | Why |
|-------|-----|
| Feature bloat | Keep it simple and focused |
| Content/articles | Users want tracking, not blogs |
| Community features | Forums add moderation burden, toxicity risk |
| Confusing UI | Sleep-deprived users need obvious paths |
| Tiny touch targets | One-handed operation is critical |
| No edit capability | Everyone makes mistakes |
| Complex onboarding | Let users start immediately |

### App Store Risks

| Avoid | Why |
|-------|-----|
| Medical claims | Triggers regulatory review |
| Health & Fitness category | Extra scrutiny (use Lifestyle) |
| HealthKit (unless needed) | Complicates approval |
| Incomplete features | Rejection risk |
| Missing privacy policy | Required for submission |
| COPPA violations | Children's data is sensitive |

---

## Part 4: Technology Stack

### Frontend

```
Framework:      React Native (bare, with Expo prebuild for native access)
Language:       TypeScript
Styling:        NativeWind (Tailwind CSS for React Native)
Navigation:     Expo Router or React Navigation
```

### State Management

```
Global State:   React Context (theme, user, selectedBaby)
Server State:   TanStack Query (caching, loading states)
Local State:    useState (forms, UI toggles)
```

### Data Layer

```
Local Database: PowerSync (SQLite on device)
Cloud Database: Supabase (PostgreSQL)
Sync Engine:    PowerSync ↔ Supabase (automatic)
Authentication: Supabase Auth (email, magic link, anonymous)
```

### Native Extensions

```
iOS Watch App:      Swift / SwiftUI
iOS Widgets:        Swift / SwiftUI (WidgetKit)
iOS Live Activities: Swift (ActivityKit)
Android Widgets:    Kotlin (Glance or traditional)
Background Timers:  Native modules (Swift/Kotlin)
Siri Shortcuts:     Swift (Intents framework)
```

### Build & Deploy

```
Build Service:  Expo EAS Build
OTA Updates:    Expo EAS Update (JS-only changes)
Submission:     Expo EAS Submit
CI/CD:          GitHub Actions (optional)
```

### Testing

```
Unit Tests (Logic):     Vitest
  - Pure functions, utilities, calculations
  - Data validation, transformations
  - Business logic without React Native imports

Component Tests:        Jest + React Native Testing Library (if needed)
  - React Native component rendering
  - Hook testing
  - Navigation flows

E2E Tests:              Maestro
  - Full user flows on simulator/device
  - Critical path testing
  - Regression testing
```

### Testing File Structure

```
src/
├── utils/
│   ├── calculations.ts
│   └── calculations.test.ts      ← Vitest
├── validators/
│   ├── feeding.ts
│   └── feeding.test.ts           ← Vitest
├── components/
│   └── FeedingTimer/
│       ├── index.tsx
│       └── __tests__/
│           └── FeedingTimer.test.tsx  ← Jest + RNTL (if needed)
│
e2e/
├── feeding-flow.yaml             ← Maestro
├── sleep-flow.yaml
├── sync-flow.yaml
└── onboarding-flow.yaml
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/__tests__/**', 'e2e/**'],
    environment: 'node',
  },
});
```

### What to Test with Vitest

| Module | Test Examples |
|--------|---------------|
| `utils/duration.ts` | `formatDuration(3661)` → `"1h 1m 1s"` |
| `utils/percentile.ts` | `calculatePercentile(weight, age)` → `75` |
| `validators/feeding.ts` | `validateFeeding(data)` → `{ valid: true }` |
| `utils/conflict.ts` | `resolveConflict(a, b)` → merged record |
| `utils/export.ts` | `generateCSV(feedings)` → CSV string |
| `utils/statistics.ts` | `getDailyStats(data)` → stats object |

### What to Test with Maestro (E2E)

```yaml
# e2e/feeding-flow.yaml
appId: com.babytracker.app
---
- launchApp
- tapOn: "Log Feeding"
- tapOn: "Breastfeed"
- tapOn: "Left Side"
- assertVisible: "Timer Running"
- scroll:
    direction: DOWN
- tapOn: "Stop"
- assertVisible: "Feeding Saved"
- tapOn: "History"
- assertVisible: "Left Breast"
```

### Notifications

```
Push Notifications: Expo Notifications
Local Notifications: Expo Notifications
```

### Monitoring (Optional, for later)

```
Crash Reporting: Sentry (free tier)
Analytics:       None initially (privacy-first)
```

---

## Part 5: Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Devices                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   iPhone     │  │   Android    │  │    Apple Watch       │  │
│  │              │  │              │  │                      │  │
│  │ React Native │  │ React Native │  │  Swift/SwiftUI       │  │
│  │ + PowerSync  │  │ + PowerSync  │  │  (standalone)        │  │
│  │   (SQLite)   │  │   (SQLite)   │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         │                 │            ┌─────────┴─────────┐   │
│         │                 │            │    App Groups     │   │
│         │                 │            │  (Shared Data)    │   │
│         │                 │            └───────────────────┘   │
│         │                 │                                     │
│  ┌──────┴─────────────────┴──────┐                             │
│  │         PowerSync             │                             │
│  │    (Sync Engine + Offline)    │                             │
│  └──────────────┬────────────────┘                             │
│                 │                                               │
└─────────────────┼───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │  Auth        │  │  Real-time           │  │
│  │  Database    │  │  Service     │  │  Subscriptions       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  Row-Level   │  │  Storage     │                            │
│  │  Security    │  │  (if needed) │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Database Schema (Core Tables)

```sql
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedings
CREATE TABLE feedings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL, -- 'breast', 'bottle', 'solid'
  side VARCHAR(10), -- 'left', 'right', 'both' (for breast)
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  amount_ml DECIMAL(6,2),
  food_type VARCHAR(100), -- for solids
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sleep
CREATE TABLE sleep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL, -- 'nap', 'night'
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
  type VARCHAR(20) NOT NULL, -- 'wet', 'dirty', 'mixed'
  changed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pumping
CREATE TABLE pumping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) NOT NULL,
  logged_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  amount_ml DECIMAL(6,2),
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
```

---

## Part 7: App Store / Play Store Registration Guide

### Prerequisites

| Requirement | Apple App Store | Google Play Store |
|-------------|-----------------|-------------------|
| Developer Account | $99/year | $25 one-time |
| Account Type | Individual or Organization | Individual or Organization |
| Verification | Credit card, may need ID | Credit card |
| Setup Time | 1-2 days | 1-2 days |

### Step 1: Create Developer Accounts

**Apple Developer Program:**
1. Go to https://developer.apple.com/programs/
2. Click "Enroll"
3. Sign in with Apple ID (or create one)
4. Choose Individual or Organization
5. Pay $99/year
6. Wait for approval (usually 24-48 hours)

**Google Play Console:**
1. Go to https://play.google.com/console
2. Sign in with Google account
3. Accept Developer Agreement
4. Pay $25 one-time fee
5. Complete account details
6. Access granted immediately

### Step 2: Prepare App Store Assets

**Required for Both Stores:**

| Asset | Specification |
|-------|---------------|
| App Name | "BabyTracker" (check availability) |
| Short Description | 80 characters max |
| Full Description | 4000 characters max |
| Privacy Policy URL | Must be publicly accessible |
| App Icon | 1024x1024 PNG (no alpha) |
| Feature Graphic (Android) | 1024x500 PNG |

**Screenshots Required:**

| Device | Apple | Google |
|--------|-------|--------|
| iPhone 6.7" | Required | N/A |
| iPhone 6.5" | Required | N/A |
| iPhone 5.5" | Required | N/A |
| iPad 12.9" | If supporting iPad | N/A |
| Phone | N/A | At least 2 |
| Tablet (7") | N/A | If supporting |
| Tablet (10") | N/A | If supporting |

### Step 3: App Store Specific Setup (Apple)

**In App Store Connect:**

1. **Create App**
   - Bundle ID: `com.yourcompany.babytracker`
   - SKU: `babytracker-ios`
   - Primary Language: English

2. **App Information**
   - Category: **Lifestyle** (NOT Health & Fitness)
   - Content Rights: You own all content
   - Age Rating: Complete questionnaire (likely 4+)

3. **Privacy Section**
   - Privacy Policy URL: Your hosted policy
   - Data Collection: Declare "Health & Fitness" data type
   - Data Use: "App Functionality" only
   - Data Linked to User: Yes
   - Data Used to Track: No

4. **App Privacy Details**
   ```
   Data Types Collected:
   ✓ Health & Fitness (baby feeding, sleep data)
   ✓ Contact Info (email for account)
   ✓ Identifiers (user ID)

   Data Use:
   ✓ App Functionality
   ✗ Analytics (if not using)
   ✗ Advertising (never)
   ✗ Third-Party Advertising (never)
   ```

5. **Review Information**
   - Contact info for reviewer
   - Demo account (if login required)
   - Notes: "This is a baby activity tracking app for parents. No medical claims are made."

### Step 4: Play Store Specific Setup (Google)

**In Google Play Console:**

1. **Create App**
   - App name: BabyTracker
   - Default language: English
   - App or Game: App
   - Free or Paid: Free

2. **Store Listing**
   - Short description (80 chars)
   - Full description (4000 chars)
   - App icon, feature graphic, screenshots

3. **Content Rating**
   - Complete IARC questionnaire
   - Expected rating: Everyone

4. **Target Audience**
   - Target age: NOT children (this is for parents)
   - Select "18 and over" or "All ages" (not "Children")

5. **Data Safety Form**
   ```
   Data Collected:
   ✓ Personal info (email, name)
   ✓ Health info (baby tracking data)

   Data Shared:
   ✗ None (data not shared with third parties)

   Security:
   ✓ Data encrypted in transit
   ✓ Data can be deleted
   ```

6. **App Content**
   - Privacy Policy URL
   - Ads: No ads
   - App access: All functionality available

### Step 5: Build and Submit

**Using EAS (Recommended):**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project (first time)
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

**EAS Configuration (eas.json):**

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-store-connect-app-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

### Step 6: Review Process

**Apple App Review:**

| Stage | Duration | Notes |
|-------|----------|-------|
| Waiting for Review | 1-3 days | Longer for first submission |
| In Review | 1-24 hours | Automated + manual |
| Approved/Rejected | - | Rejection includes reason |

**Common Rejection Reasons to Avoid:**
- Missing privacy policy
- App crashes during review
- Incomplete features or placeholder content
- Login issues (provide demo account)
- Misleading description
- Missing required device permissions explanation

**Google Play Review:**

| Stage | Duration | Notes |
|-------|----------|-------|
| Processing | Hours | Automated checks |
| In Review | 1-7 days | Longer for new accounts |
| Published/Rejected | - | Usually faster than Apple |

### Step 7: Avoid Common Issues

**Before Submission Checklist:**

```
[ ] App works on real device (not just simulator)
[ ] All features functional (no placeholders)
[ ] Privacy policy URL accessible
[ ] Account deletion works
[ ] Offline mode works
[ ] No crashes in critical flows
[ ] All screenshots accurate
[ ] Description matches functionality
[ ] No medical claims in description
[ ] Age rating questionnaire accurate
[ ] Data safety/privacy forms complete
```

**App Description Template (Safe):**

```
Track your baby's daily routine with ease.

FEATURES:
• Log breastfeeding with timer and side tracking
• Track bottle feedings and solid foods
• Monitor sleep patterns and duration
• Record diaper changes
• Chart growth with WHO percentiles
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

**Keywords to AVOID:**
- "Medical", "diagnosis", "treatment"
- "Health monitoring" (use "activity tracking")
- "Doctor recommended"
- "Clinical", "certified"

**Keywords that are SAFE:**
- "Tracking", "logging", "recording"
- "Patterns", "routine", "schedule"
- "Sharing", "sync", "caregivers"
- "Export", "reports"

---

## Part 8: Cost Summary

### Development Costs

| Item | Cost |
|------|------|
| Expo / React Native | Free |
| Supabase (development) | Free |
| PowerSync (development) | Free |
| EAS Build (30 builds/mo) | Free |

### Launch Costs

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Google Play Console | $25 | One-time |
| **Total Year 1** | **$124** | - |
| **Subsequent Years** | **$99** | Annual |

### Scaling Costs (Monthly)

| Users | Supabase | PowerSync | Total |
|-------|----------|-----------|-------|
| 0 - 1,000 | $0 | $0 | $0 |
| 1,000 - 5,000 | $0 | $0 | $0 |
| 5,000 - 10,000 | $25 | $0-49 | $25-74 |
| 10,000 - 50,000 | $25 | $49 | $74 |
| 50,000+ | $25-75 | $49-99 | $74-174 |

---

## Part 9: Development Phases

### Phase 1: Core MVP

**Goal:** Basic tracking app without Watch/widgets

**Features:**
- Feeding tracking (breast, bottle, solid)
- Sleep tracking with timer
- Diaper tracking
- Basic statistics
- Single user (no sync)
- Dark mode

**Estimated Scope:** Foundation

### Phase 2: Multi-Caregiver Sync

**Goal:** Real-time sync between caregivers

**Features:**
- Supabase integration
- PowerSync offline-first
- Invite code sharing
- Conflict resolution
- Multiple babies

**Estimated Scope:** Core differentiator

### Phase 3: Native Extensions

**Goal:** Apple Watch, widgets, Live Activities

**Features:**
- iOS Watch app (Swift)
- iOS widgets (WidgetKit)
- Live Activities
- Android widgets
- Background timers (native)

**Estimated Scope:** Platform features

### Phase 4: Polish & Launch

**Goal:** App Store ready

**Features:**
- Growth charts (WHO/CDC)
- Data export (CSV/PDF)
- Siri shortcuts
- Onboarding flow
- App Store assets
- Privacy policy

**Estimated Scope:** Launch readiness

---

*Document created: January 2026*
*Stack: React Native + Expo Prebuild + Supabase + PowerSync*
*Testing: Vitest + Maestro*
