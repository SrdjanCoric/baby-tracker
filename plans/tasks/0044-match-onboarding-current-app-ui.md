# Task 0044: Match onboarding to the current app UI

**Branch**: `feature/match-onboarding-current-app-ui`
**Depends on**: 0041
**Source**: onboarding follow-up conversation 2026-07-30 · **User stories**: a new owner or invited caregiver sees the same polished interface as the rest of the app; a caregiver can complete onboarding on small and large devices, in dark mode, with large text, and in any supported locale without clipped or misaligned content

## What to build

Bring every production role-based onboarding route into the current app's visual system without changing the state machine or available paths. Use the existing design tokens, shared controls, spacing, typography, surfaces, action hierarchy, dark-mode behavior, keyboard handling, safe areas, and accessibility conventions. Make baby creation match the established add/edit baby profile experience for name, birth date, gender, validation, and actions while keeping photos out of onboarding.

Review the approved onboarding copy through `write-well`, preserve the approved Welcome title and promise, and keep equivalent meaning across all nine locale files. Layouts must remain readable and correctly aligned when translations expand, screens are narrow or tall, the keyboard is open, or system text size is increased. Preserve every Task 0041 navigation transition, persistence rule, test identifier needed for behavior, authentication boundary, and destructive-join confirmation. Photos, onboarding behavior changes, authentication changes, and network-failure proof remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [ ] Reuse established components, tokens, naming, strict types, and lint rules without introducing a parallel onboarding-only design system; prove with lint, typecheck, and direct comparison to current app patterns.
- [ ] Preserve meaningful component and production-route coverage while adding deterministic checks for accessibility semantics, locale parity, keyboard-safe scrolling, and unchanged navigation behavior; prove with focused tests and the canonical code checks.
- [ ] Keep onboarding and E2E documentation aligned with the final visual-review matrix and current production routes; prove with a documentation audit and copyable verification commands.

## Implementation work

- [ ] Inventory the presentation and copy differences between every role-based onboarding route and the current app's shared UI and baby-profile conventions.
- [ ] Test-first, establish shared onboarding layout and action patterns that handle safe areas, scrolling, keyboards, loading, errors, dark mode, and dynamic text without changing route behavior.
- [ ] Align Welcome, baby creation, account, invitation, first activity, saved, join, and restore screens with the current design tokens, controls, spacing, typography, and action hierarchy.
- [ ] Match onboarding baby creation to the existing add/edit baby profile controls and validation presentation while omitting photo selection.
- [ ] Audit source copy through `write-well`, preserve approved product meaning, and update all nine locale files with complete key and interpolation parity.
- [ ] Preserve existing automation identifiers where behavior is unchanged and update selectors only when the accessible control contract requires it.
- [ ] Add or update component and E2E coverage for unchanged transitions, validation, accessibility roles and states, expanded locale copy, keyboard dismissal, and scroll reachability.
- [ ] Update authoritative onboarding and E2E documentation with the final cross-device visual verification procedure.
- [ ] Run focused component and onboarding checks, locale parity validation, lint, typecheck, canonical code checks, and the production onboarding suites affected by selector changes.

## Human checkpoints

- [ ] [verify] Review every production onboarding route in light and dark mode, in all nine locales, on representative small and large iOS and Android screens with large text enabled. Exercise the keyboard and scroll to every action. · Expected: content remains readable, aligned, reachable, and visually consistent with the current app; baby creation matches the add/edit profile experience; primary and secondary actions remain clear. · Failure: clipped, overlapping, off-screen, untranslated, low-contrast, inconsistently styled, or unreachable content, or any changed navigation behavior. · Reason: perceived visual consistency, translation fit, and platform text/layout rendering require human device inspection.

## Acceptance criteria

- [ ] Every role-based onboarding route uses the current app's design tokens, controls, spacing, typography, surfaces, and action hierarchy in light and dark mode.
- [ ] Baby creation matches the current add/edit baby profile experience for the fields onboarding collects, without adding photos.
- [ ] Every action and field remains visible and reachable on representative small and large iOS and Android screens with the keyboard and large text enabled.
- [ ] Approved copy is clear and consistently aligned, and all nine locale files retain complete semantic and interpolation parity.
- [ ] Task 0041 state transitions, persistence, authentication behavior, destructive confirmation, and production entry rules remain unchanged.
- [ ] Automated checks and the required device matrix pass, and authoritative onboarding/E2E documentation describes the shipped UI and review procedure.
