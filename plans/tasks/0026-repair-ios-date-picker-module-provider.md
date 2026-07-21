# Task 0026: Repair the production iOS date-picker module provider

**Branch**: `feature/repair-ios-date-picker-module-provider`
**Depends on**: 0017
**Source**: Task 0017 iOS New Architecture build diagnosis, July 2026 · **User stories**: production iOS builds launch without an invalid TurboModule provider; E2E builds no longer mutate installed dependency metadata

## What to build

Replace the temporary generated-E2E workaround for the invalid `RNDatePickerManager` module provider with a production-safe dependency remediation. The selected package release, replacement, or repository-maintained patch must generate valid iOS New Architecture provider metadata, preserve existing date-picker behavior, and allow the temporary dependency mutation introduced by Task 0017 to be removed in the same change.

This task does not redesign date-picker UX or upgrade unrelated dependencies.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/06-code-health-and-maintainability.md`, `references/07-security.md`

- [ ] Select a maintained, reproducible remediation and commit the matching lockfile or repository patch.
- [ ] Verify dependency provenance, audit output, native codegen metadata, production New Architecture compilation, app launch, and representative date-picker behavior.
- [ ] Remove the temporary E2E mutation and stale troubleshooting instructions once production builds no longer require them.

## Implementation work

- [ ] Reproduce the invalid module-provider generation from a clean production-equivalent iOS prebuild before changing the dependency.
- [ ] Evaluate the smallest maintained remediation and record its package source, version or patch, native codegen declaration, and lockfile impact for approval.
- [ ] Add a regression that rejects the invalid date-picker TurboModule provider declaration or generated provider output.
- [ ] Apply the approved dependency remediation without unrelated package upgrades.
- [ ] Remove the generated-E2E dependency metadata mutation and update its runner tests.
- [ ] Run typecheck, warning-free lint, unit/component tests, dependency audit, clean iOS prebuild, and active-architecture simulator build.
- [ ] Launch the production-equivalent Debug app and open a representative screen that renders the date picker.
- [ ] Update E2E and developer documentation to remove the temporary workaround and retain useful native-build troubleshooting.

## Human checkpoints

- [ ] [confirm-security] Approve the exact package source/version, replacement, or repository patch after reviewing release provenance, lockfile changes, dependency audit output, and native codegen metadata.

## Acceptance criteria

- [ ] A clean production-equivalent iOS New Architecture build does not generate or register an invalid `RNDatePickerManager` module provider.
- [ ] The app launches on an iOS simulator and a representative date-picker screen opens and remains usable.
- [ ] The production dependency and lockfile are reproducible and the approved security review is recorded.
- [ ] Task 0017's generated dependency mutation is removed and its E2E build remains green.
- [ ] No unrelated dependency or date-picker UX change is included.
