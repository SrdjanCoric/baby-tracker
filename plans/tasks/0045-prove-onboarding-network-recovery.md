# Task 0045: Prove onboarding recovery after network failure

**Branch**: `feature/prove-onboarding-network-recovery`
**Depends on**: 0044
**Source**: onboarding follow-up conversation 2026-07-30 · **User stories**: an invited caregiver can recover after the service becomes unavailable during destructive joining; maintainers can rerun a deterministic local interruption scenario and prove an invitation is redeemed at most once

## What to build

Turn the existing local-only three-phase onboarding network-failure harness into authoritative executable proof. Prepare an authenticated invited caregiver at the destructive join confirmation, stop the real local Supabase API gateway without clearing app or database state, submit the join and observe recoverable failure, restart the app while preserving onboarding state, restore the API, retry, and complete joining exactly once.

The scenario must verify both the visible recovery and the resulting local Supabase state: one invitation redemption, one target household membership, the expected household baby data, no duplicate membership or redemption effects, and no loss of unrelated fixture data beyond the deletion the caregiver explicitly confirmed. It must restore the API on success, failure, or cancellation and leave fixtures repeatable. Strengthen the smallest production recovery seam only if the real interruption exposes behavior that violates the already-approved Task 0041 contract. Visual changes, invalid-code validation, ordinary offline unit coverage, production Supabase access, and broader household migration behavior remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Provide deterministic integration/E2E proof across the app, local Supabase, Docker API interruption, restart persistence, and database postconditions; prove with a repeatable command on supported iOS and Android development devices.
- [ ] Document prerequisites, fixture lifecycle, interruption and restoration behavior, rerun semantics, expected assertions, and failure diagnostics with commands runnable from the repository root.
- [ ] Keep the harness local-only, use dedicated non-production fixtures, avoid logging credentials or tokens, and fail closed if the configured Supabase endpoint is not local; prove with script guards and security-focused tests or static checks.

## Implementation work

- [ ] Audit the existing prepare, offline, and recover Maestro flows and runner against the accepted destructive-join and invitation-redemption contracts.
- [ ] Test-first, add deterministic fixture and database assertions for exactly one invitation redemption, one target membership, expected baby visibility, and absence of duplicate side effects.
- [ ] Make the runner stop the real local Supabase API gateway only after the caregiver reaches confirmation, preserve app and database state across phases, and prove the offline submission reaches the recoverable retry state.
- [ ] Restart the app while the API is unavailable, restore the gateway, wait for health, retry through the production UI, and assert Home opens with the expected household baby.
- [ ] Guarantee API restoration through cleanup traps on pass, failure, interruption, and cancellation, while preserving enough diagnostics to explain a failed phase.
- [ ] Make fixture setup and cleanup idempotent so the scenario can be rerun without manual checkpoint editing or duplicate invitation state.
- [ ] Keep the runner device-selectable and execute the same authoritative scenario on supported iOS and Android development devices after Task 0044 selectors stabilize.
- [ ] If the real interruption reveals a production recovery defect, add the smallest failing unit or component seam before correcting it and rerun the full three-phase proof.
- [ ] Update authoritative onboarding and E2E documentation with the single command, local-only guard, prerequisites, recovery phases, postconditions, and troubleshooting evidence.
- [ ] Run script/YAML validation, focused fixture and recovery tests, security checks, canonical code checks, and the complete real-interruption scenario on iOS and Android.

## Acceptance criteria

- [ ] One repository command prepares the caregiver, interrupts the real local API, proves recoverable failure across app restart, restores the API, retries, and completes joining.
- [ ] The runner refuses non-local Supabase endpoints and always restores the local API gateway when it exits.
- [ ] UI assertions prove onboarding remains resumable and reaches Home with the expected household baby after recovery.
- [ ] Database assertions prove exactly one invitation redemption and one target membership with no duplicate side effects.
- [ ] The scenario is rerunnable from clean local fixtures on supported iOS and Android development devices without manually editing checkpoints.
- [ ] Documentation states the prerequisites, command, phases, expected result, cleanup behavior, and failure evidence accurately.
