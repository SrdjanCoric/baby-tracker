# End-to-end tests

The maintained two-caregiver iOS suite starts a sleep timer without local Supabase API access. After restarting both apps, it reconnects the timer, runs the household handoff on separate simulators, and opens the native iOS time picker. Existing single-device Maestro flows cover general app smoke and regression scenarios.

Run `npm run e2e:household-timers:clean` locally before each iOS release. GitHub-hosted ARM64 macOS runners cannot run the Docker stack required by local Supabase, so GitHub Actions does not run this suite.

## Two-caregiver sleep-timer suite

The scenario verifies this household contract:

1. The runner stops the local Supabase API container.
2. The owner starts sleep without creating a server lock.
3. The runner starts the API container and restarts the owner's app.
4. The owner keeps the same timer, which acquires the household lock.
5. The runner restarts the member's app. The member sees the server lock and cannot open the sleep timer.
6. The owner stops. After another member restart, the sleep card is unlocked.
7. The member starts sleep. After an owner restart, the owner sees the server lock.
8. The member stops. After another owner restart, the sleep card is unlocked.
9. PostgreSQL contains one completion from each caregiver and no sleep lock.
10. The owner opens and closes the native iOS day-start picker.

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

### Pre-release clean gate

Run this command from the repository root before each iOS release:

```bash
npm run e2e:household-timers:clean
```

The clean command:

1. Installs locked npm dependencies.
2. Starts local Supabase, resets its database, and applies the migration chain.
3. Creates two authenticated caregivers in one household with two babies.
4. Creates or selects `SofiBaby Owner` and `SofiBaby Member` simulators.
5. Generates the iOS project and builds the active arm64 simulator architecture once.
6. Installs the app on both simulators and runs the offline reconnect and sleep handoff.
7. Saves diagnostics, removes the fixture accounts, shuts down both simulators, and retains the installed E2E app for fast runs.

The database reset deletes all data in this project's local Supabase instance. The command rejects Supabase API and PostgreSQL URLs unless they use `localhost`, `127.0.0.1`, or `::1`. A provisioning, fixture, assertion, Maestro, or cleanup failure exits nonzero and blocks the release.

### Fast behavioral runs

After a clean build has produced an E2E app and the local fixtures have been reseeded, run:

```bash
npm run e2e:seed
npm run e2e:household-timers
```

The fast command reinstalls a copy of the `SofiBaby Owner` app on both named simulators, which clears app state. It resets only the primary baby's sleep rows and lock, then restarts this project's Metro process with a cleared cache. During the scenario it stops only the `supabase_kong_baby-tracker` API container; PostgreSQL remains available for assertions. It does not install dependencies, run migrations, generate native projects, install Pods, or compile with Xcode. The app stays installed on both simulators, and the fixtures remain available for another run.

A measured fast run on 2026-07-22 took 4 minutes 3 seconds with Xcode 26.6 and the iOS 26.5 runtime. Local Supabase was warm, and both named simulators were already booted.

### Local E2E bundle boundary

The runner reads the API URL and keys from `supabase status`; it does not read or change `.env`. `SOFIBABY_E2E_LOCAL_ENV=1` enables a Babel transform that compiles those local values and a zero-second sleep minimum into the generated E2E bundle. The test-login launch argument also exposes a sleep-sheet close control so Maestro does not depend on simulator swipe recognition. Without that argument, the native sheet is unchanged. Production builds retain the 60-second minimum.

`npm ci` applies the repository-maintained `react-native-date-picker` codegen patch before prebuild. If `ios/build/generated/ios/RCTModuleProviders.mm` maps `RNDatePicker` to `RNDatePickerManager`, rerun `npm ci` and `node --test scripts/date-picker-codegen.test.mjs` before rebuilding. Do not edit generated Pods or installed package metadata by hand.

### Failure diagnostics and cleanup

A failed command exits nonzero. Artifacts are written under:

```text
e2e/artifacts/household-timers/<timestamp>/
```

The directory includes command output, Metro logs, Maestro results, screenshots, simulator logs, sleep and lock rows, local Supabase API logs, and cleanup results. Maestro driver startup is capped at 120 seconds, with a four-minute limit per flow. Process cleanup also uses bounded timeouts.

Cleanup starts the local Supabase API container if the scenario stopped it, or unpauses it when needed. The clean command also verifies that fixture users, babies, and households were removed.

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

## Onboarding testing modes

Use the Settings preview in a development build for UI checks that must leave storage and services untouched. Use **Run first-launch routing again** when you want the role-based guard to inspect the current development account while preserving its household, babies, activities, and preferences. Both tools are unavailable in production.

Use Maestro when the test needs real providers, restart recovery, authentication, or database behavior. Onboarding Maestro flows clear simulator state and may reset or change disposable local Supabase fixtures. They are not safe for a shared or production project. See [`docs/ROLE_BASED_ONBOARDING.md`](../docs/ROLE_BASED_ONBOARDING.md) for persisted states, failure policy, development tools, and focused commands.

## Existing single-device suites

The single-device suites expect a built app and local fixtures:

```bash
npx supabase start
npx supabase db reset --no-seed
node scripts/apply-migrations.mjs
npm run e2e:seed
npm run e2e:prepare-caregiver-join

# Start one of these in a separate terminal
npm run e2e:start-caregiver-join
SOFIBABY_E2E_PLATFORM=android npm run e2e:start-caregiver-join

npm run e2e:smoke
npm run e2e:regression
npm run e2e:onboarding:ios
npm run e2e:onboarding:android
npm run e2e:onboarding-network
```

The onboarding commands run each flow separately. A successful flow is recorded in
`e2e/artifacts/onboarding-<platform>.passed`, and the selected device is saved in
`e2e/artifacts/onboarding-<platform>.env`. Both files are local and ignored by Git. The runner also
force-stops the app before each flow, which avoids simulator clear-state failures between scenarios.
If a flow fails, fix it and run the same command again. Earlier passes are skipped.

Run or rerun one onboarding flow while debugging. `--only` ignores an existing checkpoint for that
flow:

```bash
npm run e2e:onboarding:ios -- --only fresh-owner
```

Start a new verification cycle after broad onboarding changes or a local database reset:

```bash
npm run e2e:onboarding:ios -- --reset
```

A flow can change a fixture account before its final assertion. If that happens, reseed or restore
that fixture before rerunning the failed flow. Do not add a flow to the checkpoint file by hand.

Set `MAESTRO_DEVICE` to override the saved device. The runner otherwise reuses its saved device or
the first booted device for that platform.

After the suites pass, complete the cross-device onboarding review in [`docs/ROLE_BASED_ONBOARDING.md`](../docs/ROLE_BASED_ONBOARDING.md#visual-review-matrix). The matrix covers every production route and state across device sizes, themes, large text, keyboards, and all supported locales. Record the devices and OS versions used with the task or release evidence.

Set `MAESTRO_DEVICE` before `npm run e2e:onboarding-network` to target a named simulator or emulator. The command refuses non-local Supabase endpoints, stops only the local API container, restores it on exit, and verifies join recovery after the API returns.

Run another standalone flow with:

```bash
npm run e2e:flow e2e/flows/onboarding/fresh-owner.yaml
```

Remove fixtures when finished:

```bash
npm run e2e:cleanup
```
