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

- [x] Keep one typed timer-completion contract across all four timer providers and prove it with deterministic integration tests.
- [x] Preserve strict TypeScript, zero-warning lint, and the canonical unit, component, sync, security, and local SQL checks.

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

- [x] Write failing provider tests that reproduce two completion calls after server-lock release fails and a refresh restores the timer.
- [x] Persist a timer-instance identity with every local timer and active-timer lock, including a compatibility path for existing snapshots.
- [x] Make completion reuse the timer's activity identity and first accepted stop time across retries, refreshes, and restarts.
- [x] Move the provider to a stopped state immediately after the activity and sync operation are durable, before nonessential cleanup.
- [x] Preserve the active timer and return an actionable error when durable activity storage fails before completion is secured.
- [x] Queue failed lock releases for every timer type and retry them without blocking local completion.
- [x] Reject local or server-only restoration when a pending or completed activity matches the timer instance.
- [x] When a stale completed timer receives another Stop, clear the timer and stale lock while returning the existing activity.
- [x] Verify that another caregiver receives one completed activity and that stale lock cleanup cannot create another completion.

## Acceptance criteria

- [x] The first successful Stop produces one durable activity and removes the timer from the provider UI before remote cleanup completes.
- [x] Failed lock release, foreground refresh, restart, and server-only restoration do not reactivate a completed timer.
- [x] A second Stop against stale UI performs cleanup but does not enqueue or store another activity.
- [x] Repeated completion attempts preserve the first accepted stop time and resolve to one activity identity.
- [x] Feeding, sleep, pumping, and tummy-time regression tests pass against controlled local dependencies.
- [x] Local Supabase contains one completed row for the reproduced repeat-stop scenario.

## Completion record

### Implementation

- `src/services/timer-completion-service.ts` owns the typed timer identity and durable completion record. New timers reserve UUIDs; legacy snapshots derive stable compatibility UUIDs from baby, activity type, and start time.
- Feeding, sleep, pumping, and tummy-time providers persist the identity locally and in lock metadata, preserve the first accepted stop time, clear provider state after durable activity creation, and reuse completed activities on stale retries.
- Activity creation accepts a reserved ID and is idempotent in local storage and the authenticated sync queue.
- Failed lock releases are serialized, persisted per timer instance, and retried against the original lock row. Legacy locks match by persisted start time; replacement locks are not deleted.
- Durable activity-storage failures leave all four timers active and return the storage error.

### Decisions and review

- No product or architecture decision was required before implementation; the task and existing provider contracts defined the behavior.
- Task review loaded Software Repository Guidelines references `00`, `01`, `02`, `06`, and `10`. It fixed two major cleanup findings: release retries originally could target a replacement lock, and concurrent queue writes could overwrite each other.
- The user approved one additional review remediation pass for race-safe legacy lock cleanup. The final Standards, Spec, Bug, and Security review found no unresolved findings or accepted risks.
- Security review covered UUID generation, local completion metadata, Supabase lock deletion, and the local SQL runner. No trust-boundary finding was identified.

### Documentation

- Updated README `Timer Exclusivity` to describe stable completion IDs and instance-scoped cleanup retries.
- `write-well` audit completed in two passes with no remaining finding in the changed section.

### Proof

- TDD RED then GREEN provider cycles: feeding, sleep, pumping, and tummy-time repeated Stop tests in `src/__tests__/external-timer-stop-providers.integration.test.tsx`.
- TDD RED then GREEN cleanup queue cycle: concurrent failed releases in `src/services/active-timer-service.test.ts`.
- `npm run typecheck` and `npm run lint` passed.
- `npm run test:unit` passed: 101 files, 2,219 tests.
- `npm run test:component -- --maxWorkers=50%` passed: 46 suites, 596 tests.
- `npm run test:sync` passed: 20 files, 243 tests.
- `npm run test:security` passed: 9 files, 90 tests.
- `npm run test:sql` passed against local Supabase, including one-row timer completion replay with the first accepted stop time.
- `npx supabase status` confirmed all tested endpoints use `127.0.0.1`; no production system or data was accessed.
- Automated provider integration and local SQL proof cover the required behavior; no manual verification remains.
