# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Active plan

`plans/master-plan.md` — the project's master plan (durable architectural decisions + ordered task pointers). Task bodies live in `plans/tasks/`; new work is added via the `to-plan` skill, which appends to this plan and never creates a second one.

Plan files are version-controlled project state. Commit each planning batch through a dedicated documentation PR before starting its implementation branches. Do not leave plan updates as long-lived working-tree changes. After a task PR merges, a closeout limited to changing its master-plan pointer/status and moving its task file to `plans/tasks/done/` must be committed directly to `main` with `[skip ci]`; do not open a closeout PR or run CI. Use a documentation PR if the closeout includes any broader documentation or planning changes.

## Build and Development Commands

```bash
# Development
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator

# iOS (requires CocoaPods)
npx expo prebuild --platform ios --clean && npx expo run:ios

# Android
npx expo prebuild --platform android --clean && npx expo run:android

# Testing
npm run test:unit            # Vitest unit tests
npm run test:unit:watch      # Watch mode
npm run test:component       # Jest component tests
npm run test:security        # Security tests
npm run test:all             # All tests

# Code Quality
npm run typecheck            # TypeScript type checking
npm run lint                 # ESLint
npm run lint:fix             # Auto-fix lint issues
```

## Architecture Overview

### Tech Stack
- React Native with Expo SDK 54
- TypeScript (strict mode)
- NativeWind v4 (Tailwind CSS for React Native)
- Expo Router v6 (file-based routing)
- Supabase (auth + PostgreSQL backend + Realtime)
- Custom sync engine with offline queue (CRDT conflict resolution in progress)
- i18next for internationalization (en, sr, es)

### State Management
Uses React Context + Reducers pattern (no Redux). Each feature has its own context provider. The provider tree is ~20 levels deep — see `app/_layout.tsx` lines 405-463 for the exact nesting order.

**Contexts:** ThemeProvider, LanguageProvider, AuthProvider, SyncProvider, HouseholdProvider, UnitProvider, TimeFormatProvider, BabyProvider, FeedingProvider, SleepProvider, DiaperProvider, PumpingProvider, GrowthProvider, TummyTimeProvider, MilestonesProvider, HealthProvider, ActiveTimersProvider, WidgetProvider, NotificationProvider, DashboardConfigProvider.

Maintain nesting order when adding new providers.

### Storage Pattern
- AsyncStorage for preferences with prefixed keys
- Keys are scoped per user via `getUserScopedKey()`, activity data keyed by babyId (e.g., `@feedings:{babyId}`)
- Local-first architecture: save locally first, then sync to Supabase
- Each activity type has paired files: `*-storage.ts` (local) and sync handled via `activity-sync-service.ts`

### Sync Architecture
The app uses a custom sync system with the following components:

**Core Services (`src/services/sync/`):**
- `sync-engine.ts` - Main orchestrator for sync operations with auth context, queue management, and push changes
- `real-time-sync.ts` - Supabase Realtime subscriptions for live updates between household members; uses device ID for echo filtering
- `sync-queue.ts` - Persistent queue for offline operations with retry logic

**Sync Services (`src/services/`):**
- `activity-sync-service.ts` - Syncs all activity types (feedings, sleep, diapers, etc.) to Supabase
- `baby-sync-service.ts` - Handles baby data sync including ID remapping for local-only babies

**Key Patterns:**
- Remote changes dispatch actions like `REMOTE_INSERT`, `REMOTE_UPDATE`, `REMOTE_DELETE` to contexts
- SyncContext manages auth context and coordinates sync operations
- Retry utility (`src/utils/retry.ts`) provides exponential backoff for network operations
- On foreground resume: flush sync queue before pulling server data (prevents overwriting local optimistic state)

### Active Timers
Household-wide timer exclusivity via `active_timers` table:
- Atomic lock acquisition via `acquire_timer_lock()` RPC
- Prevents simultaneous timers per `(baby_id, activity_type)`
- Stale lock cleanup after 12 hours
- Service: `src/services/active-timer-service.ts`

