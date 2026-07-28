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

Clear the app's local data first when a legacy onboarding record is already complete. The version 2 reader treats legacy completed and skipped records as complete.

## Persisted state

AsyncStorage key `@new_owner_onboarding_v2` contains a discriminated version 2 state. The `screen` field is one of:

- `welcome`, with language, no entry path, and an empty baby draft
- `owner-baby`, with the owner path and partial baby profile
- `first-activity`, with the created baby ID and a pending first activity
- `activity-saved`, with the baby ID and saved activity type
- `completed`, with an owner result or a legacy-completed marker

Draft writes are serialized so the latest profile values win. Start over removes this key only and leaves other app data unchanged.

## Production isolation

`isNewOwnerOnboardingPreviewEnabled()` requires both `__DEV__` and the launch argument. `AuthGuard` keeps the existing production routing when that check is false. During a preview, the guard allows normal activity routes only while the persisted state is `first-activity`.

## Validation

Run the focused checks from the repository root:

```bash
npm run test:unit -- src/services/new-owner-onboarding-storage.test.ts src/utils/development-onboarding.test.ts src/i18n/new-owner-onboarding-locales.test.ts
npm run test:component -- --runInBand app/onboarding/owner src/__tests__/activity-provider-baby-binding.integration.test.tsx app/feeding/index.component.test.tsx
npm run lint
npm run typecheck
```

Run the canonical non-device gate before opening a pull request:

```bash
npm run check:code
```
