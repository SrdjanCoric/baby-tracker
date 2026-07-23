# Task 0025: Remediate dependency vulnerabilities

**Branch**: `feature/remediate-dependency-vulnerabilities`
**Depends on**: 0022
**Source**: release review conversation, July 2026 · **User stories**: shipped and build dependencies have no unreviewed critical or high advisories; future vulnerable changes are visible in CI

## What to build

Triage the critical and high advisories reported by the release-review `npm audit`. Identify whether each path is shipped runtime code, build tooling, development-only tooling, or unreachable transitive code. Apply compatible upgrades, overrides, or package removal where supported. Do not force an Expo SDK major upgrade without a separate approved decision.

Establish a CI dependency check with a documented process for temporary, narrowly scoped exceptions. Record package path, exposure, upstream status, expiry, and owner for any accepted advisory. Add scheduled dependency update automation at a cadence that the existing CI can validate.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/06-code-health-and-maintainability.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Review dependency changes deliberately, keep the lock file reproducible, and validate mobile builds and tests.
- [x] Make high-severity findings fail CI or enter a documented remediation process with an expiry.

## Before implementation

Capture the locked dependency and security baseline before changing package metadata.

```bash
git status --short --branch
npm ci
npm audit --audit-level=high || true
npm outdated || true
npx expo-doctor
npm run typecheck
npm run lint
```

Save the full dependency paths for critical and high findings. Do not run `npm audit fix --force` or apply an Expo SDK major upgrade without the checkpoints below.

## Implementation work

- [x] Capture the current audit report and dependency paths from a clean locked install.
- [x] Classify runtime, build-time, development-only, exploitable, and non-exploitable exposure with evidence.
- [x] Apply supported non-breaking updates or overrides and run Expo compatibility checks.
- [x] Escalate any required major SDK upgrade through `talk-it-through` rather than applying it implicitly.
- [x] Add CI dependency auditing and scheduled update pull requests.
- [x] Document any temporary exception with scope, reason, upstream reference, owner, and expiry.

## Human checkpoints

- [x] [confirm-security] Approve dependency trust changes and every temporary critical or high advisory exception before merge.

## Acceptance criteria

- [x] No critical or high advisory remains unremediated or undocumented with explicit approval.
- [x] Dependency installation remains locked and reproducible.
- [x] Type checking, lint, all automated tests, Expo compatibility checks, and an iOS build pass.
- [x] CI reports future high-severity dependency findings and scheduled updates receive normal validation.

## Implementation record

### Baseline and exposure

A clean npm 10.8.2 install reported 40 advisories: 3 critical, 17 high, 18 moderate, and 2 low. The critical and high package locations were:

- `@isaacs/brace-expansion`: `node_modules/@isaacs/brace-expansion`. Expo config glob processing, build-time only.
- `@xmldom/xmldom`: `node_modules/@bacons/xcode/node_modules/@xmldom/xmldom`, `node_modules/@xmldom/xmldom`. Apple target and Expo plist parsing, build-time only.
- `brace-expansion`: `node_modules/@eslint/config-array/node_modules/brace-expansion`, `node_modules/@eslint/eslintrc/node_modules/brace-expansion`, `node_modules/@expo/cli/node_modules/brace-expansion`, `node_modules/@expo/fingerprint/node_modules/brace-expansion`, `node_modules/@expo/metro-config/node_modules/brace-expansion`, `node_modules/@jest/reporters/node_modules/brace-expansion`, `node_modules/@react-native/codegen/node_modules/brace-expansion`, `node_modules/brace-expansion`, `node_modules/eslint-plugin-react/node_modules/brace-expansion`, `node_modules/eslint/node_modules/brace-expansion`, `node_modules/jest-config/node_modules/brace-expansion`, `node_modules/jest-runtime/node_modules/brace-expansion`, `node_modules/react-native/node_modules/brace-expansion`, `node_modules/rimraf/node_modules/brace-expansion`, `node_modules/test-exclude/node_modules/brace-expansion`. Build, lint, and test glob processing. Inputs come from repository paths and patterns.
- `fast-uri`: `node_modules/fast-uri`. `expo-build-properties > ajv > fast-uri`, build-time schema validation.
- `flatted`: `node_modules/flatted`. ESLint cache serialization, development-only.
- `form-data`: `node_modules/form-data`. `vitest > jsdom > form-data`, test-only.
- `js-yaml`: `node_modules/@istanbuljs/load-nyc-config/node_modules/js-yaml`, `node_modules/js-yaml`. ESLint, Jest coverage config, and Expo CLI YAML parsing. Repository-controlled input.
- `lodash`: `node_modules/lodash`. Jest Expo tooling, test-only.
- `minimatch`: `node_modules/@eslint/config-array/node_modules/minimatch`, `node_modules/@eslint/eslintrc/node_modules/minimatch`, `node_modules/@expo/config-plugins/node_modules/minimatch`, `node_modules/@expo/config/node_modules/minimatch`, `node_modules/@jest/reporters/node_modules/minimatch`, `node_modules/@react-native/codegen/node_modules/minimatch`, `node_modules/eslint-plugin-react/node_modules/minimatch`, `node_modules/eslint/node_modules/minimatch`, `node_modules/glob/node_modules/minimatch`, `node_modules/jest-config/node_modules/minimatch`, `node_modules/jest-runtime/node_modules/minimatch`, `node_modules/minimatch`, `node_modules/react-native/node_modules/minimatch`, `node_modules/rimraf/node_modules/minimatch`, `node_modules/test-exclude/node_modules/minimatch`. Build, lint, and test glob processing. Inputs come from repository paths and patterns.
- `picomatch`: `node_modules/anymatch/node_modules/picomatch`, `node_modules/jest-util/node_modules/picomatch`, `node_modules/micromatch/node_modules/picomatch`, `node_modules/readdirp/node_modules/picomatch`. Tailwind watch and Jest tooling, development-only.
- `postcss`: `node_modules/postcss`, `node_modules/vite/node_modules/postcss`. Metro, Tailwind, and Vitest CSS processing. Build and test input is repository-controlled.
- `rollup`: `node_modules/rollup`. Vitest and Vite test tooling, development-only.
- `shell-quote`: `node_modules/shell-quote`. `react-native > react-devtools-core > shell-quote`, debug tooling. The vulnerable object operator input is not built from app user data.
- `tar`: `node_modules/tar`. `expo > @expo/cli > tar`, build and package tooling.
- `undici`: `node_modules/undici`. `expo > @expo/cli > undici`, build and development network tooling.
- `vite`: `node_modules/vite`. Vitest dev server tooling. The repository runs `vitest run` and does not expose the Vite server.
- `vitest`: `node_modules/vitest`. Test-only. The vulnerable UI server is not enabled by repository scripts.
- `ws`: `node_modules/@react-native/dev-middleware/node_modules/ws`, `node_modules/metro/node_modules/ws`, `node_modules/react-devtools-core/node_modules/ws`, `node_modules/react-native/node_modules/ws`, `node_modules/ws`. Most paths are development middleware. `@supabase/supabase-js > @supabase/realtime-js > ws` is a production dependency, but React Native uses its global WebSocket implementation instead of the Node fallback. Every path was patched despite that limited exposure.

