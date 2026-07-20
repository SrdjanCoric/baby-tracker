# Task 0015: Show dashboard timer-stop progress

**Branch**: `feature/dashboard-timer-stop-progress`
**Depends on**: 0014
**Source**: release review conversation, July 2026 · **User stories**: the dashboard acknowledges the first Stop tap immediately; users cannot issue a second stop while completion is pending; failures leave an actionable timer

## What to build

Expose timer completion progress from the providers and reflect it on full and compact dashboard cards. After Stop is pressed, replace the interactive running control with a disabled, accessible stopping state until durable completion succeeds or fails. Pumping keeps its volume-confirmation step and enters the stopping state only after confirmation.

This task changes feedback and interaction only. Task 0014 owns activity idempotency, stale-lock recovery, and durable cleanup.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/10-definition-of-done.md`

- [x] Keep full and compact dashboard controls behaviorally consistent and accessible.
- [x] Prove rapid-tap and failure behavior with component tests, then run lint and type checking.

## Before implementation

Run from the repository root and record the baseline.

```bash
git status --short --branch
npm ci
npm run typecheck
npm run lint
npm run test:component -- --runInBand 'app/(tabs)/index.component.test.tsx' src/components/DashboardCard.component.test.tsx
```

Stop for unrelated failures rather than changing tests outside this task.

## Implementation work

- [x] Add a typed stopping state to each timer provider's public contract.
- [x] Disable Stop and pause or resume controls while completion is pending.
- [x] Show an accessible stopping label without leaving the timer visibly interactive.
- [x] Restore the running controls with an error when durable completion fails.
- [x] Cover feeding, sleep, pumping confirmation, and tummy time in dashboard component tests.

## Acceptance criteria

- [x] The first Stop tap changes the dashboard control immediately.
- [x] Repeated taps during completion invoke the provider stop operation once.
- [x] Successful completion leaves the card inactive.
- [x] Failed durable completion restores an actionable timer and reports the failure.
- [x] Full and compact dashboard layouts expose equivalent behavior and accessibility labels.

## Completion record

### Implementation

- Feeding, sleep, pumping, and tummy-time providers expose reactive `isStopping` state while retaining their synchronous duplicate-stop guards.
- `DashboardCard` and `CompactActivityRow` replace Stop and pause controls with a disabled, busy `Stopping...` control. The dashboard passes the same state to either layout.
- Pumping starts this state after volume confirmation. A failed save leaves the confirmation screen open, restores its controls, and shows an error.
- All nine locale files include the stopping label and pumping failure message.

### Decisions and obstacles

- No product or architecture decision required a user checkpoint.
- Reactive provider rerenders exposed an unstable `useRouter` test double in the external-stop suite. The mock now keeps one router identity, matching the runtime boundary and preserving the replacement-command regression test.

### Repository guidelines and review

- Implement-mode references: `00-overview.md`, `01-style-and-code-quality.md`, `02-testing.md`, and `10-definition-of-done.md`.
- Proof: strict type checking and warning-free lint pass; component and provider integration tests cover pending, duplicate, success, failure, pumping confirmation, and both dashboard layouts.
- Task review against `main` found no Standards, Spec, or Bug findings. Security was skipped because the diff does not change a trust boundary. Remediation passes: 0.

### Documentation

- Updated `README.md`, Timer Exclusivity, to describe stopping feedback and failure recovery.
- `write-well` audit completed in one clean pass.

### Verification

- TDD RED and GREEN cycles were observed for both dashboard layouts and each provider's public stopping state. Pumping confirmation also completed a RED and GREEN component cycle.
- `npm run test:all`: 101 Vitest files with 2,219 tests and 48 Jest files with 608 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `git diff --check` and locale JSON parsing: passed.
- No manual verification was required because the component and provider integration suites exercise the complete interaction and failure states.
