# Task 0041: Cut over to role-based onboarding

**Branch**: `feature/cut-over-to-role-based-onboarding`
**Depends on**: 0040
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: new users enter through the path matching their situation; existing completed users are not interrupted after updating; maintainers have one authoritative onboarding implementation and reliable end-to-end proof

## What to build

Make the new role-based onboarding state machine authoritative in production. Welcome must show the approved promise, an immediately applied language selector, Start tracking, Join a family, and Sign in. A user may enter Home only after a baby is available through creation, household join, or account restoration. Once a new owner creates a baby, Skip remaining setup may bypass caregiver invitation and the first activity.

Treat every legacy onboarding record marked completed or skipped as completed so existing installations do not see the redesign after updating. New installations without completion enter the new flow. Signed-in installations restore account data through the returning path. Replace the old numeric-step guard and remove obsolete onboarding screens, pagination, constants, translations, tests, and navigation branches rather than leaving two competing flows.

Replace stale Maestro onboarding flows with final production-route scenarios for guest owner, optional account invitation, code and link joining, returning restoration, skip after baby, app restart, auth cancellation, network failure, destructive join confirmation, legacy upgrade, and all supported locales. Update authoritative README, E2E, deep-link, and onboarding documentation. Analytics, automatic deferred linking through store installation, household-history merging, and legacy profile remediation remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [ ] Remove the obsolete flow without dead routes, duplicate state, broad type suppressions, warnings, or stale imports; prove with lint and typecheck.
- [ ] Keep meaningful deterministic unit, component, integration, and E2E coverage for every production entry path and critical failure policy; prove with focused commands and the canonical code checks.
- [ ] Update all authoritative setup, deep-link, development-preview, and E2E documentation and remove stale onboarding instructions.

## Implementation work

- [ ] Test-first, switch the production guard to the versioned named-state router and baby-availability rule.
- [ ] Migrate legacy completed and skipped statuses to completed behavior without displaying new onboarding.
- [ ] Route new unauthenticated installations to Welcome and signed-in incomplete installations through returning restoration.
- [ ] Enable all three final paths and optional owner steps in production with no remote feature flag.
- [ ] Remove the old feature, preferences, generic sync, pagination, numeric-step, duplicate skip, and auth-bypass implementations after all callers move.
- [ ] Remove stale translation keys while preserving complete parity for every final string across all nine locale files.
- [ ] Replace obsolete unit, component, integration, and Maestro assumptions, including the current full-flow test that omits required profile data.
- [ ] Add final production-route Maestro flows for fresh owner, owner invitation, manual/link join, returning restore, restart, skip, destructive confirmation, and failure recovery on iOS and Android.
- [ ] Prove a completed or skipped legacy installation opens Home after upgrade without seeing onboarding.
- [ ] Update README and authoritative onboarding, E2E, and deep-link documentation; remove stale plan-era descriptions from active docs.
- [ ] Run focused validation, lint, typecheck, unit, component, security, integration, and final Maestro checks.

## Human checkpoints

- [ ] [verify] Cycle the production flow through all nine locales on representative small and large iOS and Android screens with large text enabled · Expected: every screen, action, error, accessibility label, and date changes to the selected locale without English fallback, clipping, or blocked controls · Failure: untranslated keys, stale language after selection, incorrect regional date formatting, unreadable layout, or inaccessible actions · Reason: translation quality and device layout under platform font rendering require human review beyond key-parity tests.

## Acceptance criteria

- [ ] Production Welcome exposes Start tracking, Join a family, Sign in, and immediate language switching with the approved copy.
- [ ] Home is inaccessible until a created, joined, or restored baby is available, except existing legacy-completed installations that already follow current app behavior.
- [ ] New owners can skip only after baby creation; joined and returning caregivers bypass the first-activity prompt.
- [ ] Completed and skipped legacy users do not see the redesigned flow after updating.
- [ ] Only one onboarding state model, guard, and route set remains.
- [ ] Every final string exists in all nine locales and uses locale-aware date formatting.
- [ ] Final automated coverage proves every path, restart point, critical failure, and accepted destructive confirmation.
- [ ] Current documentation and test commands describe the shipped flow and development tools accurately.
