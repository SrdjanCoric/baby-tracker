# E2E Testing with Maestro

End-to-end tests using [Maestro](https://maestro.mobile.dev/) with local Supabase.

## Prerequisites

- **Docker Desktop** - Required for local Supabase
- **Xcode** (macOS) - For iOS simulator
- **Android Studio** - For Android emulator

## Setup Steps

### 1. Install Maestro CLI

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version
```

### 2. Install Supabase CLI

```bash
brew install supabase/tap/supabase
# or
npm install -g supabase
```

### 3. Start Local Supabase

```bash
cd /Users/srdjancoric/Dropbox/Projects/baby-tracker

# Start Supabase (Docker must be running)
supabase start

# Apply migrations
supabase db push
```

After `supabase start`, note the **anon key** from the output. It may be labeled as:
- `anon key` or
- `service_role key` (use the `anon` one, not service_role)

You can also get it by running:
```bash
supabase status
```

Look for the line showing `anon key: eyJ...` (a long JWT token).

### 4. Configure Environment

Copy the E2E environment file and update it with your local anon key:

```bash
# For iOS
cp .env.e2e .env

# For Android
cp .env.e2e.android .env
```

Edit `.env` and replace `YOUR_LOCAL_ANON_KEY_HERE` with the anon key from step 3.

**Quick setup (alternative):**
```bash
# Extract anon key and create .env automatically (iOS)
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')
sed "s/YOUR_LOCAL_ANON_KEY_HERE/$ANON_KEY/" .env.e2e > .env
```

### 5. Build the App

**iOS Prerequisites:**
```bash
# Install CocoaPods if not already installed
sudo gem install cocoapods

# If you get "pod: command not found" after install, add to PATH:
export PATH="$PATH:$(gem environment gemdir)/bin"
# Or restart your terminal
```

**Build:**
```bash
# iOS
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx expo run:ios

# Android
npx expo prebuild --platform android --clean
npx expo run:android
```

### 6. Seed Test Data

```bash
npm run e2e:seed
```

## Running Tests

### Run Smoke Tests (Critical Paths)

```bash
npm run e2e:smoke
```

### Run Full Regression

```bash
npm run e2e:regression
```

### Run Single Test

```bash
npm run e2e:flow e2e/flows/onboarding/guest-flow.yaml
```

### Run with Debug UI

```bash
maestro test e2e/flows/onboarding/guest-flow.yaml --debug
```

### Interactive Studio Mode

```bash
maestro studio
```

## Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run e2e:setup` | Start local Supabase and apply migrations |
| `npm run e2e:seed` | Seed test data |
| `npm run e2e:cleanup` | Remove test data |
| `npm run e2e:create-users` | Create test users via Admin API |
| `npm run e2e:smoke` | Run smoke test suite |
| `npm run e2e:regression` | Run full regression suite |
| `npm run e2e:flow <path>` | Run specific test flow |

## Directory Structure

```
e2e/
├── config/           # Maestro configuration
├── fixtures/         # SQL seed/cleanup scripts
├── helpers/          # Reusable flow components
├── flows/            # Test flows organized by feature
│   ├── onboarding/   # Welcome, guest flow, validation
│   ├── auth/         # Sign in, sign out, session
│   ├── activities/   # Feeding, sleep, diaper, etc.
│   ├── household/    # Invite codes, join/leave
│   ├── timeline/     # View, filter, edit activities
│   ├── settings/     # Theme, language, units
│   └── edge-cases/   # Empty states, validation errors
├── suites/           # Test suite definitions
└── scripts/          # Shell scripts
```

## Test Suites

| Suite | Contents |
|-------|----------|
| `smoke.yaml` | Critical user paths - onboarding, core activities, timeline |
| `regression.yaml` | Full coverage - all features and edge cases |
| `multi-user.yaml` | Household scenarios with pre-seeded data |

## testID Reference

Key testIDs used in the app:

### Screens
- `home-screen` - Home/dashboard
- `feeding-screen` - Feeding activity
- `sleep-screen` - Sleep activity
- `diaper-screen` - Diaper activity

### Navigation
- `home-tab` - Home tab
- `timeline-tab` - Timeline tab
- `stats-tab` - Statistics tab
- `settings-button` - Settings button

### Activity Cards (Home)
- `feeding-card` - Feeding dashboard card
- `sleep-card` - Sleep dashboard card
- `diaper-card` - Diaper dashboard card
- `pumping-card` - Pumping dashboard card
- `growth-card` - Growth dashboard card
- `tummyTime-card` - Tummy time dashboard card

### Activity Screens
- `type-breast` - Breastfeeding tab
- `type-bottle` - Bottle tab
- `type-solids` - Solids tab
- `type-nap` - Nap button
- `type-night` - Night sleep button
- `type-wet` - Wet diaper
- `type-dirty` - Dirty diaper
- `type-mixed` - Mixed diaper
- `type-dry` - Dry diaper
- `start-left-button` - Start left side
- `start-right-button` - Start right side
- `stop-timer-button` - Stop timer
- `save-button` - Save entry

### Auth
- `sign-in-button` - Sign in button
- `continue-as-guest-button` - Continue as guest
- `email-input` - Email text input
- `send-magic-link-button` - Send magic link
- `skip-button` - Skip onboarding
- `continue-button` - Continue/next button

## Cleanup

```bash
# Remove test data
npm run e2e:cleanup

# Stop Supabase
supabase stop
```

## Troubleshooting

### Maestro can't find elements
- Use `maestro studio` to inspect the running app
- Verify testID props are correctly set
- Check element visibility (not scrolled off-screen)

### Supabase issues
- Ensure Docker Desktop is running
- Run `supabase stop` then `supabase start`
- Check logs with `supabase logs`

### Android emulator can't reach Supabase
- Android emulator uses `10.0.2.2` instead of `localhost`
- Use `.env.e2e.android` configuration

### iOS build fails
- Run `npx expo prebuild --platform ios --clean`
- Open Xcode and fix signing issues if needed
