# Task 0023: Make the iOS E2E release gate reliable

**Branch**: `feature/reliable-ios-e2e-workflow`
**Depends on**: 0017, 0022
**Source**: release review conversation, July 2026 · **User stories**: a reported iOS E2E result means the app built, local test users existed, the maintained two-account flow ran, and its assertions passed

## What to build

Retire the ineffective GitHub-hosted iOS E2E job and make task 0017's clean local household runner the authoritative pre-release iOS device gate. The gate must build and install the app, seed real local auth users, run the maintained two-account sleep-timer scenario, fail on provisioning or assertion errors, and retain actionable diagnostics.

Do not replace local Supabase with a remote test service. GitHub-hosted ARM64 macOS runners do not support the virtualization required by Supabase's Docker-based local stack. A remote branch would add privileged secrets and would not exercise the same offline scenario. Android E2E behavior remains outside this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/10-definition-of-done.md`

- [ ] Keep the local gate deterministic, controlled, and failure-propagating.
- [ ] Document when to run it, its prerequisites, and where to find failure evidence.
- [ ] Prevent CI from reporting a misleading green iOS E2E result.

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

- [ ] Remove the unsupported GitHub-hosted iOS E2E job without changing Android E2E behavior.
- [ ] Add a workflow contract test that prevents an ineffective iOS device job from returning.
- [ ] Keep `npm run e2e:household-timers:clean` as the one authoritative clean iOS device command.
- [ ] Document the local pre-release requirement, prerequisites, failure behavior, and artifacts.

## Human checkpoints

- [x] [decision] Keep iOS device E2E local rather than introducing a self-hosted Mac or remote Supabase branch. GitHub-hosted ARM64 macOS cannot run the required Docker stack; local proof preserves the exact offline scenario without CI secrets or runner maintenance.

## Acceptance criteria

- [ ] No GitHub Actions job claims to run iOS device E2E.
- [ ] The documented pre-release command provisions local Supabase, fixture users, two simulators, and the app before running the household timer scenario.
- [ ] Missing users, build failure, assertion failure, Maestro failure, or cleanup failure makes the local command fail.
- [ ] Failure artifacts identify the simulator, app build, flow, and local service state.

## Implementation record

- Baseline on 2026-07-23 passed with Xcode 26.6, iOS 26.5, Docker 29.6.1, Maestro 2.7.0, locked npm dependencies, local Supabase, seeded auth users, and the complete fast two-caregiver handoff.
- Research used GitHub's hosted-runner and self-hosted-runner guidance plus Supabase's local-development and branching documentation. GitHub-hosted ARM64 macOS does not support nested virtualization; Supabase local development requires a Docker-compatible container runtime.
