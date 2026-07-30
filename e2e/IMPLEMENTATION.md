# End-to-end test map

Maestro flows run against the installed iOS or Android app. Authenticated scenarios use local Supabase fixtures. Do not run fixture scripts against a shared or production project.

## Onboarding coverage

The production onboarding flows are under `e2e/flows/onboarding/`:

| Flow | Behavior |
|------|----------|
| `welcome.yaml` | Welcome actions and language control |
| `fresh-owner.yaml` | Guest owner, complete baby profile, and post-baby skip |
| `owner-invitation.yaml` | Authenticated owner and optional caregiver invitation |
| `manual-code-join.yaml` | Email-bound code redemption and destructive confirmation |
| `returning-user-restoration.yaml` | Account, household, baby, and selection restoration |
| `owner-restart.yaml` | Resumable owner draft after app restart |
| `auth-cancellation.yaml` | Authentication cancellation returns to Welcome |
| `join-failure-recovery.yaml` | Invalid invitation failure and retry |
| `locales.yaml` | Immediate switching across all supported locales |
| `legacy-upgrade.yaml` | Completed-only and skipped-only legacy migration |

`e2e/suites/onboarding-ios.yaml` and `e2e/suites/onboarding-android.yaml` run the same production-route matrix on each platform. The flows do not use an onboarding feature flag or preview launch argument.

The owner-invitation flow uses the empty `e2e-new-owner@test.local` account. The manual-code flow uses `e2e-test@test.local` and expects the invitation and solo-household baby created by:

```bash
npm run test:sql:setup
npm run e2e:create-users
npm run e2e:seed
npm run e2e:prepare-caregiver-join
```

The fixture gives the joining caregiver local baby data so the flow can cancel the destructive warning once, submit again, and confirm deletion before joining.

Run the transport-failure scenario on either platform with:

```bash
MAESTRO_DEVICE=<device-id> npm run e2e:onboarding-network
```

The runner prepares the invitation, authenticates the caregiver, stops the local Supabase API during redemption, verifies the reconciliation retry state, restarts the API, and completes the join.

## Shared helpers

`e2e/helpers/setup-with-baby.yaml` completes production guest-owner onboarding with required name, birth date, and gender. Activity, baby-management, settings, and edge-case flows use it instead of bypassing onboarding.

Text inputs dismiss the keyboard through `testID="dismiss-keyboard"`. Native date selection has platform-specific commands inside the shared helper. Keep loading and loaded states on the same screen test ID.

## Suites

```bash
npm run e2e:smoke
npm run e2e:regression
maestro test e2e/suites/onboarding-ios.yaml
maestro test e2e/suites/onboarding-android.yaml
```

The smoke suite covers production Welcome and fresh guest-owner setup. The regression suite adds restart, cancellation, returning restoration, and localization. The dedicated onboarding suites include invitation and join scenarios that require prepared authentication fixtures.

See [`README.md`](README.md) for local Supabase setup, simulator requirements, and the maintained two-caregiver timer suite.
