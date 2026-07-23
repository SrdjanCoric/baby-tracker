# Task 0023: Make the iOS E2E release gate reliable

**Branch**: `feature/reliable-ios-e2e-workflow`
**Depends on**: 0017, 0022
**Source**: release review conversation, July 2026 · **User stories**: a reported iOS E2E result means the app built, local test users existed, the maintained two-account flow ran, and its assertions passed

## What to build

Retire the ineffective GitHub-hosted iOS E2E job and make task 0017's clean local household runner the authoritative pre-release iOS device gate. The gate must build and install the app, seed real local auth users, run the maintained two-account sleep-timer scenario, fail on provisioning or assertion errors, and retain actionable diagnostics.

Do not replace local Supabase with a remote test service. GitHub-hosted ARM64 macOS runners do not support the virtualization required by Supabase's Docker-based local stack. A remote branch would add privileged secrets and would not exercise the same offline scenario. Android E2E behavior remains outside this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/10-definition-of-done.md`

- [x] Keep the local gate deterministic, controlled, and failure-propagating.
- [x] Document when to run it, its prerequisites, and where to find failure evidence.
- [x] Prevent CI from reporting a misleading green iOS E2E result.

## Before implementation

Verify task 0017's local runner before changing workflow or release documentation.

```bash
git status --short --branch
xcodebuild -version
xcrun --find simctl
xcrun simctl list runtimes
docker info
npm ci
npx supabase start
npx supabase status
command -v maestro || true
npm run e2e:seed
npm run e2e:household-timers
```

## Implementation work

- [x] Remove the unsupported GitHub-hosted iOS E2E job without changing Android E2E behavior.
- [x] Add a workflow contract test that prevents an ineffective iOS device job from returning.
- [x] Keep `npm run e2e:household-timers:clean` as the one authoritative clean iOS device command.
- [x] Document the local pre-release requirement, prerequisites, failure behavior, and artifacts.

## Human checkpoints

- [x] [decision] Keep iOS device E2E local rather than introducing a self-hosted Mac or remote Supabase branch. GitHub-hosted ARM64 macOS cannot run the required Docker stack; local proof preserves the exact offline scenario without CI secrets or runner maintenance.

## Acceptance criteria

- [x] No GitHub Actions job claims to run iOS device E2E.
- [x] The documented pre-release command provisions local Supabase, fixture users, two simulators, and the app before running the household timer scenario.
- [x] Missing users, build failure, assertion failure, Maestro failure, or cleanup failure makes the local command fail.
- [x] Failure artifacts identify the simulator, app build, flow, and local service state.

## Implementation record

- Baseline on 2026-07-23 passed with Xcode 26.6, iOS 26.5, Docker 29.6.1, Maestro 2.7.0, locked npm dependencies, local Supabase, seeded auth users, and the complete fast two-caregiver handoff.
- Research used GitHub's hosted-runner and self-hosted-runner guidance plus Supabase's local-development and branching documentation. GitHub-hosted ARM64 macOS does not support nested virtualization; Supabase local development requires a Docker-compatible container runtime.
- `.github/workflows/e2e.yml` is now Android-only. `scripts/e2e-release-gate.test.mjs` rejects macOS jobs in that workflow and verifies the root clean command. `npm run test:ci` runs this contract on pull requests and `main`.
- TDD used two RED to GREEN cycles: removing the misleading iOS job while retaining Android, then registering the canonical clean command contract in CI. Task review fixed one minor Standards finding by making the guard reject any renamed macOS job. The second review panel found no Spec, Bug, Standards, or Security findings. No security risk was accepted.
- Implement and review modes loaded `00-overview`, `02-testing`, `03-documentation`, `04-developer-environment`, `05-ci-cd`, and `10-definition-of-done`. Repository proof covers locked dependencies, controlled local fixtures, nonzero failure propagation, deterministic workflow checks, documented prerequisites, and release evidence.
- The Testing section in `README.md` and the introduction and pre-release gate in `e2e/README.md` now require the clean command before each iOS release and explain why it stays local. The write-well audit completed in two passes.
- `npm run check:code` passed with 2,261 unit tests, 638 component tests, 103 focused security tests, 243 focused sync tests, and 17 CI contract tests. The 12 household-runner orchestration tests, lint, typecheck, workflow YAML parsing, syntax checks, and diff checks also passed.
- `npm run e2e:household-timers:clean` passed on Xcode 26.6 and iOS 26.5. It installed locked dependencies, reset and migrated local Supabase, created three fixture users, built the app, ran the two-caregiver offline handoff, removed all fixture users and sleep locks, shut down both simulators, restored dependency metadata, and left the local API running. Artifact: `e2e/artifacts/household-timers/2026-07-23T07-09-34-853Z/`.
