# Sofi: Baby Tracker

Sofi tracks baby care on iOS and Android with offline support, multi-caregiver sync, iOS widgets, an Apple Watch app, and Live Activities.

Free, with no ads or subscriptions.

<p>
  <a href="https://apps.apple.com/it/app/sofi-baby-tracker/id6758142736">
    <img src="https://img.shields.io/badge/App_Store-0D96F6?style=for-the-badge&logo=app-store&logoColor=white" alt="App Store" />
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.sofibaby.app&hl=en">
    <img src="https://img.shields.io/badge/Google_Play-414141?style=for-the-badge&logo=google-play&logoColor=white" alt="Google Play" />
  </a>
</p>

<p align="center">
  <img src="assets/images/screenshots/6.9_03.jpg" width="180" alt="Dashboard" />
  <img src="assets/images/screenshots/6.9_01.jpg" width="180" alt="Sleep Prediction" />
  <img src="assets/images/screenshots/6.9_05.jpg" width="180" alt="Statistics" />
  <img src="assets/images/screenshots/6.9_06.jpg" width="180" alt="Feeding" />
  <img src="assets/images/screenshots/6.9_07.jpg" width="180" alt="Multi-caregiver Sync" />
</p>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native, Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| Navigation | Expo Router v6 (file-based) |
| State | React Context + Reducers |
| i18n | i18next (7 languages) |
| Testing | Vitest (unit), Jest (component), Maestro (E2E) |

## Architecture

### Offline-First Sync Engine

All writes go to local storage first and are immediately reflected in the UI. A persistent sync queue handles server delivery with retry logic and exponential backoff. On foreground resume, the queue flushes before pulling server state to avoid overwriting optimistic updates.

Startup pulls read at most 1,000 recent rows per activity table. Timeline, Statistics, and Sleep Patterns request the ranges shown by their active controls, then follow a timestamp-and-ID cursor until each interval is complete. Growth and health request full history only when their Statistics category opens. Startup and on-demand reads reconcile under a per-user, per-baby storage lock, where pending mutations are re-read before the local collection is written. Cached statistics stay visible during a range read. An unverified empty period shows loading, and a failed read offers retry. See [`docs/ACTIVITY_HISTORY.md`](docs/ACTIVITY_HISTORY.md) for range coverage and reconciliation details.

```
User action → Local storage → UI update (immediate)
                ↓
           Sync queue → Supabase (async, retries on failure)
                ↓
           Realtime subscription → Other household devices
```

### Real-Time Multi-Caregiver Sync

Supabase Realtime subscriptions push changes between household members instantly. Remote changes dispatch into React context reducers (`REMOTE_INSERT`, `REMOTE_UPDATE`, `REMOTE_DELETE`). Insert acknowledgements upsert by entity ID, so a server event and its matching local create result produce one activity regardless of arrival order. Device ID filtering prevents echo updates.

A milestone response keeps one database identity as its state changes or clears. Clearing stores a hidden CRDT tombstone, and rechecking revives the same row with a newer clock. Pull and Realtime recovery map an older queued UUID back to the canonical row without showing tombstones in milestone state or progress.

### Caregiver Invitations

Household owners enter a caregiver's account email in Settings, then copy or share the generated code. Each invitation expires after seven days and works once. During onboarding, recipients enter the code before authentication; cancellation and restart preserve it. The matching verified account must explicitly submit the code after signing in. Joining from a solo account warns before deleting its current baby and activity data, and Home opens only after the shared baby is loaded. Owners can keep invitations pending for different email addresses and can replace or revoke each code. Existing memberships stay unchanged, and older recipient app versions can redeem newly issued codes. See [`docs/CAREGIVER_INVITATIONS.md`](docs/CAREGIVER_INVITATIONS.md) for the security model and rollout checks.

### Role-based onboarding

New installations open Welcome with immediate language selection and three routes: Start tracking, Join a family, and Sign in. New owners choose guest or authenticated tracking and create a baby before Home becomes available. Authenticated owners may invite a caregiver. After baby creation, owners may record a first activity or skip the remaining setup. Invited caregivers keep their code through authentication, while returning caregivers restore their household and selected baby before entering Home. Completed and skipped records from the previous onboarding model migrate directly to completed state.

