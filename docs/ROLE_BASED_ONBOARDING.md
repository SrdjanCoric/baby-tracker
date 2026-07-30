# Role-based onboarding

Production onboarding starts at `/onboarding/owner`. The `/onboarding` route redirects there for compatibility.

Welcome applies language changes immediately and offers three paths:

- **Start tracking** creates a complete baby profile before Home can open. The owner may use the app as a guest or authenticate first. Authenticated owners may invite a caregiver.
- **Join a family** keeps the manually entered invitation code through authentication, asks for confirmation, then loads and selects a baby from the joined household.
- **Sign in** restores the profile, household, babies, and selected baby before Home opens.

A new owner may skip caregiver invitation and the first activity after creating a baby. Joined and returning caregivers do not see the first-activity prompt.

## Persisted state

AsyncStorage key `@new_owner_onboarding_v2` contains a discriminated version 2 state. The `screen` field records the current boundary:

- `welcome`, `account-choice`, `auth-pending`, or `owner-baby` for owner setup
- `invitation`, `first-activity`, or `activity-saved` after baby creation
- `join-code`, `join-auth-pending`, `join-confirmation`, `joining`, `join-refresh`, or `join-failure` for caregivers
- `returning-auth`, `returning-restoring`, `returning-verified-empty`, `returning-unavailable`, `returning-restored`, or `returning-signed-out` for returning accounts
- `completed` for owner, caregiver, authenticated-existing, or legacy completion

Draft writes are serialized. Terminal owner and caregiver states contain a baby ID. Returning completion contains the restored household and baby IDs.

Older releases stored completion in `@onboarding_status`. The first version 2 load imports a legacy completed or skipped record into a terminal `completed` state. Production code does not write the legacy key or read the old numeric-step key.

## Failure and restart policy

Owner profile drafts, authentication intent, invitation codes, join progress, and restoration attempts survive an app restart. Authentication cancellation returns to the state that opened authentication.

Caregiver redemption happens only after explicit confirmation. When a solo household has baby data, the app warns that joining will delete that local household data. A transport failure with an unknown redemption result first reconciles the current profile. A successful redemption followed by a refresh failure resumes from `join-refresh` without submitting the consumed invitation again.

Returning restoration refreshes profile, household, babies, and selected-baby storage in that order. A verified empty household offers Add a baby and Join a family. An unavailable result offers Retry and Sign out. Stale restoration attempts cannot complete a newer attempt.

## Development tools

Development builds expose three Settings tools:

- **Preview onboarding** renders isolated sample states without calling storage, authentication, or Supabase.
- **Run first-launch routing again** clears versioned onboarding state and legacy completion, then opens production routing with the current authentication state. Account, household, babies, activities, and preferences remain intact.

**Clear unfinished onboarding draft** removes only a nonterminal version 2 draft.

The Settings tools are excluded from production bundles. Production routing does not depend on a launch argument or remote flag.

## Automated checks

Run focused checks from the repository root:

```bash
npm run test:unit -- src/services/onboarding-guard.test.ts src/services/new-owner-onboarding-storage.test.ts src/services/new-owner-auth-resume.test.ts src/services/new-owner-onboarding-routing.test.ts src/services/returning-user-restoration.test.ts src/services/development-onboarding-tools.test.ts src/i18n/new-owner-onboarding-locales.test.ts src/__tests__/security/caregiver-onboarding-security.test.ts
npm run test:component -- --runInBand app/onboarding/owner app/auth/sign-in.component.test.tsx src/components/ReturningUserProfileFallback.component.test.tsx src/__tests__/returning-user-restoration.integration.test.tsx src/__tests__/activity-provider-baby-binding.integration.test.tsx app/feeding/index.component.test.tsx
npm run test:production-gating
```

Production-route Maestro suites are shared by both platforms. Run them through the resumable runner:

```bash
npm run e2e:onboarding:ios -- --reset
npm run e2e:onboarding:android -- --reset
```

The authenticated flows require disposable local Supabase fixtures. Prepare them with the commands in [`e2e/README.md`](../e2e/README.md). The manual-code flow also requires `npm run e2e:prepare-caregiver-join`.

`npm run e2e:onboarding-network` is the authoritative transport-recovery scenario. It reaches destructive join confirmation, stops the local Supabase API, submits while offline, restarts the app without clearing state, restores the API, presses the persisted Retry action, and completes the confirmed join. The command then checks the local database for one consumed invitation, the caregiver's single target-household assignment, the two shared babies, deletion of the confirmed solo data, and preservation of unrelated fixtures. It refuses non-loopback Supabase endpoints and restores the API after success, failure, or cancellation. Use `MAESTRO_DEVICE=<device-id>` for either platform; Android also requires Metro to have been started with `SOFIBABY_E2E_PLATFORM=android` as described in [`e2e/README.md`](../e2e/README.md).

## Visual review matrix

Review the production routes after the automated suites pass. Use one small and one large device on each platform, switch between light and dark mode, enable a large accessibility text size, and repeat the route inventory in every supported locale: `en`, `sr`, `es`, `es-ES`, `fr`, `pt-PT`, `pt-BR`, `de`, and `it`.

| Route or state | What to exercise |
| --- | --- |
| Welcome | Open and close the language list, select each locale, and reach all three actions. |
| Account | Reach Sign in, Create account, and Continue on this device. |
| Baby profile | Focus the name field, dismiss the keyboard from the header, open and close the date picker, trigger all required errors, select each gender, and reach Continue and Start over. Confirm that the controls match Add/Edit baby and that no photo control appears. |
| Invitation | Review the email form, loading, error, restored invitation, and ready-to-share states. |
| First activity and saved | Expand the activity list, reach every activity, skip setup, and review both saved-state actions. |
| Join family | Review code entry, confirmation, destructive-data warning, joining, refresh, and each recoverable failure state. |
| Returning account | Review loading, verified-empty, unavailable, retry, and sign-out states. |

For every row, scroll from the first heading to the last action with the keyboard both closed and open where a field exists. Text may wrap and controls may grow vertically. Fail the review for clipped or overlapping text, untranslated copy, low contrast, misaligned controls, an unreachable action, a missing accessibility state, or a changed route transition.
