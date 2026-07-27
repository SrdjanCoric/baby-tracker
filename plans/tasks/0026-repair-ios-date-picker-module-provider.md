# Task 0026: Repair the production iOS date-picker module provider

**Branch**: `feature/repair-ios-date-picker-module-provider`
**Depends on**: 0017
**Source**: Task 0017 iOS New Architecture build diagnosis, July 2026 · **User stories**: production iOS builds launch without an invalid TurboModule provider; E2E builds no longer mutate installed dependency metadata

## What to build

Replace the temporary generated-E2E workaround for the invalid `RNDatePickerManager` module provider with a production-safe dependency remediation. The selected package release, replacement, or repository-maintained patch must generate valid iOS New Architecture provider metadata, preserve existing date-picker behavior, and allow the temporary dependency mutation introduced by Task 0017 to be removed in the same change.

This task does not redesign date-picker UX or upgrade unrelated dependencies.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/06-code-health-and-maintainability.md`, `references/07-security.md`

- [x] Select a maintained, reproducible remediation and commit the matching lockfile or repository patch.
- [x] Verify dependency provenance, audit output, native codegen metadata, production New Architecture compilation, app launch, and representative date-picker behavior.
- [x] Remove the temporary E2E mutation and stale troubleshooting instructions once production builds no longer require them.

## Implementation work

- [x] Reproduce the invalid module-provider generation from a clean production-equivalent iOS prebuild before changing the dependency.
- [x] Evaluate the smallest maintained remediation and record its package source, version or patch, native codegen declaration, and lockfile impact for approval.
- [x] Add a regression that rejects the invalid date-picker TurboModule provider declaration or generated provider output.
- [x] Apply the approved dependency remediation without unrelated package upgrades.
- [x] Remove the generated-E2E dependency metadata mutation and update its runner tests.
- [x] Run typecheck, warning-free lint, unit/component tests, dependency audit, clean iOS prebuild, and active-architecture simulator build.
- [x] Launch the production-equivalent Debug app and open a representative screen that renders the date picker.
- [x] Update E2E and developer documentation to remove the temporary workaround and retain useful native-build troubleshooting.

## Human checkpoints

- [x] [confirm-security] Approve the exact package source/version, replacement, or repository patch after reviewing release provenance, lockfile changes, dependency audit output, and native codegen metadata.

## Acceptance criteria

- [x] A clean production-equivalent iOS New Architecture build does not generate or register an invalid `RNDatePickerManager` module provider.
- [x] The app launches on an iOS simulator and a representative date-picker screen opens and remains usable.
- [x] The production dependency and lockfile are reproducible and the approved security review is recorded.
- [x] Task 0017's generated dependency mutation is removed and its E2E build remains green.
- [x] No unrelated dependency or date-picker UX change is included.

## Completion record

### Implementation and decision

- Kept the official signed npm release `react-native-date-picker@5.0.13`, pinned it exactly in `package.json`, and retained the registry URL and SHA-512 integrity in `package-lock.json`.
- Added `scripts/apply-dependency-patches.mjs` as the repository-owned postinstall patch. It verifies the package name, version, component provider, and invalid module provider before removing only `ios.modulesProvider.RNDatePicker`.
- Preserved `ios.componentProvider.RNDatePicker`, so Fabric still registers the native view used by the app. The package's iOS JavaScript path continues to use `NativeModules` rather than the invalid TurboModule provider.
- Removed `e2e/scripts/prepare-e2e-dependencies.mjs` and all backup, restore, runner helper, and runner-test code for the generated-E2E mutation.
- Added the codegen and provenance regression to `scripts/date-picker-codegen.test.mjs` and the clean device flow to `e2e/flows/household-timers/date-picker.yaml`.
- The user approved this package source, exact version, lockfile impact, and repository patch after reviewing npm provenance, upstream state, and audit results. No security risk was accepted.
- Upstream `5.0.13` and upstream `master` still contain the invalid provider. The available fixes are unmerged and change TurboModule behavior beyond this app's component-only use, so the narrow repository patch was selected.

### Obstacles and review

- The baseline clean prebuild generated `@"RNDatePicker": @"RNDatePickerManager"` in `ios/build/generated/ios/RCTModuleProviders.mm`.
- The first complete production build was blocked by a missing watchOS simulator runtime. The user installed the matching runtime. The successful production build let Xcode select iOS and watchOS SDKs per target instead of forcing `-sdk iphonesimulator` across the embedded Watch app.
- The first clean E2E attempt hit a bounded Maestro process hang after a completed timer flow. A fast rerun completed the timer path and exposed an incorrect selector in the new date-picker flow. Stable IDs on the existing time and Done controls fixed the flow without changing UX.
- Task review used `base=main` with Standards, Spec, Bug, and Security lenses. The initial review and one remediation review pass ended with no findings, accepted risks, or blockers. Reviewed head: `75f6cfb`.

### Repository-guideline proof

- Loaded references `00`, `02`, `03`, `04`, `06`, and `07` in implement and review modes.
- Testing proof includes a codegen metadata regression, exact package provenance assertions, runner contract tests, the full non-device suite, a production New Architecture build, and two-simulator behavior.
- Developer-environment proof is the exact dependency declaration, matching lockfile, and successful fresh `npm ci` postinstall patch.
- Security proof is the official registry source and integrity, unchanged dependency graph, approved high/critical advisory policy, and successful `npm run audit:dependencies`.
- Documentation proof is the updated Testing section in `README.md` and the patch troubleshooting and clean-gate contract in `e2e/README.md`. The write-well audit completed in two passes with no remaining findings.

### Verification

- `npm ci`: passed and applied the repository patch automatically.
- Clean `EXPO_NO_DOTENV=1 npx expo prebuild --platform ios --clean`: passed; `RCTModuleProviders.mm` contains no date-picker module mapping while `RCTThirdPartyComponentsProvider.mm` retains `RNDatePicker`.
- Production-equivalent New Architecture Debug simulator build with embedded Watch targets and `ONLY_ACTIVE_ARCH=YES`: passed on Xcode 26.6 with iOS and watchOS 26.5 runtimes.
- `npm run check`: passed, including warning-free lint, strict typecheck, 2,266 unit tests, 640 component tests, 103 security tests, 243 sync tests, 49 CI contract tests, 58 local migrations, and all SQL checks.
- `npm run audit:dependencies`: passed with no unapproved high or critical advisory.
- `npm run e2e:household-timers:test`: passed, 9 tests.
- `npm run e2e:household-timers`: passed after selector remediation.
- `npm run e2e:household-timers:clean`: passed from clean install, prebuild, compile, install, and launch through the timer handoff and native date-picker flow. Artifact: `e2e/artifacts/household-timers/2026-07-27T07-57-18-130Z`.
