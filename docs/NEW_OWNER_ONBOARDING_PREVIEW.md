# New owner onboarding preview

The replacement owner and invited-caregiver flows are available only in development builds with the `onboardingPreview=true` launch argument. Production builds ignore the argument and redirect `/onboarding/owner` to the existing onboarding or Home.

## Open the preview

The owner flow checks draft recovery after a language change and restart:

```bash
maestro test e2e/flows/onboarding/new-owner-preview-restart.yaml
```

The caregiver flow needs a disposable local invitation fixture. It checks code entry before authentication, auth cancellation, restart recovery, explicit redemption, and loading the shared baby before Home:

```bash
npm run test:sql:setup
npm run e2e:prepare-caregiver-join
maestro test e2e/flows/onboarding/caregiver-code-join.yaml
```

The returning-user flow signs in with a seeded account, restarts while authentication is pending, restores the household and selected baby, and opens Home without owner setup:

```bash
npm run test:sql:setup
npm run e2e:create-users
npm run e2e:seed
maestro test e2e/flows/onboarding/returning-user-restoration.yaml
```

To open the installed iOS development build without Maestro, boot a simulator and run:

```bash
xcrun simctl launch booted com.sofibaby.app -onboardingPreview true
```

Clear the app's local data first when a legacy onboarding record is already complete. The version 2 reader upgrades legacy drafts to account choice and treats legacy completed or skipped records as complete.

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

`isNewOwnerOnboardingPreviewEnabled()` requires both `__DEV__` and the launch argument. `AuthGuard` keeps the existing production routing when that check is false. During a preview, the guard restores account choice, pending authentication, returning-user restoration, caregiver join, baby setup, invitation, or first-activity routing from persisted state. Returning accounts open Home only after the profile, household, babies, and selected baby are available. Joined caregivers open Home only after the shared household has at least one loaded and selected baby.

## Validation

Run the focused checks from the repository root:

```bash
npm run test:unit -- src/services/new-owner-onboarding-storage.test.ts src/services/new-owner-auth-resume.test.ts src/services/new-owner-onboarding-routing.test.ts src/services/returning-user-restoration.test.ts src/services/guest-account-migration.test.ts src/services/baby-sync-service.test.ts src/services/activity-sync-lossless.test.ts src/utils/development-onboarding.test.ts src/i18n/new-owner-onboarding-locales.test.ts src/__tests__/security/auth-callback-logging.security.test.ts src/__tests__/security/caregiver-onboarding-security.test.ts
npm run test:component -- --runInBand app/onboarding/owner app/auth/sign-in.component.test.tsx src/components/ReturningUserProfileFallback.component.test.tsx src/contexts/auth-context.component.test.tsx src/__tests__/returning-user-restoration.integration.test.tsx src/__tests__/sync-auth-setup.integration.test.tsx src/__tests__/activity-provider-baby-binding.integration.test.tsx app/feeding/index.component.test.tsx
npm run test:sql:setup
npm run test:sql
npm run lint
npm run typecheck
```

Run the canonical non-device gate before opening a pull request:

```bash
npm run check:code
```
