# E2E Testing Implementation

This document describes the E2E testing infrastructure implemented for the baby tracker app.

## Overview

End-to-end testing using **Maestro** with **local Supabase** for test data, covering both iOS and Android platforms.

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| E2E Framework | Maestro | Simple YAML syntax, good mobile support, free |
| Test Database | Local Supabase | Same schema as production, isolated test data |
| CI Platform | GitHub Actions | Already used for unit tests |

## Directory Structure

```
e2e/
├── config/
│   └── maestro.yaml           # Global Maestro configuration
├── fixtures/
│   ├── seed-data.sql          # Test data for pre-populated scenarios
│   └── cleanup.sql            # Cleanup script between test runs
├── helpers/
│   ├── auth.yaml              # Auth flow helpers
│   ├── setup-baby.yaml        # Baby creation helper
│   └── navigation.yaml        # Common navigation patterns
├── flows/
│   ├── onboarding/            # 8 tests
│   ├── auth/                  # 4 tests
│   ├── activities/
│   │   ├── feeding/           # 4 tests
│   │   ├── sleep/             # 2 tests
│   │   ├── diaper/            # 2 tests
│   │   ├── pumping/           # 2 tests
│   │   ├── growth/            # 2 tests
│   │   └── tummy-time/        # 1 test
│   ├── household/             # 5 tests
│   ├── multi-user/            # 2 tests
│   ├── timeline/              # 4 tests
│   ├── baby/                  # 3 tests
│   ├── settings/              # 4 tests
│   ├── offline/               # 2 tests
│   └── edge-cases/            # 4 tests
├── suites/
│   ├── smoke.yaml             # Critical path tests
│   ├── regression.yaml        # Full test coverage
│   └── multi-user.yaml        # Multi-device scenarios
├── scripts/
│   ├── setup-db.sh
│   ├── seed-data.sh
│   ├── cleanup.sh
│   └── create-test-users.sh
└── README.md
```

## Test Coverage

### Onboarding (8 tests)
| Test | Description |
|------|-------------|
| welcome.yaml | Verify the current production welcome screen |
| guest-flow.yaml | Complete the current production onboarding as a guest |
| complete-onboarding.yaml | Complete the current six-step production flow |
| skip-onboarding.yaml | Skip the optional production steps |
| baby-validation.yaml | Check baby-profile validation |
| new-owner-preview-restart.yaml | Recover the role-based owner draft after restart |
| caregiver-code-join.yaml | Join through a local email-bound invitation |
| returning-user-restoration.yaml | Restore a seeded local household before Home |

The three role-based flows use the development launch argument, clear app state, and call real providers against local Supabase. They are fresh-state integration tests, not the isolated Settings preview. The Settings replay tool preserves account data but clears onboarding progress before running the development role-based guard.

### Authentication (4 tests)
| Test | Description |
|------|-------------|
| magic-link.yaml | Email entry and magic link flow |
| sign-out.yaml | Sign out and state clearing |
| session-persistence.yaml | Session survives app restart |
| invalid-email.yaml | Email validation error handling |

### Activity Tracking (13 tests)

**Feeding:**
- breastfeeding-timer.yaml - Start/stop timer, switch sides
- bottle-feeding.yaml - Select content, enter volume
- solids.yaml - Food selection, reaction
- suggested-side.yaml - Verify suggested side logic

**Sleep:**
- nap-timer.yaml - Start nap, verify duration
- night-sleep.yaml - Log night sleep manually

**Diaper:**
- quick-log.yaml - One-tap diaper logging
- dry-diaper.yaml - Dry diaper type

**Pumping:**
- pumping-timer.yaml - Timer with side tracking
- pumping-manual.yaml - Manual volume entry

**Growth:**
- add-measurement.yaml - Weight/height/head entry
- view-charts.yaml - WHO percentile display

**Tummy Time:**
- tummy-timer.yaml - Timer session

### Household (5 tests)
| Test | Description |
|------|-------------|
| view-invite-code.yaml | Display and copy invite code |
| join-household.yaml | Enter code and join |
| leave-household.yaml | Leave and create new household |
| caregiver-management.yaml | View caregiver list |
| regenerate-code.yaml | Owner regenerates invite code |

### Timeline (4 tests)
| Test | Description |
|------|-------------|
| view-activities.yaml | See activities chronologically |
| filter.yaml | Filter by activity type |
| edit-activity.yaml | Modify entry from timeline |
| delete-activity.yaml | Remove entry |

