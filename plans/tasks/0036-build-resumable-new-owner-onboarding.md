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

- [ ] Model the versioned state machine and drafts with strict discriminated types and consistent route names; prove with lint and typecheck.
- [ ] Add deterministic unit, component, integration, and development E2E coverage for critical behavior, restart recovery, cancellation, validation, and timer starts.
- [ ] Document the development-only entry, state schema, focused validation commands, and temporary production isolation.

## Implementation work

- [ ] Test-first, define a versioned named-state model for welcome, owner baby setup, optional first activity, completion, and persisted drafts.
- [ ] Treat a legacy completed or skipped status as completed in the new storage reader without changing production routing yet.
- [ ] Build the welcome screen with the approved copy, Start tracking, Join a family, Sign in, and an accessible current-language control.
- [ ] Apply a language selection immediately, persist it, localize date formatting, and keep every onboarding key in parity across all nine locale files.
- [ ] Build the guest baby setup on the shared complete-profile contract, without a photo or permission request.
- [ ] Once the baby exists, expose Skip remaining setup and never allow the new path to reach Home without a baby.
- [ ] Build the optional first-activity chooser and route each choice through its normal form or timer behavior.
- [ ] Show the first-save confirmation and Timeline action, then complete the development flow at Home.
- [ ] Resume the exact unfinished state and entered values after app restart; Start over clears only the unfinished draft.
- [ ] Keep the new flow isolated behind a development launch argument or development-only route until production cutover.
- [ ] Add state/storage unit tests, screen component tests, real-provider integration coverage, translation-key parity, and a restartable Maestro path.
- [ ] Document the preview entry and run focused checks followed by the canonical code checks.

## Acceptance criteria

- [ ] A fresh development run can change language on Welcome and sees every later onboarding string and date in that locale.
- [ ] Start tracking works without authentication and cannot continue past baby setup until name, birth date, and gender are valid.
- [ ] After baby creation, Skip remaining setup opens Home with all activity types available.
- [ ] Feeding, Sleep, Diaper, Pumping, See all activity types, and Not now behave as agreed.
- [ ] A real saved activity or started timer exits setup safely; a saved entry offers a working Timeline action.
- [ ] Restarting at each unfinished state resumes the correct screen and values instead of Welcome.
- [ ] The new flow has no pagination, generic feature tour, preference screen, or system permission prompt.
- [ ] Production users continue through the existing guard until the final cutover task.
