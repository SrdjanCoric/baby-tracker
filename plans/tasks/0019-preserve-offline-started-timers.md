# Task 0019: Preserve offline-started timers

**Branch**: `feature/preserve-offline-started-timers`
**Depends on**: 0017, 0018
**Source**: release review conversation, July 2026 · **User stories**: a timer started offline survives reconnect; household lock reconciliation does not discard caregiver data

## What to build

Give offline timer starts an explicit reconciliation state. A locally started feeding, sleep, pumping, or tummy-time timer must not be treated as externally stopped merely because no server lock exists after connectivity returns. Reconnect must attempt authorized lock acquisition and preserve the timer until the selected conflict policy resolves a genuine competing household timer.

Apply the agreed policy consistently to all timer activities, local snapshots, Live Activities, widgets, and household lock displays. Do not change the duplicate-stop behavior owned by task 0014.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Model offline, reconciling, owned, and conflicted timer states explicitly rather than inferring them from a missing row.
- [x] Test reconnect and competing-caregiver orderings deterministically before running the two-account iOS scenario.

## Before implementation

Run from the repository root and verify both provider tests and local household infrastructure.

```bash
git status --short --branch
npm ci
npm run typecheck
npm run lint
npm run test:component -- --runInBand src/__tests__/external-timer-stop-providers.integration.test.tsx
docker info
npx supabase start
npx supabase status
```

Do not implement conflict behavior until the `[decision]` checkpoint below is resolved.

## Implementation work

- [x] Write failing tests for offline start followed by reconnect with no existing server lock.
- [x] Add an explicit local timer-lock reconciliation state that survives restart.
- [x] Acquire or reconcile the server lock after connectivity returns without clearing the local timer prematurely.
- [x] Implement the agreed outcome for two caregivers who start the same activity type while offline.
- [x] Keep provider, ActiveTimers context, widget data, and local storage consistent after reconciliation.

## Human checkpoints

- [x] [decision] Choose the conflict result when two caregivers start the same baby's activity type while both are offline. The first caregiver to acquire the server lock continues. A losing timer is completed at conflict detection with its duration and activity details preserved; pumping volume remains unset. The losing caregiver sees a conflict notice, while both caregivers converge on the lock owner and see the completed losing activity in the timeline.

## Decisions

- Reconciliation uses the existing server lock as the authority: first successful acquisition wins rather than comparing device clocks or local start times.
- Missing server state never proves that a local timer stopped. Reconciliation attempts lock acquisition and keeps retryable local state when the network request fails.
- Sleep uses the same offline reconciliation contract as every other timer. This resolves the pre-existing inconsistency where sleep returned failure on a network error while other timers continued locally, and preserves task 0017's single sleep-based two-simulator architecture.

## Acceptance criteria

- [x] An uncontested offline timer remains active through reconnect and restart.
- [x] The timer acquires a valid household lock when connectivity returns.
- [x] A real competing timer follows the agreed policy without silent data loss.
- [x] Every caregiver converges on the same active owner and activity state.
- [x] Provider integration and two-account iOS reconnect tests pass.

## Completion record

### Implementation

- `src/services/timer-lock-reconciliation.ts` defines the persisted `offline`, `reconciling`, `owned`, and `conflicted` states and distinguishes retryable failures from real caregiver conflicts.
- Feeding, sleep, pumping, and tummy-time providers restore and reconcile local timers without treating a missing lock as an external stop. Race guards prevent a late reconciliation result from restoring a timer that has already stopped.
- A losing timer is completed with its duration and activity details, its Live Activity ends, widget and household state refresh, and the caregiver receives a translated conflict notice. Pumping conflicts do not invent a volume.
- The maintained two-simulator sleep suite stops the local Kong API, starts sleep offline, restores the API, restarts both apps, verifies server ownership, and completes the existing caregiver handoff.

### Repository guidelines, review, and documentation

- Implement and review modes loaded `00-overview`, `01-style-and-code-quality`, `02-testing`, `03-documentation`, `04-developer-environment`, `06-code-health-and-maintainability`, `07-security`, and `10-definition-of-done`.
- Task review used `main` as its base. It fixed ownerless lock failures being treated as conflicts, compared legacy timestamps as instants, and corrected the final E2E restart documentation. The final review at `677cb16` found no unresolved issue, security finding, or accepted risk.
- `README.md` documents offline timer reconciliation and the root E2E commands. `e2e/README.md` documents the reconnect and restart sequence. The affected sections passed a two-pass write-well audit.

### Verification

- `npm run test:unit`: 2,238 tests passed.
- `npm run test:component -- --runInBand`: 631 tests passed, including reconnect, restart, pause and resume persistence, conflict completion, and convergence for all four timer providers.
- `npm run lint`, an isolated committed-head `tsc --noEmit`, `node --check e2e/scripts/run-household-timers.mjs`, and `git diff --check main...HEAD` passed. The ordinary working-tree typecheck remains affected only by the unrelated local `EmptyState` edit.
- `npm run e2e:household-timers:test`: 12 orchestration tests passed.
- `npm run e2e:household-timers` passed the offline start, reconnect, restart, server-lock acquisition, two-caregiver handoff, two completions, and zero-final-lock checks. Artifact: `e2e/artifacts/household-timers/2026-07-22T17-48-17-096Z/`.