### Household System
Multi-caregiver support with household management:

**Roles:**
- **Owner**: Created the household, can manage caregivers (remove members), regenerate invite codes
- **Member**: Joined via invite code, can view household but not manage others, can leave

**Key Files:**
- `src/contexts/household-context.tsx` - Household state and real-time member updates
- `src/services/household-service.ts` - Join/leave household operations
- `src/services/caregiver-service.ts` - Caregiver management (removal, stats)
- `app/settings/household.tsx` - Household settings UI
- `app/settings/caregivers.tsx` - Caregiver management UI

**Database Functions (migrations 007-018):**
- `join_household_by_invite_code` - Handles joining with baby data migration
- `leave_household` - Creates new household for leaving member
- `remove_caregiver` - Owner removes member, creates new household for them

### Push Notifications
- `src/services/notification-service.ts` - Local notification scheduling
- `src/services/push-token-service.ts` - Push token registration with Supabase
- Tokens stored in `user_push_tokens` table with `device_token` and `is_sandbox` columns
- `is_sandbox` per-token routing determines APNs endpoint (dev builds get sandbox tokens)
- All push delivery uses direct APNs (not Expo Push API)

**Edge Functions:**
- `send-activity-notification` - Push for activity events between caregivers
- `send-widget-push` - WidgetKit push to refresh widget timeline
- `check-feeding-reminders` - Scheduled feeding reminder checks
- `check-wake-window-reminders` - Wake window alert checks
- `start-live-activity` / `end-live-activity` - iOS Live Activity management
- `toggle-timer-pause` - Server-side timer pause/resume

### Widget, Watch & Live Activities
**iOS Widget** (`targets/widget/index.swift`):
- Uses App Group `group.com.sofibaby.app`
- Data flow: React contexts → `widget-data-service.ts` → ExtensionStorage → Widget reads UserDefaults
- Widget push tokens in `widget_push_tokens` table
- Auth credentials written to App Group for widget extension Supabase REST calls

**Apple Watch** (`src/services/watch-service.ts`):
- WCSession for phone↔watch communication
- Falls back to direct Supabase REST when phone unreachable

**Live Activities** (`src/services/live-activity-service.ts`):
- iOS Dynamic Island timers
- Deep link actions: `sofibaby://?action=pause|resume|stop`

### i18n
- i18next + react-i18next + expo-localization
- 7 languages: English (en), Spanish (es, es-ES), Portuguese (pt-BR, pt-PT), German (de), French (fr), Italian (it), Serbian (sr)
- Translation files: `src/i18n/locales/{en,es,es-ES,pt-BR,pt-PT,de,fr,it,sr}.json` (9 locale files; Spanish and Portuguese have regional variants)
- Custom hook: `useAppTranslation()` wraps i18next

### Navigation Structure
- `app/(tabs)/` - Main tab navigation (home, timeline, stats)
- `app/auth/` - Authentication screens (sign-in)
- `app/onboarding/owner/` - Production role-based onboarding for new owners, invited caregivers, and returning users
- `app/settings/` - Settings screens (household, caregivers, notifications, about, theme, language, units, time-format, widget-config, dashboard, export, reports, join-household, delete-account)
- Activity screens: `app/feeding/`, `app/sleep/`, `app/diaper/`, `app/pumping/`, `app/growth/`, `app/tummyTime/`, `app/health/`
- `app/milestones/` - Milestone tracking
- `app/edit/` - Edit screens for all activity types
- Deep link scheme: `sofibaby://` with action params (`?action=pause|resume|stop`)

### Authentication
Supports Magic Link, native Google Sign-In, and Apple Sign-In. Auth flow uses Supabase with native ID token exchange. Deep linking handles OAuth callbacks via `sofibaby://` scheme.

