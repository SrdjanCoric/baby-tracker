# Task 0023: Make the iOS E2E workflow reliable

**Branch**: `feature/reliable-ios-e2e-workflow`
**Depends on**: 0017, 0022
**Source**: release review conversation, July 2026 · **User stories**: a reported green iOS E2E run means the app built, test users existed, maintained flows ran, and assertions passed

## What to build

Replace the ineffective iOS E2E path with one supported workflow based on task 0017's local household runner. Pin a simulator and toolchain available on the selected GitHub macOS image, seed real local auth users, build and install the app at a known path, run maintained suites, and fail the workflow when Maestro fails.

Upload logs, screenshots, JUnit output, local Supabase diagnostics, and build details on failure. Android E2E changes are outside this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/10-definition-of-done.md`

- [ ] Use controlled fixtures, pinned tools, deterministic test discovery, and failure propagation.
- [ ] Document when the workflow runs, how to dispatch it, and how to reproduce failures locally.

## Before implementation

Verify the local runner from task 0017 before changing CI.

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
```

Run task 0017's canonical two-account iOS command once and retain its result as the local baseline. Do not configure CI until the workflow cadence decision below is resolved.

## Implementation work

- [ ] Remove or disable conflicting unsupported E2E jobs and retain one authoritative iOS path.
- [ ] Select the simulator from installed runtimes instead of assuming an unavailable device name.
- [ ] Seed auth users and household data through the maintained local fixture command.
- [ ] Install the built app from an explicit derived-data location.
- [ ] Remove `continue-on-error` from test execution and preserve diagnostics with `if: always()` uploads.
- [ ] Run the household timer smoke suite and a maintained general smoke suite.

## Human checkpoints

- [ ] [decision] Choose the macOS workflow cadence through `talk-it-through`: every pull request, scheduled plus pre-release, or manual pre-release only. Include runner cost, feedback time, and release risk in the decision.

## Acceptance criteria

- [ ] A workflow dispatch builds and tests the iOS app against CI-owned local Supabase.
- [ ] Missing users, build failure, assertion failure, or Maestro failure makes the workflow fail.
- [ ] A successful run includes the two-account household timer smoke scenario.
- [ ] Failure artifacts identify the simulator, app build, flow, and local service state.
