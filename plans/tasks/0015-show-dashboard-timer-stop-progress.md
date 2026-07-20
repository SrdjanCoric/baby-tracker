# Task 0015: Show dashboard timer-stop progress

**Branch**: `feature/dashboard-timer-stop-progress`
**Depends on**: 0014
**Source**: release review conversation, July 2026 · **User stories**: the dashboard acknowledges the first Stop tap immediately; users cannot issue a second stop while completion is pending; failures leave an actionable timer

## What to build

Expose timer completion progress from the providers and reflect it on full and compact dashboard cards. After Stop is pressed, replace the interactive running control with a disabled, accessible stopping state until durable completion succeeds or fails. Pumping keeps its volume-confirmation step and enters the stopping state only after confirmation.

This task changes feedback and interaction only. Task 0014 owns activity idempotency, stale-lock recovery, and durable cleanup.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/10-definition-of-done.md`

- [ ] Keep full and compact dashboard controls behaviorally consistent and accessible.
- [ ] Prove rapid-tap and failure behavior with component tests, then run lint and type checking.

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

- [ ] Add a typed stopping state to each timer provider's public contract.
- [ ] Disable Stop and pause or resume controls while completion is pending.
- [ ] Show an accessible stopping label without leaving the timer visibly interactive.
- [ ] Restore the running controls with an error when durable completion fails.
- [ ] Cover feeding, sleep, pumping confirmation, and tummy time in dashboard component tests.

## Acceptance criteria

- [ ] The first Stop tap changes the dashboard control immediately.
- [ ] Repeated taps during completion invoke the provider stop operation once.
- [ ] Successful completion leaves the card inactive.
- [ ] Failed durable completion restores an actionable timer and reports the failure.
- [ ] Full and compact dashboard layouts expose equivalent behavior and accessibility labels.
