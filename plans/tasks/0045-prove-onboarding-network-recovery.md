# Task 0045: Prove onboarding recovery after network failure

**Branch**: `feature/prove-onboarding-network-recovery`
**Depends on**: 0044
**Source**: onboarding follow-up conversation 2026-07-30 · **User stories**: an invited caregiver can recover after the service becomes unavailable during destructive joining; maintainers can rerun a deterministic local interruption scenario and prove an invitation is redeemed at most once

## What to build

Turn the existing local-only three-phase onboarding network-failure harness into authoritative executable proof. Prepare an authenticated invited caregiver at the destructive join confirmation, stop the real local Supabase API gateway without clearing app or database state, submit the join and observe recoverable failure, restart the app while preserving onboarding state, restore the API, retry, and complete joining exactly once.

The scenario must verify both the visible recovery and the resulting local Supabase state: one invitation redemption, one target household membership, the expected household baby data, no duplicate membership or redemption effects, and no loss of unrelated fixture data beyond the deletion the caregiver explicitly confirmed. It must restore the API on success, failure, or cancellation and leave fixtures repeatable. Strengthen the smallest production recovery seam only if the real interruption exposes behavior that violates the already-approved Task 0041 contract. Visual changes, invalid-code validation, ordinary offline unit coverage, production Supabase access, and broader household migration behavior remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [x] Provide deterministic integration/E2E proof across the app, local Supabase, Docker API interruption, restart persistence, and database postconditions; prove with a repeatable command on supported iOS and Android development devices.
- [x] Document prerequisites, fixture lifecycle, interruption and restoration behavior, rerun semantics, expected assertions, and failure diagnostics with commands runnable from the repository root.
- [x] Keep the harness local-only, use dedicated non-production fixtures, avoid logging credentials or tokens, and fail closed if the configured Supabase endpoint is not local; prove with script guards and security-focused tests or static checks.

## Implementation work

- [x] Audit the existing prepare, offline, and recover Maestro flows and runner against the accepted destructive-join and invitation-redemption contracts.
- [x] Test-first, add deterministic fixture and database assertions for exactly one invitation redemption, one target membership, expected baby visibility, and absence of duplicate side effects.
- [x] Make the runner stop the real local Supabase API gateway only after the caregiver reaches confirmation, preserve app and database state across phases, and prove the offline submission reaches the recoverable retry state.
- [x] Restart the app while the API is unavailable, restore the gateway, wait for health, retry through the production UI, and assert Home opens with the expected household baby.
- [x] Guarantee API restoration through cleanup traps on pass, failure, interruption, and cancellation, while preserving enough diagnostics to explain a failed phase.
- [x] Make fixture setup and cleanup idempotent so the scenario can be rerun without manual checkpoint editing or duplicate invitation state.
- [x] Keep the runner device-selectable and execute the same authoritative scenario on supported iOS and Android development devices after Task 0044 selectors stabilize.
- [x] If the real interruption reveals a production recovery defect, add the smallest failing unit or component seam before correcting it and rerun the full three-phase proof.
- [x] Update authoritative onboarding and E2E documentation with the single command, local-only guard, prerequisites, recovery phases, postconditions, and troubleshooting evidence.
- [x] Run script/YAML validation, focused fixture and recovery tests, security checks, canonical code checks, and the complete real-interruption scenario on iOS and Android.

## Acceptance criteria

- [x] One repository command prepares the caregiver, interrupts the real local API, proves recoverable failure across app restart, restores the API, retries, and completes joining.
- [x] The runner refuses non-local Supabase endpoints and always restores the local API gateway when it exits.
- [x] UI assertions prove onboarding remains resumable and reaches Home with the expected household baby after recovery.
- [x] Database assertions prove exactly one invitation redemption and one target membership with no duplicate side effects.
- [x] The scenario is rerunnable from clean local fixtures on supported iOS and Android development devices without manually editing checkpoints.
- [x] Documentation states the prerequisites, command, phases, expected result, cleanup behavior, and failure evidence accurately.

## Completion record

### Implementation

- `e2e/scripts/run-onboarding-network-failure.sh` now owns guarded Metro startup, local API interruption and bounded health checks, signal-aware child cleanup, API-first restoration, phase artifacts, and final SQL verification.
- `e2e/flows/onboarding/network-failure-{offline,recover}.yaml` submit before restart, prove Retry survives an offline relaunch, and recover through the persisted production state.
- `e2e/fixtures/verify-caregiver-join-recovery.sql` verifies one consumed invitation, the target membership and babies, confirmed solo-data deletion, and every seeded unrelated sentinel.
- `src/components/ReturningUserProfileFallback.tsx` renders restricted caregiver recovery while sync identity is unavailable, retries transient profile reconciliation without opening providers, and offers Sign out.
- The real interruption exposed a blank restricted fallback on offline restart. The recovery UI fix preserves `SyncAuthGate`; locally persisted household identity is never used as authorization.

### Repository guidelines and documentation

- Loaded `references/00-overview.md`, `references/02-testing.md`, `references/03-documentation.md`, and `references/07-security.md` in implementation and review modes.
- Testing proof covers public component behavior, runner failure and cancellation paths, non-local API and database rejection, fixture SQL, and real local service/device boundaries.
- Updated `README.md` Testing, `e2e/README.md` Onboarding network recovery, `e2e/IMPLEMENTATION.md`, `docs/ROLE_BASED_ONBOARDING.md`, and `docs/CAREGIVER_INVITATIONS.md`.
- README prose passed two `write-well` audit passes. The first split overloaded phase descriptions; the second full affected-prose pass was clean.

### Review

- `task-review-compact` ran one Standards, Spec, Bug, and Security panel against `main` at reviewed head `c286bc7a7842662404c82507a0758e910c115113`.
- Remediation expanded unrelated fixture assertions, added the database endpoint guard test, corrected structural-test claims, forwarded cancellation to active children, bounded health requests, restored the API before diagnostics, added caregiver Sign out, and made the runner start guarded Metro itself.
- The user approved fixing the Metro/backend trust-boundary finding. No security risks were accepted, no findings remain unresolved, and a full second review was not required.

### Proof

- TDD RED/GREEN: runner orchestration and restart ordering; restricted caregiver recovery; transient reconciliation; review cleanup, endpoint, and Sign out cases.
- Focused: 6 runner tests, 22 onboarding component tests, 55 onboarding/household unit tests, expanded SQL verifier, affected ESLint, Bash syntax, and TypeScript.
- Canonical: `npm run check` passed in 192 seconds; log `canonical-check.log` in the task workflow directory.
- iOS: `MAESTRO_DEVICE=3FEB1C07-2D2D-4E49-A289-0B012BBB5DAC npm run e2e:onboarding-network` passed on SofiBaby Owner, iOS 26.5. Evidence: `e2e/artifacts/onboarding-network/20260730T171237Z-34283/`.
- Android: `SOFIBABY_E2E_PLATFORM=android MAESTRO_DEVICE=emulator-5554 npm run e2e:onboarding-network` passed on `SofiBaby_Pixel_7_API_35`. Evidence: `e2e/artifacts/onboarding-network/20260730T171617Z-37057/`.
- Both platform runs reached Home, verified a target baby, passed all database postconditions, and restored the local API. No manual verification remains.
