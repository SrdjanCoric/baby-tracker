# Task 0014: Make in-app timer completion idempotent

**Branch**: `feature/idempotent-in-app-timer-completion`
**Depends on**: none
**Source**: release review conversation, July 2026 · **User stories**: one dashboard Stop action records one completed activity; a completed timer disappears from the UI even when remote cleanup fails; a recovery Stop clears stale UI without creating another household record

## What to build

Make timer completion converge on one durable activity and one stopped UI state for feeding, sleep, pumping, and tummy time. Persist a timer-instance identity from start through completion. The first accepted stop time and completed activity identity must be reused by every later attempt for that timer.

Once the completion is durable locally, clear the provider's active timer before releasing the server lock, ending a Live Activity, or doing other remote cleanup. A cleanup failure must remain retryable and must not restore the timer. If a completed timer is still visible because of stale state, another Stop must clear that state and return the existing completion without creating a second activity.

Server-only restoration must reject a lock when a matching local pending completion or completed activity exists. Existing timers that predate the timer-instance field need a safe compatibility identity based on their persisted timer data. Use local Supabase for every database test and migration check. Do not access production.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Keep one typed timer-completion contract across all four timer providers and prove it with deterministic integration tests.
- [ ] Preserve strict TypeScript, zero-warning lint, and the canonical unit, component, sync, security, and local SQL checks.

## Before implementation

Run from the repository root and record the baseline. Stop for unrelated failures rather than treating them as part of this task.

```bash
git status --short --branch
npm ci
npm run typecheck
npm run lint
npm run test:component -- --runInBand src/__tests__/external-timer-stop-providers.integration.test.tsx
npx supabase start
npm run test:sql
```

Confirm `npx supabase status` reports local services on `127.0.0.1`. Do not use a linked or production Supabase project.

## Implementation work

- [ ] Write failing provider tests that reproduce two completion calls after server-lock release fails and a refresh restores the timer.
- [ ] Persist a timer-instance identity with every local timer and active-timer lock, including a compatibility path for existing snapshots.
- [ ] Make completion reuse the timer's activity identity and first accepted stop time across retries, refreshes, and restarts.
- [ ] Move the provider to a stopped state immediately after the activity and sync operation are durable, before nonessential cleanup.
- [ ] Preserve the active timer and return an actionable error when durable activity storage fails before completion is secured.
- [ ] Queue failed lock releases for every timer type and retry them without blocking local completion.
- [ ] Reject local or server-only restoration when a pending or completed activity matches the timer instance.
- [ ] When a stale completed timer receives another Stop, clear the timer and stale lock while returning the existing activity.
- [ ] Verify that another caregiver receives one completed activity and that stale lock cleanup cannot create another completion.

## Acceptance criteria

- [ ] The first successful Stop produces one durable activity and removes the timer from the provider UI before remote cleanup completes.
- [ ] Failed lock release, foreground refresh, restart, and server-only restoration do not reactivate a completed timer.
- [ ] A second Stop against stale UI performs cleanup but does not enqueue or store another activity.
- [ ] Repeated completion attempts preserve the first accepted stop time and resolve to one activity identity.
- [ ] Feeding, sleep, pumping, and tummy-time regression tests pass against controlled local dependencies.
- [ ] Local Supabase contains one completed row for the reproduced repeat-stop scenario.
