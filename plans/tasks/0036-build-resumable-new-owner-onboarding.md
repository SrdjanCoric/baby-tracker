# Task 0036: Build the resumable new-owner onboarding path

**Branch**: `feature/build-resumable-new-owner-onboarding`
**Depends on**: 0034
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: a new household owner reaches useful tracking without creating an account; caregivers can correct the app language before setup; interrupted setup resumes without re-entering information

## What to build

Add the new versioned onboarding shell and complete the Start tracking path behind a development-only entry while production continues using the existing onboarding until the cutover task. The welcome screen must show the agreed product promise, a visible language control, and Start tracking as the primary action. Join a family and Sign in remain visible and may delegate to the current routes until their new paths are added by dependent tasks.

Start tracking must create a local guest baby using the complete profile contract, then let the caregiver skip all remaining setup or optionally record a real first activity. Offer Feeding, Sleep, Diaper, and Pumping, plus See all activity types and Not now. Use the normal activity forms and production providers. A saved activity must show a small Activity saved confirmation with a View or edit in Timeline action before Home. Starting a timer counts as taking the first action and must not trap onboarding until the timer ends.

Persist named onboarding states and drafts rather than numeric step indexes. Resume language, entry path, partial baby profile, baby-created state, and first-activity state after restart. Remove pagination from the new shell. Do not request system permissions, select dashboard activities, show a feature catalogue, or ask for theme, units, or time format. Keep all dashboard activities available.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Model the versioned state machine and drafts with strict discriminated types and consistent route names; prove with lint and typecheck.
- [x] Add deterministic unit, component, integration, and development E2E coverage for critical behavior, restart recovery, cancellation, validation, and timer starts.
- [x] Document the development-only entry, state schema, focused validation commands, and temporary production isolation.

## Implementation work

- [x] Test-first, define a versioned named-state model for welcome, owner baby setup, optional first activity, completion, and persisted drafts.
- [x] Treat a legacy completed or skipped status as completed in the new storage reader without changing production routing yet.
- [x] Build the welcome screen with the approved copy, Start tracking, Join a family, Sign in, and an accessible current-language control.
- [x] Apply a language selection immediately, persist it, localize date formatting, and keep every onboarding key in parity across all nine locale files.
- [x] Build the guest baby setup on the shared complete-profile contract, without a photo or permission request.
- [x] Once the baby exists, expose Skip remaining setup and never allow the new path to reach Home without a baby.
- [x] Build the optional first-activity chooser and route each choice through its normal form or timer behavior.
- [x] Show the first-save confirmation and Timeline action, then complete the development flow at Home.
- [x] Resume the exact unfinished state and entered values after app restart; Start over clears only the unfinished draft.
- [x] Keep the new flow isolated behind a development launch argument or development-only route until production cutover.
- [x] Add state/storage unit tests, screen component tests, real-provider integration coverage, translation-key parity, and a restartable Maestro path.
- [x] Document the preview entry and run focused checks followed by the canonical code checks.

## Acceptance criteria

- [x] A fresh development run can change language on Welcome and sees every later onboarding string and date in that locale.
- [x] Start tracking works without authentication and cannot continue past baby setup until name, birth date, and gender are valid.
- [x] After baby creation, Skip remaining setup opens Home with all activity types available.
- [x] Feeding, Sleep, Diaper, Pumping, See all activity types, and Not now behave as agreed.
- [x] A real saved activity or started timer exits setup safely; a saved entry offers a working Timeline action.
- [x] Restarting at each unfinished state resumes the correct screen and values instead of Welcome.
- [x] The new flow has no pagination, generic feature tour, preference screen, or system permission prompt.
- [x] Production users continue through the existing guard until the final cutover task.

## Implementation record

- Added the version 2 discriminated state model and serialized AsyncStorage service in `src/types/new-owner-onboarding.ts` and `src/services/new-owner-onboarding-storage.ts`.
- Added the development owner routes under `app/onboarding/owner/`. The approved Welcome copy is “Care for your baby with confidence” with the translated product promise in all nine locale files.
- Routed the first activity through the existing production screens and providers. Saved entries return to the confirmation screen; successful timer starts complete onboarding immediately.
- Added `onboardingPreview=true` handling in `src/utils/e2e-mode.ts`. `AuthGuard` rejects the owner routes in production and resumes the named development state when preview mode is enabled.
- Added storage, locale parity, screen, timer-start, and real-provider tests. `e2e/flows/onboarding/new-owner-preview-restart.yaml` covers language selection, validation, restart recovery, and Start over.

## Decisions

- The Welcome copy was confirmed during implementation and translated for every supported locale.
- Start over is available before baby creation. It removes only `@new_owner_onboarding_v2`; it leaves language and app data unchanged.
- The development flow uses an explicit launch argument as well as a development-build check. No production routing cutover is part of this task.

## Repository guideline proof

- Loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, `references/02-testing.md`, and `references/03-documentation.md` in implement and review modes.
- `npm run lint` and `npm run typecheck` pass with the new strict state types and route names.
- `npm run check:code` passes: 2,354 unit tests, 689 component and integration tests, 103 security tests, 244 sync tests, and 41 CI contract tests.
- Preview setup, storage schema, isolation, and focused commands are documented in `docs/NEW_OWNER_ONBOARDING_PREVIEW.md`.

## Review and documentation

- Task review used `base=main`. The remediation pass added the missing preview documentation and replaced NativeWind dark variants on the new screens with stable inline theme colors. A second Standards, Spec, Bug, and Security pass found no remaining issue. No security risk was accepted.
- README sections updated: Architecture, Project Structure, and Testing. The write-well audit completed in two passes.

## Highest-level proof

- The restartable Maestro flow is committed but has not run in this worktree because no simulator has the development app installed. Run `maestro test e2e/flows/onboarding/new-owner-preview-restart.yaml`; success is a completed flow with the German draft restored after restart and cleared by Start over. Any failed assertion indicates a release-blocking failure.
