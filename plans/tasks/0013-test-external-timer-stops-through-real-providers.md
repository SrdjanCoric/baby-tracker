# Task 0013: Test external timer stops through real providers

**Branch**: `feature/external-timer-stop-provider-regressions`
**Depends on**: none
**Source**: verification review 2026-07-14 · **User stories**: maintainers can change timer restoration code and know that widget or Live Activity stops still record one activity; native stop-command ordering is checked automatically

## What to build

Add regression coverage that drives pending external stops through the production feeding, sleep,
pumping, and tummy-time providers. The tests must exercise provider restoration, stop coordination,
local timer storage, and server-lock outcomes without copying the guard logic into the test. Add an
automated contract check for the iOS stop intent so pending command persistence remains ordered
before server lock release. Fix any production defect exposed by these tests within this task.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Use the repository's established component and integration test conventions with deterministic storage, lock, and clock controls.
- [x] Verify production provider behavior rather than a synthetic timer context or a reimplementation of the restoration condition.
- [x] Cover critical races and failure paths without adding flaky timing waits or order-dependent tests.
- [x] Record focused native/provider proof and the canonical unit, component, lint, and typecheck results.

## AFK tasks

- [x] Add failing provider-level regressions for a pending stop restored after the external command released its server lock.
- [x] Cover stop-versus-restore races for feeding, sleep, pumping, and tummy time by controlling the asynchronous storage and lock boundaries.
- [x] Verify repeated delivery, stale commands, newer timers, sub-minute discard, and compare-and-clear behavior through public provider operations.
- [x] Prove that each successful external stop creates at most one completed activity and cannot resurrect the timer after stop begins.
- [x] Add an automated iOS intent contract test or compile-level check that fails if lock release can run before the baby-targeted pending stop is persisted.
- [x] Remove or replace synthetic tests that claim integration coverage without exercising production providers when they no longer add distinct value.

## Acceptance criteria

- [x] Removing a provider restoration guard or pending-stop bypass makes a regression test fail.
- [x] All four timer providers consume a matching cold-start stop at its recorded timestamp after the server lock is gone.
- [x] A stale or repeated command cannot stop a newer timer or create a duplicate activity.
- [x] An asynchronous restore cannot re-enable a timer once stopping has started or completed.
- [x] The iOS stop intent's persist-before-release ordering has automated proof.
- [x] Focused regressions and the full canonical validation commands pass.

## Implementation record

- Added production-provider regressions for feeding, sleep, pumping, and tummy time. They cover cold starts, delayed local restoration, server-only restoration, repeated and stale commands, newer timers, sub-minute behavior, and compare-and-clear ordering.
- Fixed the sleep restoration race by checking stop obsolescence after the server-lock request resolves. Added cleanup for the sleep model recomputation timeout on unmount.
- Moved ExtensionStorage loading behind a small adapter so the real widget data service can be used at the provider test boundary. The timer-stop coordinator now imports that service through a mockable module boundary.
- Added a native source contract that binds persist-before-release ordering to the baby-targeted `/rest/v1/active_timers` DELETE request and its activity and user predicates.
- Removed synthetic timer-context tests that duplicated provider behavior. Retained focused production reducer coverage for consecutive sleep timers and `SET_SLEEPS` behavior.
- Applied `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, and `references/10-definition-of-done.md`. The final task review at `reviews/0013-external-timer-stop-provider-regressions-review.md` found no standards, spec, bug, or security issues.
- Verification: `npm run test:unit` passed 2,213 tests in 99 files; `npm run test:component -- --runInBand` passed 591 tests in 46 suites; `npm run lint` and `npm run typecheck` passed. Mutation checks proved that removing either the feeding server-only restoration guard or the sleep post-lock guard fails its regression; native ordering and compare-and-clear mutations also failed their tests.
- End-to-end proof: `npm run e2e:flow -- e2e/flows/activities/feeding/breastfeeding-timer.yaml` could not run because the Maestro CLI is not installed (`maestro: command not found`). The highest-level automated substitute was the real-provider Jest suite, included in the 591-test component run, which mounts the production provider tree and drives external stops through public refresh and AppState operations.
- README impact: none. This task does not change setup, commands, configuration, or user-facing behavior.
- Implementation completed on 2026-07-15 with no database, security, or manual-verification decisions required.
