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
