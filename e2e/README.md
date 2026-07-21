# End-to-end tests

The maintained two-caregiver iOS suite runs one sleep-timer handoff on separate simulators against Docker-hosted local Supabase. Existing single-device Maestro flows cover general app smoke and regression scenarios.

## Two-caregiver sleep-timer suite

The scenario verifies this household contract:

1. The owner starts sleep.
2. The member sees the remote lock and cannot open the sleep timer.
3. The owner stops, and the member sees the card unlock.
4. The member starts sleep.
5. The owner sees the remote lock.
6. The member stops, and the owner sees the card unlock.
7. PostgreSQL contains one completion from each caregiver and no sleep lock.

Feeding, pumping, and tummy-time use the same lock and completion services. Their completion retry, restoration, stale-lock, and idempotency checks stay in component and real-provider integration tests instead of this device suite.

### Prerequisites

Run the suite on macOS with:

- Apple silicon
- Xcode and an iOS Simulator runtime
- Docker Desktop
- Node.js and npm
- Maestro CLI
- `jq`, `psql`, and CocoaPods

Install Maestro if needed:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version
```

Accept the Xcode license and finish its first-launch setup in Terminal:

```bash
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
xcodebuild -version
xcrun simctl list runtimes
```

Docker Desktop must be running:

```bash
docker info
```

### Clean provisioning

Run this command once from the repository root to provision the local database, app, and simulators:

```bash
npm run e2e:household-timers:clean
```

The clean command:

1. Installs locked npm dependencies.
2. Starts local Supabase, resets its database, and applies the migration chain.
3. Creates two authenticated caregivers in one household with two babies.
4. Creates or selects `SofiBaby Owner` and `SofiBaby Member` simulators.
5. Generates the iOS project and builds the active arm64 simulator architecture once.
6. Installs the app on both simulators and runs the sleep handoff.
7. Saves diagnostics, removes the fixture accounts, shuts down both simulators, and retains the installed E2E app for fast runs.

The database reset deletes all data in this project's local Supabase instance. The command rejects Supabase API and PostgreSQL URLs unless they use `localhost`, `127.0.0.1`, or `::1`.

### Fast behavioral runs

After a clean build has produced an E2E app and the local fixtures have been reseeded, run:

```bash
npm run e2e:seed
npm run e2e:household-timers
```

The fast command reinstalls a copy of the `SofiBaby Owner` app on both named simulators, which clears app state. It resets only the primary baby's sleep rows and lock, then restarts this project's Metro process with a cleared cache. It does not install dependencies, run migrations, generate native projects, install Pods, or compile with Xcode. The app stays installed on both simulators, and the fixtures remain available for another run.

A measured fast run on 2026-07-21 took 3 minutes 4 seconds with Xcode 26.6 and the iOS 26.5 runtime. Local Supabase was warm. The E2E app was installed on both named simulators, which were already booted.

### Local E2E bundle boundary

The runner reads the API URL and keys from `supabase status`; it does not read or change `.env`. `SOFIBABY_E2E_LOCAL_ENV=1` enables a Babel transform that compiles those local values and a zero-second sleep minimum into the generated E2E bundle. The test-login launch argument also exposes a sleep-sheet close control so Maestro does not depend on simulator swipe recognition. Without that argument, the native sheet is unchanged. Production builds retain the 60-second minimum.

Clean provisioning temporarily removes an invalid `react-native-date-picker` codegen provider from its installed package metadata. Cleanup restores the original file after Xcode finishes.

### Failure diagnostics and cleanup

A failed command exits nonzero. Artifacts are written under:

```text
e2e/artifacts/household-timers/<timestamp>/
```

The directory includes command output, Metro logs, Maestro results, screenshots, simulator logs, sleep and lock rows, local Supabase API logs, and cleanup results. Maestro driver startup is capped at 120 seconds, with a four-minute limit per flow. Process cleanup also uses bounded timeouts.

Cleanup checks whether the local Supabase API container is paused and unpauses it before returning. The clean command also verifies that fixture users, babies, and households were removed.

## Fixture commands

The fixture scripts require a running, migrated local Supabase instance:

```bash
npm run e2e:seed
npm run e2e:cleanup
```

`e2e:seed` is idempotent. It recreates the users and assigns the owner and member to one household. The script then seeds two babies and verifies the rows. `e2e:cleanup` removes the fixture auth users, profiles, babies, activity data, locks, and households.

Run orchestration tests without Xcode or Maestro:

```bash
npm run e2e:household-timers:test
```

## Existing single-device suites

The existing Maestro suites expect a built app and local fixtures:

```bash
npx supabase start
npx supabase db reset --no-seed
node scripts/apply-migrations.mjs
npm run e2e:seed

npm run e2e:smoke
npm run e2e:regression
```

Run one flow with:

```bash
npm run e2e:flow e2e/flows/onboarding/guest-flow.yaml
```

Remove fixtures when finished:

```bash
npm run e2e:cleanup
```
