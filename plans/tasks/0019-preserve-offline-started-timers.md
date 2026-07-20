# Task 0019: Preserve offline-started timers

**Branch**: `feature/preserve-offline-started-timers`
**Depends on**: 0017, 0018
**Source**: release review conversation, July 2026 · **User stories**: a timer started offline survives reconnect; household lock reconciliation does not discard caregiver data

## What to build

Give offline timer starts an explicit reconciliation state. A locally started feeding, pumping, or tummy-time timer must not be treated as externally stopped merely because no server lock exists after connectivity returns. Reconnect must attempt authorized lock acquisition and preserve the timer until the selected conflict policy resolves a genuine competing household timer.

Apply the agreed policy consistently to all timer activities, local snapshots, Live Activities, widgets, and household lock displays. Do not change the duplicate-stop behavior owned by task 0014.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Model offline, reconciling, owned, and conflicted timer states explicitly rather than inferring them from a missing row.
- [ ] Test reconnect and competing-caregiver orderings deterministically before running the two-account iOS scenario.

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

- [ ] Write failing tests for offline start followed by reconnect with no existing server lock.
- [ ] Add an explicit local timer-lock reconciliation state that survives restart.
- [ ] Acquire or reconcile the server lock after connectivity returns without clearing the local timer prematurely.
- [ ] Implement the agreed outcome for two caregivers who start the same activity type while offline.
- [ ] Keep provider, ActiveTimers context, widget data, and local storage consistent after reconciliation.

## Human checkpoints

- [ ] [decision] Choose the conflict result when two caregivers start the same baby's activity type while both are offline. Options must cover which timer continues, how the other timer is preserved or completed, and what both caregivers see. Resolve through `talk-it-through` before implementation.

## Acceptance criteria

- [ ] An uncontested offline timer remains active through reconnect and restart.
- [ ] The timer acquires a valid household lock when connectivity returns.
- [ ] A real competing timer follows the agreed policy without silent data loss.
- [ ] Every caregiver converges on the same active owner and activity state.
- [ ] Provider integration and two-account iOS reconnect tests pass.
