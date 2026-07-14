# Task 0011: Make activity queue acknowledgement durable

**Branch**: `feature/durable-activity-queue-acknowledgement`
**Depends on**: none
**Source**: verification review 2026-07-14 · **User stories**: an authenticated activity write is reported as saved only after its sync operation survives restart; a queue storage failure cannot leave a successful-looking change that a later pull erases

## What to build

Close the failure gap between local optimistic activity storage and the persistent sync queue.
Authenticated creates, updates, and deletes must not return success while their sync operation exists
only in memory. If queue persistence fails after the local write, leave the mutation in a recoverable
durable state or restore the prior local state. A restart followed by a server pull must not silently
discard the mutation. Guest tracking remains local-only and does not require an authenticated queue.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Keep the authenticated queue contract centralized and strictly typed; prove it with warning-free lint and strict typecheck.
- [x] Test the exported activity mutation path across local storage, queue persistence, restart, and pull reconciliation with controlled storage failures.
- [x] Preserve household checks and avoid logging activity payloads, tokens, or other private data while surfacing failures.
- [x] Record focused regression proof and the canonical unit, component, security, lint, and typecheck results.

## AFK tasks

- [x] Add a failing regression in which a local activity write succeeds, persistent queue storage fails, the process restarts, and a server pull occurs.
- [x] Make authenticated mutation acknowledgement depend on a durably persisted queue operation, including create, update, and delete paths.
- [x] Define and implement the recoverable local-state behavior when queue persistence remains unavailable after bounded retries.
- [x] Verify that a later retry persists and uploads the mutation once, without duplicate records or stale pending markers.
- [x] Verify that guest activity writes remain local and do not create authenticated queue entries.

## Acceptance criteria

- [x] An authenticated activity mutation cannot report success unless its queue operation is durable across restart.
- [x] A persistent queue storage failure is visible to the caller and cannot be reduced to a console message.
- [x] Restart and pull reconciliation preserve or deliberately roll back the unacknowledged mutation; they never erase it silently.
- [x] Recovery after storage becomes available uploads the intended mutation once.
- [x] Guest tracking behavior is unchanged.
- [x] Focused regressions and the full canonical validation commands pass.

## Implementation log

- Added a write-ahead local mutation record to authenticated activity queue operations. The queue persists the prepared operation before AsyncStorage changes, commits it after the local write, and resolves interrupted prepared records during restart.
- Added primary and recovery queue snapshots with monotonic generations. Restore reads both snapshots independently and retains the newest valid durable state without overwriting unreadable storage.
- Bound queued operations to the authenticated household and user, serialized queue mutations, isolated operations during account changes, and migrated attributable legacy operations before pull reconciliation.
- Added server-side operation acknowledgements and a user-bound `merge_record` overload in `055_idempotent_owned_sync_operations.sql`. Replays with the same operation ID apply once, including concurrent calls, and authenticated clients cannot invoke the unbound overload.
- Review found no spec, correctness, standards, test-quality, or manual security findings. A separate review document was omitted at the user's request.
- Verification passed: `npm run test:sync` (20 files, 243 tests); `npm run test:unit` (98 files, 2,237 tests); `npm run test:component -- --runInBand` (44 suites, 547 tests); `npm run test:security` (8 files, 89 tests); `npm run test:sql` (26 vectors, 34 merge assertions, tombstone and concurrency checks); `npm run typecheck`; `npm run lint`; and `git diff --check`.
- The highest-level automated proof injects queue persistence failures through exported create, update, and delete activity paths, restarts storage and sync state, performs pull reconciliation, retries, and verifies one upload. A literal device-process crash test is not practical in the repository harness because the proof depends on deterministic AsyncStorage fault injection.
- No README update is required. User-facing setup and commands are unchanged; the new migration follows the existing deployment path.
