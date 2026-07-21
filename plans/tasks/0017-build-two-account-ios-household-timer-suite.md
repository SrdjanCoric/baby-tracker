# Task 0017: Build a maintainable two-account iOS sleep-timer smoke suite

**Branch**: `feature/ios-household-timer-suite`
**Depends on**: 0014, 0015, 0016
**Source**: release review and test-maintainability conversations, July 2026 · **User stories**: two caregivers can verify household timer ownership on separate iOS simulators; developers can rerun behavior without rebuilding iOS; tests use local Supabase and never production data

## What to build

Create a repeatable local iOS runner that signs two seeded caregivers from one household into separate simulators against Docker-hosted local Supabase. Use one short sleep-timer handoff as the representative end-to-end proof of the shared household timer contract:

1. The owner starts sleep.
2. The member observes the lock and cannot start sleep.
3. The owner stops; the member observes the unlock.
4. The member starts sleep.
5. The owner observes the lock.
6. The member stops; the owner observes the unlock.
7. Local database assertions find one completion from each caregiver and no stale sleep lock.

Separate fast behavioral validation from clean native provisioning. The normal command must reuse an installed E2E app while deterministically clearing simulator state. A separate clean command must reset local Supabase, generate and build iOS, install the app on both simulators, run the same smoke scenario, capture diagnostics, and clean up.

Feeding, pumping, and tummy-time do not run through the two-simulator UI suite. Their shared completion, retry, restoration, and stale-lock behavior remains covered by component and real-provider integration tests. Add any missing generic dashboard lock regression, retain the pumping compact-row regression, and remove the obsolete multi-activity Maestro matrix rather than leaving stale optional flows.

The generated E2E bundle may reduce the timer completion minimum so the smoke does not wait for production duration thresholds. Production builds must retain the existing 60-second rule.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/04-developer-environment.md`, `references/06-code-health-and-maintainability.md`, `references/08-recommended-canonical-commands.md`

- [ ] Keep the smoke deterministic, isolated from production services and personal accounts, independent of execution order, and backed by real assertions.
- [ ] Expose documented fast and clean commands from the repository root; both must fail on an assertion, provisioning, or cleanup error.
- [ ] Document prerequisites, local-only safeguards, generated-test-build boundaries, diagnostics, cleanup behavior, and the measured fast-run duration.
- [ ] Remove superseded Maestro flows and runner branches so the maintained command and documentation describe one suite.

## Implementation work

- [ ] Repair the idempotent local fixtures and cleanup path for two authenticated household caregivers and at least two babies.
- [ ] Keep local-only endpoint checks and compile local Supabase values only into generated E2E bundle state.
- [ ] Make the runner create or select, boot, install, and address the two named iOS simulators independently.
- [ ] Implement the sleep start, remote lock rejection, stop/unlock, reverse-caregiver handoff, and database assertions test-first.
- [ ] Add a fast command that resets simulator and scenario state without dependency installation, migration, native generation, Pods, or Xcode compilation.
- [ ] Add a clean command that provisions local Supabase and fixtures, builds only the active simulator architecture, installs once on both simulators, runs the smoke, and performs bounded cleanup.
- [ ] Give Maestro a bounded iOS driver startup allowance; do not hide assertions or indefinite flakiness behind retries.
- [ ] Preserve actionable logs, screenshots, app logs, database rows, Supabase logs, and cleanup results on failure.
- [ ] Add or retain component/provider regressions proving the omitted activity types use the shared lock and idempotent completion behavior.
- [ ] Delete unused feeding, pumping, tummy-time, pause/resume, restart, offline, foreground, and baby-targeting Maestro matrix branches that are no longer part of the smoke.
- [ ] Update the root README and E2E documentation with the layered coverage model and canonical commands.
- [ ] Run one fast behavioral proof and record a duration under four minutes on the documented local setup.
- [ ] Run the clean command once after the fast path is green and before requesting PR approval.

## Human checkpoints

- [x] [verify] Accept and initialize Xcode in Terminal · Expected: `xcodebuild -version` and `xcrun simctl list runtimes` run without a license error · Failure: either command reports an unaccepted license or no iOS runtime · Reason: accepting Apple's license requires the local administrator password and cannot be automated by the agent.

## Acceptance criteria

- [ ] `npm run e2e:household-timers` runs only the fast sleep handoff against an installed app and completes in under four minutes on the documented local setup.
- [ ] `npm run e2e:household-timers:clean` provisions local Supabase, two users, two simulators, and the app without production credentials, then runs the same smoke and cleans up.
- [ ] The second caregiver cannot start sleep while the first caregiver owns its lock, and both caregivers observe lock and unlock transitions.
- [ ] Exactly one completed sleep belongs to each caregiver and no sleep lock remains after the handoff.
- [ ] The generated E2E bundle can complete immediately while production retains the 60-second minimum.
- [ ] Feeding, pumping, and tummy-time shared behavior remains covered by passing component/provider tests without dedicated household Maestro flows.
- [ ] The obsolete multi-activity Maestro matrix is removed.
- [ ] Failures exit nonzero and produce actionable local diagnostics; cleanup is bounded and restores a paused local API container.
