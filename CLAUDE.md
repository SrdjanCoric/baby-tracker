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
- Supabase (auth + PostgreSQL backend)
- PowerSync (offline-first sync with local SQLite)

### State Management
Uses React Context + Reducers pattern (no Redux). Each feature has its own context provider. Main contexts include: AuthContext, BabyContext, SyncContext, and activity-specific contexts (Feeding, Sleep, Diaper, Pumping, Growth, TummyTime).

Provider nesting order is defined in `app/_layout.tsx` - maintain this order when adding new providers.

### Storage Pattern
- AsyncStorage for preferences with prefixed keys (`@babies`, `@feedings:`, etc.)
- PowerSync for offline-first data sync
- Each activity type has paired files: `*-storage.ts` (local) and `*-storage-sync.ts` (sync)

### Navigation Structure
- `app/(tabs)/` - Main tab navigation (home, timeline, stats, profile)
- `app/(auth)/` - Authentication screens
- `app/onboarding/` - Onboarding flow
- Activity screens: `app/feeding/`, `app/sleep/`, `app/diaper/`, etc.

### Authentication
Supports Email/Password, Magic Link, native Google Sign-In, and Apple Sign-In. Auth flow uses Supabase with native ID token exchange. Deep linking handles OAuth callbacks via `sofibaby://` scheme.

## Testing Strategy

- **Vitest**: Unit tests (`*.test.ts`) - runs in Node environment
- **Jest**: Component tests (`*.component.test.tsx`) - uses jest-expo preset
- Security tests in `src/__tests__/security/`

## Code Style

- No comments unless code is complex - code should be self-explanatory
- Never use `any` to fix TypeScript issues - properly type everything
- Never bend tests to make them pass - tests validate correct behavior
- Follow TDD: write failing tests first, then implement

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

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
