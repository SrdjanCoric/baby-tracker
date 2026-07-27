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

- [ ] Keep preview adapters and real providers behind explicit typed boundaries that production builds can eliminate; prove with lint, typecheck, and production-bundle configuration tests where available.
- [ ] Test that every developer action is deterministic, isolated, and unable to mutate real storage or services.
- [ ] Document safe usage, preserved data, fresh-state integration testing, and troubleshooting commands.

## Implementation work

- [ ] Test-first, define an isolated preview adapter for each onboarding path and its relevant loading, error, skip, and completion states.
- [ ] Add a `__DEV__`-only Settings section with Preview onboarding, Run first-launch routing again, and Clear unfinished onboarding draft.
- [ ] Let Preview onboarding select all three paths without invoking auth, Supabase, baby storage, activity storage, preferences, or completion storage.
- [ ] Make preview exit return to Settings without changing the previous app route or data.
- [ ] Make real routing replay clear only onboarding status and drafts, with an explicit development warning that the next guard evaluation will route from current account data.
- [ ] Make draft clearing leave completion and all non-onboarding data unchanged.
- [ ] Ensure no developer route, label, test fixture, or control is reachable in production builds.
- [ ] Add component, isolation, storage-spy, route, and production-gating tests.
- [ ] Update development and E2E documentation with the three testing modes and their limits.
- [ ] Run focused tests and the canonical code checks.

## Acceptance criteria

- [ ] Development Settings exposes all three tools with clear descriptions.
- [ ] Preview covers Start tracking, Join a family, and Returning user without any real side effect.
- [ ] Preview can demonstrate relevant loading and failure states and exits back to Settings.
- [ ] First-launch replay preserves auth, babies, activities, household data, and preferences while clearing onboarding status and drafts.
- [ ] Draft clearing changes only the unfinished onboarding draft.
- [ ] Production builds cannot navigate to or render the developer tools.
- [ ] Documentation explains when to use preview, replay, simulator state clearing, and local Supabase Maestro tests.