Development Settings includes an isolated preview for the three entry routes. It uses sample adapters for loading, recoverable errors, cancellation, skip, and completion without calling storage or services. A separate replay action clears only onboarding progress and runs the production guard against the current account. It preserves authentication, household membership, babies, activities, and preferences. Production builds exclude both tools. See [`docs/ROLE_BASED_ONBOARDING.md`](docs/ROLE_BASED_ONBOARDING.md) for persisted states, recovery rules, and development commands.

### Timer Exclusivity

Household-wide timer locks via Supabase RPC (`acquire_timer_lock`) prevent simultaneous timers per baby and activity type across all devices. Server controls verify the authenticated caregiver and baby household; only the caregiver who started a timer can pause, resume, or release it. If the lock service is unavailable, feeding, sleep, pumping, and tummy-time timers continue locally and keep their reconciliation state through restart. Reconnect attempts to acquire the missing lock. When two offline timers compete, the first successful lock acquisition wins. The other timer is saved to the timeline, and its caregiver sees what happened. Unregistered solo users keep timers on their device and do not use server locks. Timer starts reserve a stable completion ID, so repeated Stop actions return the first saved activity instead of creating another one. External Stop requests from widgets and Apple Watch stay in a versioned queue until matching timer completions are durable, even if several arrive while the app is closed. While a timer is being saved, the dashboard replaces its Stop and pause controls with a disabled "Stopping..." state. If the save fails, the controls return and the app shows an error. Failed lock cleanup retries against the original timer instance and cannot release a newer timer. Stale locks auto-expire after 12 hours.

### Sleep Predictions

Sleep predictions use the configured day start and recent sleep history to estimate the next nap or bedtime. Morning qualification starts 3 hours 3 minutes before day start. A completed overnight sleep that crosses this anchor establishes a provisional wake. Pre-day-start sleep continues the night automatically when its awake gap is within the configured sleep-continuation allowance, including a gap equal to the limit. The setting defaults to 25 minutes and also joins fragmented naps.

A longer gap prompts the caregiver to choose First nap or Back to sleep after tracking has started or the sleep has been saved. The question persists through restart and midnight without blocking timers or other activities. First nap keeps the provisional wake and stores the session as `nap`. Back to sleep stores it as `night`, moves morning wake to the session's end, and allows a later long gap to prompt again. Pending questions replace predictions and are excluded from model training and drift detection until resolved. A later Nap/Night edit corrects the confirmed role so timeline and statistics agree with predictions across caregiver devices. Sleep recorded before this classification state was introduced remains legacy data, receives no retroactive prompt, and keeps its prior morning behavior.

When the latest completed sleep is the current evening's stored `night` session, the dashboard stays in its Bedtime state until midnight instead of predicting bedtime again from that session's end. An earlier-day-start banner appears after at least five of the last seven recorded mornings end one hour early. Each qualifying morning's first nap must begin no more than 15 minutes before the baby's age-based first wake window. The banner suggests the median qualifying final wake, and the boundary changes only if the caregiver accepts. Logging past sleep warns when the proposed interval overlaps a completed session. Caregivers can cancel or keep both entries; prediction and statistics calculations count the overlap once without changing saved history. See [`docs/SLEEP_PREDICTIONS.md`](docs/SLEEP_PREDICTIONS.md) for the full rules.

### iOS Native Integrations

- **WidgetKit** home screen widgets with push-triggered timeline refresh via APNs
- **Live Activities + Dynamic Island** for active feeding and sleep timers
- **Apple Watch** companion app using WCSession with REST API fallback
- **Deep linking** (`sofibaby://`) for widget and notification actions

### Edge Functions

Deno-based serverless functions for direct APNs push delivery, feeding reminders, wake window alerts, and Live Activity management. All push notifications use direct APNs (not Expo Push API).

## Project Structure

```
app/                        # Expo Router screens (tabs, settings, activities)
src/
├── components/             # UI components, charts, stats cards
├── contexts/               # ~20 feature-scoped context providers + reducers
├── services/
│   ├── sync/               # Sync engine, Realtime, queue, CRDT merge
│   └── ...                 # Storage, notifications, watch, widget, household
├── hooks/                  # Timer alerts, duplicate detection, accessibility
├── i18n/                   # Nine locale files with regional variants
├── utils/                  # Growth helpers, temperature, retry logic
└── types/                  # TypeScript definitions
supabase/
├── functions/              # Edge Functions (Deno)
└── migrations/             # PostgreSQL migrations through 059
targets/widget/             # iOS WidgetKit extension (Swift)
e2e/                        # Maestro E2E tests
```

