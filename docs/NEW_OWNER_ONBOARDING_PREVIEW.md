# New owner onboarding preview

The replacement owner flow is available only in development builds with the `onboardingPreview=true` launch argument. Production builds ignore the argument and redirect `/onboarding/owner` to the existing onboarding or Home.

## Open the preview

The development Maestro flow checks draft recovery after a language change and restart:

```bash
maestro test e2e/flows/onboarding/new-owner-preview-restart.yaml
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
- `auth-pending`, with either sign-in or account-creation intent
- `owner-baby`, with guest or authenticated account mode and a partial baby profile
- `invitation`, with pending or ready invitation state
- `first-activity`, with the created baby ID and a pending first activity
- `activity-saved`, with the baby ID and saved activity type
- `completed`, with an owner, existing-account, or legacy result

Draft writes are serialized so the latest profile values win. Start over removes this key. Restarting authenticated baby setup also signs out so a later guest choice cannot write into the account.

## Local authentication accounts

Start and reset local Supabase, then create the development accounts:

```bash
npm run test:sql:setup
npm run e2e:create-users
```

The account names are in `e2e/config/maestro.yaml`. `e2e-owner@test.local` and `e2e-member@test.local` are useful for returning-account checks. Reset the local database before testing a no-baby account. These accounts are local fixtures and must not be used against a shared or production Supabase project.

## Production isolation

`isNewOwnerOnboardingPreviewEnabled()` requires both `__DEV__` and the launch argument. `AuthGuard` keeps the existing production routing when that check is false. During a preview, the guard restores account choice, pending authentication, baby setup, invitation, or first-activity routing from persisted state. Authenticated accounts that already contain a baby complete the preview and open the app.

## Validation

Run the focused checks from the repository root:

```bash
npm run test:unit -- src/services/new-owner-onboarding-storage.test.ts src/services/new-owner-auth-resume.test.ts src/services/guest-account-migration.test.ts src/services/baby-sync-service.test.ts src/services/activity-sync-lossless.test.ts src/utils/development-onboarding.test.ts src/i18n/new-owner-onboarding-locales.test.ts src/__tests__/security/auth-callback-logging.security.test.ts
npm run test:component -- --runInBand app/onboarding/owner app/auth/sign-in.component.test.tsx src/contexts/auth-context.component.test.tsx src/__tests__/activity-provider-baby-binding.integration.test.tsx app/feeding/index.component.test.tsx
npm run lint
npm run typecheck
```

Run the canonical non-device gate before opening a pull request:

```bash
npm run check:code
```
