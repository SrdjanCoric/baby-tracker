# Task 0040: Add development onboarding tools

**Branch**: `feature/add-development-onboarding-tools`
**Depends on**: 0039
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: maintainers can inspect every onboarding path without deleting real app data; old-user routing can be replayed in development; unfinished-state recovery can be tested deliberately

## What to build

Add a Developer Tools section that exists only in `__DEV__`. Provide Preview onboarding, Run first-launch routing again, and Clear unfinished onboarding draft.

Preview onboarding must let the maintainer choose Start tracking, Join a family, or Returning user and exercise success, skip, cancellation, loading, and recoverable-error UI through isolated adapters. Preview must not create or delete babies, authenticate, join a household, change preferences, alter production onboarding completion, or persist preview state into real stores. Run first-launch routing again clears only real onboarding completion and draft state, preserving auth, household, babies, activities, and preferences so an existing account exercises returning routing. Clear unfinished onboarding draft removes only the resumable draft.

Document the difference between isolated preview, real routing replay, and fresh-state Maestro integration tests. Do not add a production-visible feature flag or remote configuration service.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Keep preview adapters and real providers behind explicit typed boundaries that production builds can eliminate; prove with lint, typecheck, and production-bundle configuration tests where available.
- [x] Test that every developer action is deterministic, isolated, and unable to mutate real storage or services.
- [x] Document safe usage, preserved data, fresh-state integration testing, and troubleshooting commands.

## Implementation work

- [x] Test-first, define an isolated preview adapter for each onboarding path and its relevant loading, error, skip, and completion states.
- [x] Add a `__DEV__`-only Settings section with Preview onboarding, Run first-launch routing again, and Clear unfinished onboarding draft.
- [x] Let Preview onboarding select all three paths without invoking auth, Supabase, baby storage, activity storage, preferences, or completion storage.
- [x] Make preview exit return to Settings without changing the previous app route or data.
- [x] Make real routing replay clear only onboarding status and drafts, with an explicit development warning that the next guard evaluation will route from current account data.
- [x] Make draft clearing leave completion and all non-onboarding data unchanged.
- [x] Ensure no developer route, label, test fixture, or control is reachable in production builds.
- [x] Add component, isolation, storage-spy, route, and production-gating tests.
- [x] Update development and E2E documentation with the three testing modes and their limits.
- [x] Run focused tests and the canonical code checks.

## Acceptance criteria

- [x] Development Settings exposes all three tools with clear descriptions.
- [x] Preview covers Start tracking, Join a family, and Returning user without any real side effect.
- [x] Preview can demonstrate relevant loading and failure states and exits back to Settings.
- [x] First-launch replay preserves auth, babies, activities, household data, and preferences while clearing onboarding status and drafts.
- [x] Draft clearing changes only the unfinished onboarding draft.
- [x] Production builds cannot navigate to or render the developer tools.
- [x] Documentation explains when to use preview, replay, simulator state clearing, and local Supabase Maestro tests.

## Completion record

### Implementation and decisions

- Added the development-only Settings section and path-specific sample adapters in `src/components/settings/DevelopmentOnboardingTools.tsx` and `src/services/development-onboarding-preview.ts`. Preview actions stay in memory and exit to the existing Settings route.
- Added replay and draft-clearing boundaries in `src/services/development-onboarding-tools.ts`, `src/services/onboarding-storage.ts`, and `src/services/new-owner-onboarding-storage.ts`. Replay prepares signed-in restoration before removing completion, serializes developer mutations, and routes signed-in accounts directly to restoration.
- The user approved replaying the upcoming role-based guard instead of the legacy production guard. The override lasts for the current development session, while production keeps the legacy guard until Task 0041.
- Production Settings uses a literal `if (__DEV__)` around the developer-module `require()`. `scripts/check-development-tools-production-bundle.mjs` exports a production Hermes bundle without loading `.env` and fails if developer labels or test IDs remain.

### Repository guidelines and documentation

- Loaded guideline references `00-overview`, `01-style-and-code-quality`, `02-testing`, and `03-documentation` in implementation and review modes. Strict typing, lint, deterministic tests, production exclusion, and current documentation all have command or repository evidence.
- Updated `docs/NEW_OWNER_ONBOARDING_PREVIEW.md`, `e2e/README.md`, and `e2e/IMPLEMENTATION.md` with isolated preview, real replay, and fresh-state Maestro modes. The documentation write-well audit completed after three passes.
- Updated the README introduction, **Development onboarding tools**, and **Testing** sections. Its write-well audit completed after two passes.

### Review and proof

- Compact task review ran one Standards, Spec, Bug, and Security panel against `main` at initial head `716ccb5`. Security reported no findings.
- One remediation batch replaced rapid-render `dark:` variants, strengthened path-state assertions, made replay completion the final storage mutation, serialized developer actions, routed signed-in replay directly to restoration, and added a production-bundle gate. All frozen findings are fixed, with no accepted risks or deferred concerns. A full review is not recommended.
- Focused proof passed 67 unit tests and 8 component tests. The component suite covers every path and state, preview exit, signed-in routing, storage failures, mutation serialization, draft isolation, and production rendering.
- Final `npm run check:code` passed with 127 Vitest files and 2,465 tests, 77 Jest suites and 764 tests, 13 security files and 110 tests, 20 sync files and 244 tests, and 41 CI-contract tests. Its production-gating stage exported iOS with `EXPO_NO_DOTENV=1` and confirmed that the Hermes bundle contains no developer controls, labels, or test IDs.
