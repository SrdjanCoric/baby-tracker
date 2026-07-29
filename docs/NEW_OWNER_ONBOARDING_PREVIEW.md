# Development onboarding tools

Use one of three modes depending on what you need to test.

## Isolated preview

Open Settings in a development build, then choose **Developer Tools > Preview onboarding**. Select Start tracking, Join a family, or Returning user, followed by the UI state you want to inspect. The preview uses fixed sample data and does not call authentication, Supabase, baby storage, activity storage, preferences, or onboarding storage. Exit closes the preview and returns to Settings without changing the app route.

Use this mode for layout, copy, loading, recoverable-error, cancellation, skip, and completion checks. It cannot prove that providers, persistence, authentication, or Supabase work together.

## Real routing replay

Choose **Developer Tools > Run first-launch routing again** to test the upcoming role-based guard against the account and household already loaded in the development app. The warning must be confirmed before the tool clears these onboarding records:

- `@onboarding_status`
- `@onboarding_current_step`
- `@new_owner_onboarding_v2`

The tool preserves authentication, household membership, babies, activities, language, units, time format, theme, and other preferences. A signed-in account enters returning-user restoration; a signed-out app opens the role-based Welcome screen. Work completed after replay uses the real onboarding stores and services, so this mode can create a baby, redeem an invitation, or change onboarding completion.

Choose **Clear unfinished onboarding draft** when you need to remove only a resumable `@new_owner_onboarding_v2` state. Completed and returning-restored states are preserved, along with legacy completion and every non-onboarding record.

## Fresh-state Maestro integration tests

Maestro flows clear the app sandbox and use disposable local Supabase fixtures. Use them to prove restart recovery and integration across real providers, persistence, authentication, and the local database. Do not point these commands at shared or production Supabase.

The owner restart flow checks draft recovery after a language change:

```bash
maestro test e2e/flows/onboarding/new-owner-preview-restart.yaml
```

The caregiver flow creates a local invitation, checks auth cancellation and restart recovery, redeems the invitation, then loads the shared baby:

```bash
npm run test:sql:setup
npm run e2e:prepare-caregiver-join
maestro test e2e/flows/onboarding/caregiver-code-join.yaml
```

The returning-user flow uses a seeded local account and restores its household and selected baby:

```bash
npm run test:sql:setup
npm run e2e:create-users
npm run e2e:seed
maestro test e2e/flows/onboarding/returning-user-restoration.yaml
```

The existing Maestro flows still enable the role-based guard with the development launch argument. To launch the same real flow without Maestro, boot an iOS simulator and run:

```bash
xcrun simctl launch booted com.sofibaby.app -onboardingPreview true
```

This launch-argument mode uses real storage and services. Clear the simulator app state before using it when a completed onboarding record should not be reused.

## Persisted state

AsyncStorage key `@new_owner_onboarding_v2` contains a discriminated version 2 state. The `screen` field is one of:

- `welcome`, with language, no entry path, and an empty baby draft
- `account-choice`, before any baby is created
- `auth-pending`, with either sign-in or account-creation intent from the owner path
- `returning-auth`, after Sign in is selected on Welcome and while authentication is unfinished
- `returning-restoring`, while profile, household, babies, and selected-baby data are refreshed
- `returning-verified-empty`, after every remote refresh succeeds and confirms that the household has no babies
- `returning-unavailable`, when authentication, profile, household, baby, or selection data cannot be refreshed
- `returning-restored`, with the restored household and selected baby IDs
- `returning-signed-out`, after leaving a failed restoration
- `join-code`, with the manually entered caregiver code
- `join-auth-pending`, with the normalized code while authentication is unfinished
- `join-confirmation`, after authentication and display-name completion
- `joining`, while the explicit redemption request is running
- `join-refresh`, after redemption while profile, household, baby, and selection data load
- `join-failure`, with a confirmation, reconciliation, or refresh-only retry
- `owner-baby`, with guest or authenticated account mode and a partial baby profile
- `invitation`, with pending or ready invitation state
- `first-activity`, with the created baby ID and a pending first activity
- `activity-saved`, with the baby ID and saved activity type
- `completed`, with an owner, existing-account, or legacy result