### Settings (4 tests)
| Test | Description |
|------|-------------|
| theme.yaml | Light/dark mode toggle |
| language.yaml | Language switching |
| units.yaml | Metric/imperial conversion |
| dashboard-config.yaml | Show/hide activity cards |

### Edge Cases (4 tests)
| Test | Description |
|------|-------------|
| empty-states.yaml | No baby, no activities states |
| validation-errors.yaml | Form validation across screens |
| concurrent-timers.yaml | Timer exclusivity enforcement |
| rapid-navigation.yaml | Quick tab switching stability |

## testID Props Added

### Components Modified

| File | testIDs Added |
|------|---------------|
| `OnboardingScreen.tsx` | skip-button, continue-button, testID prop |
| `auth-choice.tsx` | sign-in-button, continue-as-guest-button, skip-button |
| `sign-in.tsx` | email-input, send-magic-link-button, google-signin-button, apple-signin-button, close-button, continue-as-guest-button |
| `app/(tabs)/index.tsx` | home-screen |
| `DashboardCard.tsx` | testID prop, action button testID |
| `feeding/index.tsx` | feeding-screen, type-breast, type-bottle, type-solids, start-left-button, start-right-button, stop-timer-button, save-button |
| `sleep/index.tsx` | sleep-screen, type-nap, type-night, stop-timer-button, settings-button |
| `diaper/index.tsx` | diaper-screen, type-wet, type-dirty, type-mixed, type-dry, save-button |

### testID Naming Convention

```
[feature]-[component]-[action]
```

Examples:
- `feeding-card` - Dashboard card for feeding
- `type-breast` - Breastfeeding type selector
- `start-left-button` - Start left side breastfeeding
- `stop-timer-button` - Stop any running timer
- `save-button` - Save/submit form

## Test Suites

### Smoke Suite (~5 min)
Critical paths that must work:
- Onboarding (welcome, guest flow)
- Core activities (feeding timer, bottle, nap, diaper, tummy time, growth, pumping)
- Timeline viewing
- Household invite code

### Regression Suite (~30 min)
Full coverage including:
- All onboarding flows
- All auth flows
- All activity types
- Timeline operations
- Baby management
- Household management
- Settings
- Edge cases

## CI Integration

### GitHub Actions Workflow

**Triggers:**
- Push to main branch (after merge)
- Nightly schedule (6 AM UTC)
- Manual dispatch

**Jobs:**
1. `e2e-ios` - macOS runner with iOS simulator
2. `e2e-android` - Ubuntu runner with Android emulator

**Key Steps:**
1. Checkout code
2. Install dependencies
3. Install Maestro CLI
4. Start local Supabase
5. Seed test data
6. Build app
7. Run tests
8. Upload artifacts

## Test Data Strategy

### Seed Data (`fixtures/seed-data.sql`)
- Test households with invite codes
- Test babies with birth dates
- Pre-seeded activities for timeline tests
- Growth measurements for chart tests

### Cleanup (`fixtures/cleanup.sql`)
- Removes all data with `e2e-` prefix
- Respects foreign key constraints
- Run between test suites

### Test User Creation
- Uses Supabase Admin API
- Creates users with confirmed emails
- Script: `scripts/create-test-users.sh`

## Environment Configuration

### iOS (`.env.e2e`)
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
```

### Android (`.env.e2e.android`)
```
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
```

Android emulator uses `10.0.2.2` to access host localhost.

## npm Scripts

| Script | Command |
|--------|---------|
| `e2e:setup` | Start Supabase and apply migrations |
| `e2e:seed` | Seed test data |
| `e2e:cleanup` | Clean test data |
| `e2e:create-users` | Create test users via Admin API |
| `e2e:smoke` | Run smoke test suite |
| `e2e:regression` | Run full regression |
| `e2e:flow` | Run single test flow |

## Manual QA Scenarios

These cannot be automated with Maestro and require manual testing:

| Scenario | Reason |
|----------|--------|
| Timer lock race condition | Requires 2 physical devices |
| Real-time sync visibility | Requires 2 devices |
| Concurrent edit conflicts | Requires 2 devices |
| Network toggle mid-operation | Cannot control network reliably |
| Push notification delivery | Requires real push infrastructure |

## Future Improvements

1. **More testIDs** - Add to remaining screens (growth, pumping, tummy time, settings)
2. **Visual regression** - Screenshot comparison for UI changes
3. **Performance testing** - Measure app startup and screen transition times
4. **Accessibility testing** - Verify VoiceOver/TalkBack compatibility
5. **Flaky test detection** - Track and fix unreliable tests