**Key Features:**
- PKCE flow for Android magic link authentication
- Display name prompt for new OAuth users (Google/Apple don't auto-save names)
- Non-blocking profile fetch: auth state updates immediately, profile loads in background

## Constants
- `src/constants/colors.ts` - Single source of truth for ALL colors (light/dark themes, activity colors)
- `src/constants/colors.js` - JS mirror of colors.ts for NativeWind/Tailwind config (must stay in sync)
- `src/constants/activities.ts` - Activity type definitions, dosage units, symptom/medication/vaccine presets
- `src/constants/vaccine-schedule.ts` - CDC vaccine schedule data, combo vaccine coverage, dose helpers
- `src/constants/design-tokens.ts` - Border radius, spacing, shadows, typography scales
- `src/constants/milestones.ts` - Milestone category definitions
- Font: Nunito (Regular, Medium, SemiBold, Bold)

## Growth & Statistics

### Growth Measurements
- `src/contexts/growth-context.tsx` - Growth state management with weight change calculations
- `src/utils/growth-helpers.ts` - Helper functions for age-based labels (Length vs Height)
- `src/components/stats/GrowthStatsCard.tsx` - Dashboard card showing weight, height, head with percentiles
- `app/growth/charts.tsx` - WHO percentile growth charts

**Key Patterns:**
- Use "Length" for babies under 24 months, "Height" for 2+ years (clinical standard)
- Database field remains `height_cm` - label is UI-only based on baby's age
- `isUnderTwoYears(birthDate)` helper determines which label to show

### Health Tracking
- `src/contexts/health-context.tsx` - Health state, CRUD, `getCompletedVaccinations()` with combo vaccine expansion
- `src/services/health-storage.ts` - Local storage for health entries (medication, temperature, vaccination, symptom)
- `src/utils/temperature.ts` - Fever thresholds vary by measurement method (armpit uses lower cutoffs per AAP)
- `src/utils/health-display.ts` - Translates stored medication/vaccine keys to display names
- Combo vaccines: hexavalent dose N auto-counts as DTaP/IPV/Hib dose N + HepB dose N+1
- Medication stores dosage with unit (ml/mg/drops/tsp) — `dosageAmount` + `dosageUnit` fields
- Vaccination stores `doseNumber` for multi-dose tracking

### Statistics Components
- `src/components/SimpleBarChart.tsx` - Basic bar chart for weekly data
- `src/components/StackedBarChart.tsx` - Stacked bars (e.g., night sleep vs naps)
- `src/components/stats/GrowthStatsCard.tsx` - Growth metrics with WHO percentiles
- `src/components/stats/health/HealthStatsView.tsx` - Health overview (no tabs, like Growth): latest temp, vaccine progress, symptom frequency

## Custom Hooks

- `useTimeRefresh(intervalMs)` - Triggers re-renders at intervals for relative time displays
- `useDuplicateCheck()` - Detects potential duplicate activity entries
- `useTimerAlertIntegration()` - Coordinates timer state with notification alerts
- `useAppTranslation()` - Wraps i18next with app-specific defaults
- `useGlobalTimerAlerts()` - Global timer alert monitoring (mounted at root layout)
- `useNotificationIntegration()` - Coordinates notification scheduling with activity state
- `useAccessibility()` - Accessibility helpers
- `useWidgetStopHandler()` - Handles stop actions from widget deep links
- `useWidgetPauseHandler()` - Handles pause/resume actions from widget deep links
- `useWatchMessageHandler()` - Processes incoming Apple Watch messages

## Testing Strategy

- **Vitest**: Unit tests (`*.test.ts`) - runs in Node environment
- **Jest**: Component tests (`*.component.test.tsx`) - uses jest-expo preset
- **Maestro**: E2E tests in `e2e/` directory
- Security tests in `src/__tests__/security/`
- Integration tests in `src/__tests__/`

### Maestro E2E Testing Patterns

**Standalone Flow Preflight:**
Before running a standalone Maestro flow, confirm that the Metro process on port 8081 belongs to
the current checkout. Reuse it when it does; otherwise stop the stale process, start
`npx expo start --dev-client --clear`, and wait until `http://127.0.0.1:8081/status` reports
`packager-status:running`. Give the flow's first screen up to 60 seconds for a cold bundle. When
tailing logs after Maestro, save and return Maestro's exit code instead of letting `tail` mask a
failure.

**Resumable Onboarding Suites:**
Run onboarding E2E through `npm run e2e:onboarding:ios` or
`npm run e2e:onboarding:android`, not by passing the monolithic onboarding suite YAML directly to
Maestro. The runner saves the device ID and each successful flow under the ignored
`e2e/artifacts/` directory, force-stops the app between flows, and resumes at the first unverified
flow. Use `--only <flow>` to run or rerun one scenario regardless of its checkpoint. Use `--reset`
after broad onboarding changes, after resetting local Supabase for a new verification cycle, or
before final release proof. Do not edit checkpoint files to claim a pass. If a failed flow may have
changed a fixture account before its final assertion, restore the local fixture before rerunning it.

**Keyboard Dismissal:**
To dismiss the keyboard in Maestro tests, tap on an element with `testID="dismiss-keyboard"` rather than using Maestro's `hideKeyboard` command. Screens that have text inputs should wrap their header in a Pressable that calls `Keyboard.dismiss()`:
```tsx
<Pressable
  onPress={() => Keyboard.dismiss()}
  className="flex-row items-center px-4 py-3"
  testID="dismiss-keyboard"
>
  {/* Header content */}
</Pressable>
```

**Horizontal ScrollView Swiping:**
To reveal items in a horizontal ScrollView (e.g., filter tabs), use swipe with specific coordinates:
```yaml
- swipe:
    start: 90%, 15%    # Start from right side, at vertical position of scroll
    end: 10%, 15%      # End at left side
```

**Loading States:**
Ensure screens have consistent `testID` on both loading and loaded states, otherwise assertions may fail during loading.

## Known Gotchas

- **NativeWind `dark:` variants crash under rapid re-renders** — Use inline `style` props with `useColorScheme()` boolean instead of `dark:` className variants on screens with many context providers. See `docs/debug-insights/nativewind-dark-variant-navigation-context.md`
- **Offline sync: push before pull** — When app returns to foreground with pending queue items, flush the sync queue before fetching server data. Otherwise server fetch overwrites local optimistic state. See `docs/debug-insights/offline-sync-race-condition.md`
- **Global hooks must mount at root layout** — Hooks that need to run regardless of screen (timer alerts, widget handlers) must be in `_layout.tsx` wrapper components, not individual screens. See `docs/debug-insights/server-side-notifications-and-foreground-refresh.md`
- **APNs push type for widgets is `widgets` (plural)** — Not `widget`, `widgetpush`, or `background`. See `docs/debug-insights/widgetkit-push-notifications.md`
- **Push tokens need per-token sandbox routing** — Dev builds get sandbox tokens; `is_sandbox` column on `user_push_tokens` determines APNs endpoint. See `docs/debug-insights/apns-sandbox-per-token-routing.md`
- **Silent Supabase query failures cascade** — A query on a non-existent column returns default/null, doesn't throw. Always verify column existence. See `docs/debug-insights/guest-migration-and-notification-sync.md`
- **Schema-qualify functions in auth triggers** — See Database Trigger Patterns section below

## Code Style

- No comments unless code is complex - code should be self-explanatory
- Never use `any` to fix TypeScript issues - properly type everything
- Never bend tests to make them pass - tests validate correct behavior
- Never mention Claude Code or any AI assistant as co-author in commit messages or PR descriptions

### TypeScript Patterns

**i18next Translation Function:**
When passing the `t` function as a parameter, use the `TFunction` type from i18next:
```typescript
import type { TFunction } from "i18next";

const getLabel = (key: string, t: TFunction): string => {
  return t(`some.key.${key}`);
};
```
Do NOT use `(key: string) => string` - this causes TypeScript compiler crashes due to i18next's complex overloaded signatures.

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

## Database Migrations

Migrations are in `supabase/migrations/`. Numbering may include lettered variants (e.g., 009b). Key migrations:

| Migration | Purpose |
|-----------|---------|
| 001 | Initial schema (households, users, babies, activities) |
| 007 | Caregiver removal function, `is_owner` column |
| 010 | Fix join household function |
| 011-013 | Push notifications tables and functions |
| 014 | Leave household function |
| 015-016 | Join household fixes (owner flag, baby deletion) |
| 017 | Enable Realtime for all tables |
| 018 | Fix owner flag on user creation |
| 019 | Add 'dry' diaper type |
| 020-021 | Active timers for household-wide timer exclusivity |
| 022 | Add last_finished_side to feedings |
| 023 | Enable Realtime for active_timers table |
| 024 | Fix trigger schema path for magic link auth |
| 025-026 | Invite code search path fix, RLS recursion fix |
| 027 | Widget push tokens table |
| 028 | Join attempt rate limiting |
| 029-030 | Feeding reminders (then migrated to APNs) |
| 031 | Add device_token to user_push_tokens |
| 032-035 | Wake window reminders |
| 036 | Add is_sandbox to push tokens |
| 037-038 | Wake window per-baby + Realtime |
| 039 | Day/night boundary setting, fix account deletion FK |
| 040 | Growth measured_at to timestamptz |
| 041 | Toggle timer pause RPC |
| 042 | Widget push tokens is_sandbox |
| 043 | Activity goals |
| 044 | Milestones |
| 045-046 | Timer lock fixes (started_at, overload) |
| 047 | Health entries table (medication, temperature, vaccination, symptom) |
| 048 | Health dosage_unit, dose_number columns |
| 049 | Add tsp dosage unit |
| 058 | Email-bound caregiver invitations with a post-release enforcement switch |

## Android-Specific Setup

### Google Sign-In Configuration

Android requires proper SHA-1 fingerprint configuration for Google Sign-In to work:

1. **Get your keystore SHA-1:**
   ```bash
   # For local Expo development builds:
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android | grep SHA1

   # For EAS production builds:
   eas credentials --platform android
   ```

2. **Configure Firebase:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Add/select your project
   - Add Android app with package name `com.sofibaby.app`
   - Add ALL SHA-1 fingerprints (dev + production)
   - Download `google-services.json` to project root

3. **Configure Google Cloud Console:**
   - Each SHA-1 needs a corresponding Android OAuth client
   - Firebase auto-creates these when you add fingerprints

4. **Required SHA-1 fingerprints:**
   - Local dev (Expo): from `android/app/debug.keystore`
   - Production (EAS): from `eas credentials --platform android` (Default keystore)

### Common Android Issues

**DEVELOPER_ERROR (code 10) on Google Sign-In:**
- SHA-1 fingerprint mismatch between app signing key and Google Cloud Console
- Solution: Verify the EXACT SHA-1 from `android/app/debug.keystore` (not `~/.android/debug.keystore`) matches Firebase/Google Cloud

**Magic Link not redirecting after authentication:**
- Deep link received but auth state not updating UI
- Root cause: `fetchUserProfile()` database query blocking auth state
- Solution: Set user as authenticated immediately from session data, fetch profile in background (non-blocking)

**Expo Go limitations:**
- Native modules (`expo-notifications`, `@react-native-google-signin`) don't work in Expo Go
- Solution: Use development builds (`npx expo run:android`) for testing native features

**Tab bar overlapping gesture indicator:**
- Android gesture navigation area needs clearance
- Solution: Add `marginBottom` to tab bar style (not just padding)

## Database Trigger Patterns

**Schema-qualified function calls in triggers:**
Triggers on `auth.users` run in auth schema context and may not find `public` schema functions. Always use explicit schema prefixes:
```sql
-- Correct: explicit schema
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inside function, also use explicit schema
new_household_id := public.create_household_with_code();
```
This prevents "function does not exist" errors when magic link auth creates new users.