No critical or high path remained after remediation. The remaining 18 advisories are moderate. npm proposes breaking framework or direct-dependency changes for the remaining `uuid` and `yaml` reports, so this task did not use `npm audit fix --force`.

### Implementation and decisions

- Refreshed the npm 10.8.2 lockfile with compatible registry releases and aligned four direct packages with Expo SDK 54: `expo-image-picker`, `expo-localization`, `expo-router`, and `react-native-gesture-handler`.
- Kept Expo on SDK 54. The user approved exact overrides for `postcss@8.5.22` and `@xmldom/xmldom@0.8.13` after the compatible lock refresh left four high findings. The plist parser uses the `DOMParser.parseFromString` API retained by xmldom 0.8. A plist round-trip through `@bacons/xcode` and the iOS workspace build passed.
- Added `npm run audit:dependencies`, the required `Dependency audit` CI job, and aggregate-job enforcement. `.github/dependency-audit-exceptions.json` is empty.
- Added weekly npm and monthly GitHub Actions updates in `.github/dependabot.yml`.
- Documented triage and exception rules in `docs/DEPENDENCY_SECURITY.md`. Exceptions require security approval, complete review metadata, a future expiry, and an exact match against the current advisory package and installed paths.

### Repository-guideline proof

Loaded `00-overview`, `02-testing`, `04-developer-environment`, `05-ci-cd`, `06-code-health-and-maintainability`, `07-security`, and `10-definition-of-done` in implementation and review modes.

- Testing: `scripts/dependency-security.test.mjs` covers blocking findings, exact exceptions, path changes, expiry, malformed metadata, stale entries, and Dependabot cadence. CI contract tests cover the required audit job and aggregate failure handling.
- Developer environment: `package-lock.json` was generated and reinstalled with npm 10.8.2. CI continues to use `npm ci` on pinned Node 20.19.4.
- CI and security: pull requests and `main` run the audit as a required job. High and critical findings fail unless an active reviewed exception matches them.
- Maintainability: Dependabot opens weekly npm updates and monthly GitHub Actions updates for normal pull-request validation.
- Documentation: `README.md` lists the audit command and CI behavior; `docs/DEPENDENCY_SECURITY.md` defines triage and exception handling.

### Review and documentation

Task review used `base=main` with initial head `64dea16`. It found one major security issue: an exception could suppress a new path for the same package and advisory. The user approved remediation. Final reviewed head `4e1d45f` requires dependency paths to match the current audit exactly. The first remediation pass then completed without remaining standards, spec, bug, or security findings. No security risk was accepted.

The README testing command list and CI paragraph were updated after review. The `write-well` audit completed in one clean pass for the README and implementation record. The dependency security guide required two passes; the second pass found no further issues.

### Final proof

- `npx --yes npm@10.8.2 ci`: passed from the committed lockfile; 1,302 packages installed.
- `npm run audit:dependencies`: passed with no unapproved high or critical advisory.
- `npx --no-install expo install --check`: passed with dependencies compatible with Expo SDK 54.
- `npm run check`: passed. This included warning-free lint, strict type checking, 2,261 unit tests, 638 component tests, 103 security tests, 243 sync tests, 45 CI contract tests, 26 SQL vectors in both orders, 45 merge assertions, authorization checks, and concurrency checks against isolated local Supabase.
- `npx --no-install expo-doctor`: 16 of 18 checks passed. Dependency compatibility passed. The two pre-existing failures are the non-square configured icons and missing New Architecture metadata for `react-native-launch-arguments`.
- A Node assertion built and parsed a plist through `@bacons/xcode` and its overridden xmldom dependency.
- `pod install`: installed the updated Expo SDK 54 and React Native native packages.
- `xcodebuild -workspace ios/SofiBabyTracker.xcworkspace -scheme SofiBabyTracker -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build/task-0025-derived-data CODE_SIGNING_ALLOWED=NO build`: passed with `BUILD SUCCEEDED`.

No manual verification was required because the dependency policy, compatibility check, complete test suite, and iOS build were automated.
