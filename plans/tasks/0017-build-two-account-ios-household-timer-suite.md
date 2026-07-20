# Task 0017: Build a two-account iOS household timer suite

**Branch**: `feature/ios-household-timer-suite`
**Depends on**: 0014, 0015, 0016
**Source**: release review conversation, July 2026 · **User stories**: two caregivers can verify household timers on separate iOS simulators; tests use local Supabase and never production data

## What to build

Create a repeatable local iOS test runner that boots two simulators, installs the same development build, signs in two seeded users from one household, and drives household timer scenarios against Docker-hosted local Supabase. Repair the fixtures so auth users, profiles, household membership, and babies are created consistently.

Cover feeding, sleep, pumping, and tummy time. For each applicable timer, verify start exclusivity, remote in-use display, pause and resume propagation, one-stop completion, unlock propagation, caregiver handoff, app foregrounding, restart, offline stop and reconnect, and baby targeting. Record any newly reproduced product defect as a proposed master-plan task rather than silently expanding this test task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/08-recommended-canonical-commands.md`, `references/10-definition-of-done.md`

- [ ] Use isolated local fixtures, deterministic cleanup, documented prerequisites, and a root command for the suite.
- [ ] Keep the tests independent of production services, personal accounts, execution order, and undocumented simulator state.

## Before implementation

Accept and initialize Xcode from Terminal, then verify the local-only test prerequisites.

```bash
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
xcodebuild -version
xcrun --find simctl
xcrun simctl list runtimes
docker info
npm ci
npx supabase start
npx supabase status
```

Stop if no iOS Simulator runtime is installed. Confirm Supabase reports local URLs on `127.0.0.1` before creating users or running the app. Never substitute production credentials.

## Implementation work

- [ ] Add an idempotent local seed and cleanup path for two authenticated household caregivers and at least two babies.
- [ ] Add a runner that selects, boots, installs, and addresses two named iOS simulators independently.
- [ ] Add Maestro flows or an equivalent deterministic driver for the household timer matrix.
- [ ] Include network interruption, foreground, restart, and repeated-stop scenarios.
- [ ] Capture logs, screenshots, local database assertions, and cleanup results on failure.
- [ ] Document the canonical setup and run commands without machine-specific absolute paths.

## Human checkpoints

- [ ] [verify] Run `sudo xcodebuild -license accept` in Terminal before implementation · Expected: `xcodebuild -version` and `xcrun simctl list` run without a license error · Failure: either command still reports an unaccepted license · Reason: accepting Apple's license requires the local administrator password and cannot be automated by the agent.

## Acceptance criteria

- [ ] One root command provisions local Supabase, two users, two simulators, and the app without production credentials.
- [ ] Both caregivers observe timer state transitions and one completed activity for each tested flow.
- [ ] The second caregiver cannot start an activity type while the first caregiver owns its lock.
- [ ] Offline and restart scenarios leave one activity and no stale household lock after recovery.
- [ ] The runner cleans up local data and produces actionable diagnostics when a step fails.
