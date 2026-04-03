# CLAUDE.md

## Build & Test Commands

```bash
npm start                    # Expo dev server
npm run ios                  # iOS simulator
npm run android              # Android emulator
npx expo prebuild --platform ios --clean && npx expo run:ios    # Full iOS rebuild
npx expo prebuild --platform android --clean && npx expo run:android  # Full Android rebuild

npm run test:unit            # Vitest unit tests
npm run test:component       # Jest component tests
npm run test:security        # Security tests
npm run test:all             # All tests
npm run typecheck            # TypeScript type checking
npm run lint                 # ESLint
```

## Tech Stack

- React Native 0.81 / Expo SDK 54 / React 19
- TypeScript (strict) / NativeWind v4 / Expo Router v6
- Supabase (auth + PostgreSQL + Realtime) with PowerSync for offline-first sync
- i18next — 6 languages: en, sr, es, fr, pt, de (`src/i18n/locales/`)
- Font: Nunito

## Architecture

### State Management
React Context + Reducers (no Redux). Provider tree is ~25 levels deep in `app/_layout.tsx`. Maintain nesting order when adding new providers.

### Storage & Sync
- Local-first: AsyncStorage for preferences, activity data keyed by babyId
- Keys scoped per user via `getUserScopedKey()`
- Each activity type has `*-storage.ts` (local) + sync via `activity-sync-service.ts`
- Sync engine in `src/services/sync/` — PowerSync connector + custom queue + conflict resolution
- Remote changes dispatch `REMOTE_INSERT`, `REMOTE_UPDATE`, `REMOTE_DELETE` to contexts
- **Critical: on foreground resume, flush sync queue before pulling server data**

### Native Targets
- **iOS Widget**: `targets/widget/` — App Group `group.com.sofibaby.app`, data via ExtensionStorage
- **Apple Watch**: `targets/watch/` — WCSession + Supabase REST fallback
- **Live Activities**: Dynamic Island timers, deep links `sofibaby://?action=pause|resume|stop`
- All push delivery uses direct APNs (not Expo Push API)

### Household System
Multi-caregiver with Owner/Member roles. Invite codes. Active timers enforce household-wide exclusivity per `(baby_id, activity_type)`.

### Database
Migrations in `supabase/migrations/` (currently up to 049). Edge functions in `supabase/functions/`. Numbering may include lettered variants (e.g., 009b).

## Code Style

- No comments unless code is complex
- Never use `any` — properly type everything
- Never bend tests to make them pass
- Never mention Claude Code or AI in commits/PRs
- Use `TFunction` from i18next when passing `t` as parameter (not `(key: string) => string` — causes TS compiler crashes)

## Key Constants

- `src/constants/colors.ts` + `colors.js` — single source of truth for all colors. **JS file must stay in sync with TS.**
- `src/constants/design-tokens.ts` — spacing, shadows, typography
- `src/constants/activities.ts` — activity types, presets

## Known Gotchas

- **NativeWind `dark:` crashes** — Use inline `style` with `useColorScheme()` on screens with many providers instead of `dark:` className variants
- **Push before pull** — Flush sync queue before fetching server data on foreground resume
- **Global hooks at root** — Timer alerts, widget handlers must mount in `_layout.tsx`, not individual screens
- **APNs widget push type is `widgets` (plural)**
- **Push tokens need per-token `is_sandbox` routing** — dev builds get sandbox tokens
- **Silent Supabase query failures** — query on non-existent column returns null, doesn't throw
- **Schema-qualify functions in auth triggers** — triggers on `auth.users` need explicit `public.` prefix
- **Stale `.js` files shadow `.ts` in vitest** — delete compiled JS if tests fail on new code

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```
