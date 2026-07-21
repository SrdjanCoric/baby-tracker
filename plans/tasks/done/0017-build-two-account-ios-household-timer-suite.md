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

- [x] Keep the smoke deterministic, isolated from production services and personal accounts, independent of execution order, and backed by real assertions.
- [x] Expose documented fast and clean commands from the repository root; both must fail on an assertion, provisioning, or cleanup error.
- [x] Document prerequisites, local-only safeguards, generated-test-build boundaries, diagnostics, cleanup behavior, and the measured fast-run duration.
- [x] Remove superseded Maestro flows and runner branches so the maintained command and documentation describe one suite.

## Implementation work

- [x] Repair the idempotent local fixtures and cleanup path for two authenticated household caregivers and at least two babies.
- [x] Keep local-only endpoint checks and compile local Supabase values only into generated E2E bundle state.
- [x] Make the runner create or select, boot, install, and address the two named iOS simulators independently.
- [x] Implement the sleep start, remote lock rejection, stop/unlock, reverse-caregiver handoff, and database assertions test-first.
- [x] Add a fast command that resets simulator and scenario state without dependency installation, migration, native generation, Pods, or Xcode compilation.
- [x] Add a clean command that provisions local Supabase and fixtures, builds only the active simulator architecture, installs once on both simulators, runs the smoke, and performs bounded cleanup.
- [x] Give Maestro a bounded iOS driver startup allowance; do not hide assertions or indefinite flakiness behind retries.
- [x] Preserve actionable logs, screenshots, app logs, database rows, Supabase logs, and cleanup results on failure.
- [x] Add or retain component/provider regressions proving the omitted activity types use the shared lock and idempotent completion behavior.
- [x] Delete unused feeding, pumping, tummy-time, pause/resume, restart, offline, foreground, and baby-targeting Maestro matrix branches that are no longer part of the smoke.
- [x] Update the root README and E2E documentation with the layered coverage model and canonical commands.
- [x] Run one fast behavioral proof and record a duration under four minutes on the documented local setup.
- [x] Run the clean command once after the fast path is green and before requesting PR approval.

## Human checkpoints

- [x] [verify] Accept and initialize Xcode in Terminal · Expected: `xcodebuild -version` and `xcrun simctl list runtimes` run without a license error · Failure: either command reports an unaccepted license or no iOS runtime · Reason: accepting Apple's license requires the local administrator password and cannot be automated by the agent.

## Acceptance criteria

- [x] `npm run e2e:household-timers` runs only the fast sleep handoff against an installed app and completes in under four minutes on the documented local setup.
- [x] `npm run e2e:household-timers:clean` provisions local Supabase, two users, two simulators, and the app without production credentials, then runs the same smoke and cleans up.
- [x] The second caregiver cannot start sleep while the first caregiver owns its lock, and both caregivers observe lock and unlock transitions.
- [x] Exactly one completed sleep belongs to each caregiver and no sleep lock remains after the handoff.
- [x] The generated E2E bundle can complete immediately while production retains the 60-second minimum.
- [x] Feeding, pumping, and tummy-time shared behavior remains covered by passing component/provider tests without dedicated household Maestro flows.
- [x] The obsolete multi-activity Maestro matrix is removed.
- [x] Failures exit nonzero and produce actionable local diagnostics; cleanup is bounded and restores a paused local API container.

## Completion record

### Implementation and decisions

- `e2e/scripts/run-household-timers.mjs` owns the fast and clean paths. The default command reuses an installed app; `--clean` resets local Supabase, generates iOS, builds arm64 once, and installs the same app on both named simulators.
- `e2e/fixtures/seed-data.sql`, `cleanup.sql`, and `verify-household-timer-fixtures.sql` create and verify two caregivers in one household with two babies. Seeding passed twice in succession.
- The login flow selects the primary fixture baby explicitly because household baby fetch order is not stable after simulator state is cleared.
- E2E launch mode exposes a sleep-sheet close control because simulator swipe recognition was intermittent. The native production sheet is unchanged.
- Clean provisioning backs up and restores the temporary `react-native-date-picker` package metadata patch. The final backup matched the restored file byte for byte.
- The dashboard card and pumping compact row expose locked and owned states through stable test IDs with non-actionable locked controls. Existing real-provider tests remain the coverage for feeding, pumping, and tummy-time completion recovery.

### Repository guidelines and review

- Implement and review modes loaded `00-overview`, `02-testing`, `03-documentation`, `04-developer-environment`, `06-code-health-and-maintainability`, and `08-recommended-canonical-commands`.
- Proof covers deterministic local fixtures, root commands with real assertions and nonzero failures, locked dependency installation, bounded cleanup, local-only service checks, current documentation, and removal of the superseded matrix.
- Task review completed in two remediation passes. It found no unresolved security issue or accepted risk. Remediation moved the endpoint check before database reset, made simulator cleanup failures fatal, restored patched dependency metadata, preserved unrelated codegen providers, and aligned IPv6 loopback handling with the documentation.
- `README.md` Testing and `e2e/README.md` were updated. The write-well audit completed in three passes.

### Verification

- `npm run typecheck` and `npm run lint` passed.
- `npm run test:unit`: 102 files and 2,221 tests passed.
- `npm run test:component -- --runInBand`: 50 suites and 622 tests passed, including the real timer providers and compact pumping row.
- `npm run e2e:household-timers:test`: 11 orchestration tests passed. Shell, Node, Ruby syntax checks and `git diff --check` also passed.
- `npm run e2e:household-timers:clean` passed from locked dependency install through database cleanup, native generation, arm64 build, two-simulator handoff, dependency restoration, and simulator shutdown. Final artifact: `e2e/artifacts/household-timers/2026-07-21T20-14-42-881Z/`.
- A run started with the local Supabase API container paused, restored it to `Paused=false`, produced one owner and one member completion, and left zero sleep locks.
- Final warm fast proof completed in 3 minutes 4 seconds. Artifact: `e2e/artifacts/household-timers/2026-07-21T20-28-51-897Z/`.