## Development

```bash
nvm use
npm ci
npm start
```

Required environment variables are listed in `.env.example` with safe placeholders.

```bash
# iOS (requires CocoaPods)
npx expo prebuild --platform ios --clean && npx expo run:ios

# Android
npx expo prebuild --platform android --clean && npx expo run:android
```

## Testing

```bash
npm run check                # Complete local non-device gate before production release
npm run check:code           # The same validation without local database checks
npm run audit:dependencies   # Fail on unapproved high or critical advisories
npm run test:unit            # 2,400+ Vitest unit tests
npm run test:component -- --runInBand # Jest component tests
npm run test:security        # Security tests
npm run test:sync            # Sync tests
npm run test:ci              # CI workflow and required-check contract tests
npm run test:production-gating # Verify developer tools are absent from production bundles
npm run test:sql:setup       # Reset local Supabase and apply all migrations
npm run test:sql             # PostgreSQL merge and authorization tests
npm run test:edge:timer      # Local timer RPC and Edge authorization flow
npm run typecheck            # TypeScript strict mode
npm run lint                 # ESLint (warnings fail the quality gate)
npm run e2e:household-timers       # Fast iOS offline reconnect and caregiver handoff
npm run e2e:household-timers:clean # Required local iOS device gate before release
npm run e2e:prepare-caregiver-join
npm run e2e:start-caregiver-join   # Start local-Supabase Metro for iOS
SOFIBABY_E2E_PLATFORM=android npm run e2e:start-caregiver-join # Android Metro
npm run e2e:onboarding:ios         # Resumable production onboarding suite
npm run e2e:onboarding:android     # Resumable production onboarding suite
```

`npm run check` requires Docker and `psql`. Its SQL stage resets the local database at `127.0.0.1:54322` and applies the committed migrations. It does not connect to a linked or production Supabase project. Run `test:sql:setup` before the SQL and timer Edge checks when using the focused commands.

Pull requests and pushes to `main` run only lint, strict type checking, and the dependency audit. Test suites stay out of the routine CI path and run locally through `npm run check` before a production release. The required dependency audit blocks unapproved high or critical advisories. Dependabot opens npm update pull requests each week. Configure `Non-device checks required` as the required branch-protection check. See [`docs/DEPENDENCY_SECURITY.md`](docs/DEPENDENCY_SECURITY.md) for advisory triage and temporary exception rules.

Run `npm run e2e:household-timers:clean` before each iOS release. GitHub Actions does not run iOS device tests because GitHub-hosted ARM64 macOS runners cannot run the Docker stack required by local Supabase.

The fast iOS command reuses the installed E2E app and local fixtures. The scenario stops local Supabase API access while the owner starts sleep. It restores the API, restarts each observing app before checking server state, and continues the two-caregiver handoff. The clean command resets local Supabase, builds the app for two named simulators, runs the same timer scenario, and opens the native day-start picker. It removes fixture accounts when finished. A build, fixture, assertion, Maestro, or cleanup failure exits nonzero and blocks the release. Both commands require Docker, Xcode, Maestro, and `psql`; clean provisioning also needs `jq` and CocoaPods. See [`e2e/README.md`](e2e/README.md) for setup and diagnostics, including the local-only safeguards.

## Releases

The **Build Store Release** workflow accepts `v*` tags and manual runs. Run and record the complete local non-device gate first; the workflow validates the version but does not rerun tests. The build uses that commit and never submits to an app store.

The **Submit Store Release** workflow runs manually from `main`. It takes a successful build workflow run ID and requires production database confirmation. An iOS submission also requires the clean local E2E result or artifact path. The workflow downloads the recorded build IDs and submits them without rebuilding or selecting the latest EAS build.

Release credentials are stored in the `production-release` GitHub environment, which allows only `main` and `v*`. See [`docs/RELEASE.md`](docs/RELEASE.md) for the checklist and recovery procedures.

## License

MIT
