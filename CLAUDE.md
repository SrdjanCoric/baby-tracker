# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- Custom sync engine with offline queue and conflict resolution

### State Management
Uses React Context + Reducers pattern (no Redux). Each feature has its own context provider. Main contexts include: AuthContext, BabyContext, HouseholdContext, SyncContext, NotificationContext, and activity-specific contexts (Feeding, Sleep, Diaper, Pumping, Growth, TummyTime).

Provider nesting order is defined in `app/_layout.tsx` - maintain this order when adding new providers.

### Storage Pattern
- AsyncStorage for preferences with prefixed keys (`@babies`, `@feedings:`, etc.)
- Local-first architecture: save locally first, then sync to Supabase
- Each activity type has paired files: `*-storage.ts` (local) and sync handled via `activity-sync-service.ts`

### Sync Architecture
The app uses a custom sync system with the following components:

**Core Services (`src/services/sync/`):**
- `sync-engine.ts` - Main orchestrator for sync operations with auth context, queue management, and push changes
- `real-time-sync.ts` - Supabase Realtime subscriptions for live updates between household members
- `sync-queue.ts` - Persistent queue for offline operations with retry logic
- `conflict-resolver.ts` - Handles sync conflicts with timestamp-based resolution

**Sync Services (`src/services/`):**
- `activity-sync-service.ts` - Syncs all activity types (feedings, sleep, diapers, etc.) to Supabase
- `baby-sync-service.ts` - Handles baby data sync including ID remapping for local-only babies
- `baby-storage-sync.ts` - Bridge between local baby storage and sync layer

**Key Patterns:**
- Remote changes dispatch actions like `REMOTE_INSERT`, `REMOTE_UPDATE`, `REMOTE_DELETE` to contexts
- SyncContext manages auth context and coordinates sync operations
- Retry utility (`src/utils/retry.ts`) provides exponential backoff for network operations

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
- `supabase/functions/send-activity-notification/` - Edge function for push delivery
- Tokens stored in `push_tokens` table with `last_used_at` tracking

### Navigation Structure
- `app/(tabs)/` - Main tab navigation (home, timeline, stats)
- `app/auth/` - Authentication screens (sign-in)
- `app/onboarding/` - Onboarding flow with auth choice
- `app/settings/` - Settings screens (household, caregivers, notifications, about)
- Activity screens: `app/feeding/`, `app/sleep/`, `app/diaper/`, `app/pumping/`, `app/growth/`, `app/tummyTime/`

### Authentication
Supports Magic Link, native Google Sign-In, and Apple Sign-In. Auth flow uses Supabase with native ID token exchange. Deep linking handles OAuth callbacks via `sofibaby://` scheme.

**Key Features:**
- PKCE flow for Android magic link authentication
- Display name prompt for new OAuth users (Google/Apple don't auto-save names)
- Non-blocking profile fetch: auth state updates immediately, profile loads in background

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

### Statistics Components
- `src/components/SimpleBarChart.tsx` - Basic bar chart for weekly data
- `src/components/StackedBarChart.tsx` - Stacked bars (e.g., night sleep vs naps)
- `src/components/stats/GrowthStatsCard.tsx` - Growth metrics with WHO percentiles

## Custom Hooks

- `useTimeRefresh(intervalMs)` - Triggers re-renders at intervals for relative time displays
- `useDuplicateCheck()` - Detects potential duplicate activity entries
- `useTimerAlertIntegration()` - Coordinates timer state with notification alerts

## Testing Strategy

- **Vitest**: Unit tests (`*.test.ts`) - runs in Node environment
- **Jest**: Component tests (`*.component.test.tsx`) - uses jest-expo preset
- **Maestro**: E2E tests in `e2e/` directory
- Security tests in `src/__tests__/security/`
- Integration tests in `src/__tests__/`

### Maestro E2E Testing Patterns

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

## Code Style

- No comments unless code is complex - code should be self-explanatory
- Never use `any` to fix TypeScript issues - properly type everything
- Never bend tests to make them pass - tests validate correct behavior
- Follow TDD: write failing tests first, then implement

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

Migrations are in `supabase/migrations/`. Key migrations:

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