Draft writes are serialized so the latest profile values win. Start over removes this key. Restarting authenticated baby setup also signs out so a later guest choice cannot write into the account.

A caregiver code is normalized and saved when Continue is pressed. Authentication cancellation and app restart keep it. The app doesn't redeem the code until the authenticated caregiver presses Join family. If a transport failure leaves the redemption outcome unknown, retry first refreshes the profile. It resumes at `join-refresh` when household membership changed and returns to confirmation only when the caregiver remains in the source household. If redemption succeeds but a later refresh fails, retry resumes at `join-refresh` and doesn't submit the consumed invitation again. Completion removes the plaintext code from persisted onboarding state.

## Returning-user restoration

Sign in from Welcome records a returning-user intent before opening authentication. After authentication, the app stays in restoration until it refreshes the profile, household, babies, and selected-baby storage in that order. A persisted selection is kept when it belongs to the restored household. Otherwise, the first restored baby is selected and saved before Home opens.

An empty baby list is trusted only after the profile, household, and baby requests all succeed. That verified result offers Add a baby and Join a family. A failed or ambiguous request becomes `returning-unavailable`, which offers only Retry and Sign out. Retry starts a new numbered attempt, and stale attempt completions cannot mark restoration complete. Sign out keeps local account data when the remote sign-out request fails.

Restarting during returning authentication resumes the sign-in screen. Restarting with a blocked sync identity uses a restricted profile fallback instead of mounting activity providers without a household. Persisted empty and restored results are revalidated before the provider tree opens.

## Local authentication accounts

Start and reset local Supabase, then create the development accounts:

```bash
npm run test:sql:setup
npm run e2e:create-users
```

The account names are in `e2e/config/maestro.yaml`. `e2e-owner@test.local` and `e2e-member@test.local` are useful for returning-account checks. Reset the local database before testing a no-baby account. These accounts are local fixtures and must not be used against a shared or production Supabase project.

## Production isolation

The Settings section and its preview component return no UI when `__DEV__` is false. There is no developer-tools route in the Expo Router tree. The role-based guard requires a development build plus either the launch argument or the in-memory replay request, so restarting the app clears replay mode. Production builds ignore both paths and keep the existing onboarding guard until the production cutover.

The isolated preview adapters do not import real onboarding providers, and opening the preview does not invoke the storage actions owned by the surrounding developer-tools component. The launch-argument and replay modes use persisted state and can restore account choice, pending authentication, returning-user restoration, caregiver join, baby setup, invitation, or first-activity routing. Returning accounts open Home only after the profile, household, babies, and selected baby are available. Joined caregivers open Home only after the shared household has a loaded and selected baby.

## Validation

Run the focused checks from the repository root:

```bash
npm run test:unit -- src/services/development-onboarding-preview.test.ts src/services/development-onboarding-tools.test.ts src/services/onboarding-storage.test.ts src/services/new-owner-onboarding-storage.test.ts src/services/new-owner-auth-resume.test.ts src/services/new-owner-onboarding-routing.test.ts src/services/returning-user-restoration.test.ts src/services/guest-account-migration.test.ts src/services/baby-sync-service.test.ts src/services/activity-sync-lossless.test.ts src/utils/development-onboarding.test.ts src/i18n/new-owner-onboarding-locales.test.ts src/__tests__/security/auth-callback-logging.security.test.ts src/__tests__/security/caregiver-onboarding-security.test.ts
npm run test:component -- --runInBand src/components/settings/DevelopmentOnboardingTools.component.test.tsx app/onboarding/owner app/auth/sign-in.component.test.tsx src/components/ReturningUserProfileFallback.component.test.tsx src/contexts/auth-context.component.test.tsx src/__tests__/returning-user-restoration.integration.test.tsx src/__tests__/sync-auth-setup.integration.test.tsx src/__tests__/activity-provider-baby-binding.integration.test.tsx app/feeding/index.component.test.tsx
npm run test:sql:setup
npm run test:sql
npm run lint
npm run typecheck
```

Run the canonical non-device gate before opening a pull request:

```bash
npm run check:code
```
