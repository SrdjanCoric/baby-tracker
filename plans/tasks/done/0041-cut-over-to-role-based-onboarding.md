# Task 0041: Cut over to role-based onboarding

**Branch**: `feature/cut-over-to-role-based-onboarding`
**Depends on**: 0040
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: new users enter through the path matching their situation; existing completed users are not interrupted after updating; maintainers have one authoritative onboarding implementation and reliable end-to-end proof

## What to build

Make the new role-based onboarding state machine authoritative in production. Welcome must show the approved promise, an immediately applied language selector, Start tracking, Join a family, and Sign in. A user may enter Home only after a baby is available through creation, household join, or account restoration. Once a new owner creates a baby, Skip remaining setup may bypass caregiver invitation and the first activity.

Treat every legacy onboarding record marked completed or skipped as completed so existing installations do not see the redesign after updating. New installations without completion enter the new flow. Signed-in installations restore account data through the returning path. Replace the old numeric-step guard and remove obsolete onboarding screens, pagination, constants, translations, tests, and navigation branches rather than leaving two competing flows.

Replace stale Maestro onboarding flows with final production-route scenarios for guest owner, optional account invitation, manual-code joining, returning restoration, skip after baby, app restart, auth cancellation, network failure, destructive join confirmation, legacy upgrade, and all supported locales. Update authoritative README, E2E, deep-link, and onboarding documentation. Invitation links, analytics, deferred linking through store installation, household-history merging, and legacy profile remediation remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Remove the obsolete flow without dead routes, duplicate state, broad type suppressions, warnings, or stale imports; prove with lint and typecheck.
- [x] Keep meaningful deterministic unit, component, integration, and E2E coverage for every production entry path and critical failure policy; prove with focused commands and the canonical code checks.
- [x] Update all authoritative setup, deep-link, development-preview, and E2E documentation and remove stale onboarding instructions.

## Implementation work

- [x] Test-first, switch the production guard to the versioned named-state router and baby-availability rule.
- [x] Migrate legacy completed and skipped statuses to completed behavior without displaying new onboarding.
- [x] Route new unauthenticated installations to Welcome and signed-in incomplete installations through returning restoration.
- [x] Enable all three final paths and optional owner steps in production with no remote feature flag.
- [x] Remove the old feature, preferences, generic sync, pagination, numeric-step, duplicate skip, and auth-bypass implementations after all callers move.
- [x] Remove stale translation keys while preserving complete parity for every final string across all nine locale files.
- [x] Replace obsolete unit, component, integration, and Maestro assumptions, including the current full-flow test that omits required profile data.
- [x] Add final production-route Maestro flows for fresh owner, owner invitation, manual-code join, returning restore, restart, skip, destructive confirmation, and failure recovery on iOS and Android.
- [x] Prove a completed or skipped legacy installation opens Home after upgrade without seeing onboarding.
- [x] Update README and authoritative onboarding, E2E, and deep-link documentation; remove stale plan-era descriptions from active docs.
- [x] Run focused validation, lint, typecheck, unit, component, security, integration, and final Maestro checks.

## Human checkpoints

- [x] [verify] Deferred by the user on 2026-07-30 to the approved onboarding visual-consistency follow-up. That task will cover every route in all nine locales on representative small and large iOS and Android screens with large text enabled.

## Acceptance criteria

- [x] Production Welcome exposes Start tracking, Join a family, Sign in, and immediate language switching with the approved copy.
- [x] Home is inaccessible until a created, joined, or restored baby is available, except existing legacy-completed installations that already follow current app behavior.
- [x] New owners can skip only after baby creation; joined and returning caregivers bypass the first-activity prompt.
- [x] Completed and skipped legacy users do not see the redesigned flow after updating.
- [x] Only one onboarding state model, guard, and route set remains.
- [x] Every final string exists in all nine locales and uses locale-aware date formatting.
- [x] Final automated coverage proves every production path, restart point, application-level failure, and accepted destructive confirmation. The user deferred real transport interruption proof to a dedicated approved follow-up on 2026-07-30.
- [x] Current documentation and test commands describe the shipped flow and development tools accurately.

## Scope decisions

- On 2026-07-30, the user deferred the real local-API interruption run to an approved network-recovery follow-up. This task includes the local-only three-phase harness, but does not claim that scenario as executed proof.
- On 2026-07-30, the user deferred the manual locale, large-text, and screen-size review to an approved visual-consistency follow-up. That follow-up will also align every onboarding route with the current app's design and copy conventions.
- Repository policy requires those follow-up task files and master-plan pointers to land in a dedicated planning PR after this implementation merges.

## Verification evidence

- `npm run check:code` passed after remediation: 128 Vitest files with 2,445 tests, 75 Jest suites with 746 tests, 110 security tests, 244 sync tests, CI contract tests, lint, typecheck, and production gating.
- All ten production onboarding Maestro flows passed on an iPhone 17 Pro simulator and a Pixel 7 API 35 ARM64 emulator. The resumable runner retained per-platform checkpoints and device configuration under ignored `e2e/artifacts/` files.
- Local Supabase reset successfully applied all 61 migrations before fixture-backed Android proof. The local-only E2E user, household, and caregiver invitation fixtures were recreated successfully.
- Focused onboarding storage, guard, routing, fixture, component, integration, guest achievement, and date-picker dismissal tests passed during test-first implementation and review remediation.
- Ruby parsed all 676 Maestro YAML files; Bash syntax validation and `git diff --check` passed.
- One compact independent review panel completed. Its storage validation, reset ordering, authenticated baby restoration, and E2E fixture findings were remediated and closed with focused tests plus the final canonical check.
