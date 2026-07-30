# Task 0044: Match onboarding to the current app UI

**Branch**: `feature/match-onboarding-current-app-ui`
**Depends on**: 0041
**Source**: onboarding follow-up conversation 2026-07-30 · **User stories**: a new owner or invited caregiver sees the same polished interface as the rest of the app; a caregiver can complete onboarding on small and large devices, in dark mode, with large text, and in any supported locale without clipped or misaligned content

## What to build

Bring every production role-based onboarding route into the current app's visual system without changing the state machine or available paths. Use the existing design tokens, shared controls, spacing, typography, surfaces, action hierarchy, dark-mode behavior, keyboard handling, safe areas, and accessibility conventions. Make baby creation match the established add/edit baby profile experience for name, birth date, gender, validation, and actions while keeping photos out of onboarding.

Review the approved onboarding copy through `write-well`, preserve the approved Welcome title and promise, and keep equivalent meaning across all nine locale files. Layouts must remain readable and correctly aligned when translations expand, screens are narrow or tall, the keyboard is open, or system text size is increased. Preserve every Task 0041 navigation transition, persistence rule, test identifier needed for behavior, authentication boundary, and destructive-join confirmation. Photos, onboarding behavior changes, authentication changes, and network-failure proof remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Reuse established components, tokens, naming, strict types, and lint rules without introducing a parallel onboarding-only design system; prove with lint, typecheck, and direct comparison to current app patterns.
- [x] Preserve meaningful component and production-route coverage while adding deterministic checks for accessibility semantics, locale parity, keyboard-safe scrolling, and unchanged navigation behavior; prove with focused tests and the canonical code checks.
- [x] Keep onboarding and E2E documentation aligned with the final visual-review matrix and current production routes; prove with a documentation audit and copyable verification commands.

## Implementation work

- [x] Inventory the presentation and copy differences between every role-based onboarding route and the current app's shared UI and baby-profile conventions.
- [x] Test-first, establish shared onboarding layout and action patterns that handle safe areas, scrolling, keyboards, loading, errors, dark mode, and dynamic text without changing route behavior.
- [x] Align Welcome, baby creation, account, invitation, first activity, saved, join, and restore screens with the current design tokens, controls, spacing, typography, and action hierarchy.
- [x] Match onboarding baby creation to the existing add/edit baby profile controls and validation presentation while omitting photo selection.
- [x] Audit source copy through `write-well`, preserve approved product meaning, and update all nine locale files with complete key and interpolation parity.
- [x] Preserve existing automation identifiers where behavior is unchanged and update selectors only when the accessible control contract requires it.
- [x] Add or update component and E2E coverage for unchanged transitions, validation, accessibility roles and states, expanded locale copy, keyboard dismissal, and scroll reachability.
- [x] Update authoritative onboarding and E2E documentation with the final cross-device visual verification procedure.
- [x] Run focused component and onboarding checks, locale parity validation, lint, typecheck, canonical code checks, and the production onboarding suites affected by selector changes.

## Human checkpoints

- [x] [verify] Representative iPhone 17 Pro screenshots and the production Welcome smoke were reviewed. On 2026-07-30, the user explicitly accepted this reduced proof and waived the exhaustive small/large iOS/Android, light/dark, large-text, and nine-locale manual matrix.

## Acceptance criteria

- [x] Every role-based onboarding route uses the current app's design tokens, controls, spacing, typography, surfaces, and action hierarchy in light and dark mode.
- [x] Baby creation matches the current add/edit baby profile experience for the fields onboarding collects, without adding photos.
- [x] Structural tests prove keyboard-safe scrolling, wrapping actions, and accessible fields; the user accepted representative iOS visual proof instead of the exhaustive device matrix.
- [x] Approved copy is clear and consistently aligned, and all nine locale files retain complete semantic and interpolation parity.
- [x] Task 0041 state transitions, persistence, authentication behavior, destructive confirmation, and production entry rules remain unchanged.
- [x] Automated checks and the accepted representative device proof pass, and authoritative onboarding/E2E documentation describes the shipped UI and full optional review procedure.

## Completion record

- Built `OnboardingScreen` and theme-aware, wrapping shared controls for every production onboarding route. Baby setup now follows Add/Edit baby validation and date behavior without photos.
- Preserved Task 0041 routing, persistence, authentication boundaries, destructive confirmation, and existing automation identifiers.
- Audited onboarding copy with `write-well` in two passes. Updated the Welcome promise and all nine locale files, with deterministic key and interpolation parity tests.
- Review fixed token contrast, dark error surfaces, loading announcements, loading-button names, and baby-profile parity. Security review found no trust-boundary regression.
- Guideline proof: `references/00-overview.md`, `01-style-and-code-quality.md`, `02-testing.md`, and `03-documentation.md`; focused component and locale tests, lint, typecheck, and `npm run check:code` passed.
- Documentation: updated `README.md`, `docs/ROLE_BASED_ONBOARDING.md`, and `e2e/README.md`; the README `write-well` audit completed in two passes.
- Highest-level proof: production iOS Welcome smoke passed on an iPhone 17 Pro simulator and screenshots covered Welcome, account choice, and baby profile. The user accepted this representative proof in place of the exhaustive device matrix.
