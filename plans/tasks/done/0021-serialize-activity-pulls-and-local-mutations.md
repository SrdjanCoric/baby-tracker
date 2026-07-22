# Task 0021: Serialize activity pulls and local mutations

**Branch**: `feature/serialize-activity-pulls`
**Depends on**: 0017
**Source**: release review conversation, July 2026 · **User stories**: a server refresh cannot erase a local activity being queued; pending creates, updates, and deletes remain visible

## What to build

Put activity pull reconciliation and local collection mutation behind one per-storage-key serialization contract. A pull must not read pending operations and local data from different logical moments, then overwrite a mutation that became durable while the pull was in flight.

Cover every synchronized activity collection. Preserve push-before-pull foreground ordering and avoid holding a storage lock across unnecessary network waits.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Keep synchronization ownership explicit and shared rather than adding per-activity timing checks.
- [x] Prove all meaningful interleavings with deterministic barriers and durable queue assertions.

## Before implementation

Run the lossless-sync baseline from the repository root.

```bash
git status --short --branch
npm ci
npm run typecheck
npm run lint
npm run test:unit -- src/services/activity-sync-lossless.test.ts src/services/sync/sync-lossless.test.ts
npm run test:sync
```

Stop for unrelated failures. Keep all race instrumentation deterministic and local to tests.

## Implementation work

- [x] Add failing create, update, and delete tests where pull reconciliation overlaps queue persistence and local mutation.
- [x] Define a per-key critical section for the local snapshot, pending-operation view, merge, and write.
- [x] Fetch remote data outside the critical section, then re-read current pending and local state before committing the merge.
- [x] Apply the contract to all activity pull paths.
- [x] Verify restart recovery and authentication-scope changes do not cross storage owners.

## Acceptance criteria

- [x] No tested pull and enqueue ordering loses or hides a pending local mutation.
- [x] Pending deletes are not resurrected and pending creates or updates are not replaced by stale server rows.
- [x] Storage locking does not deadlock concurrent activity operations.
- [x] Lossless sync, activity sync, restart, lint, and type-check suites pass.

## Completion record

### Implementation

- `src/services/activity-sync-service.ts` now captures the storage owner and sync identity before each remote pull. The remote query and CRDT reconciliation finish before the per-key lock is acquired.
- `commitPulledCollection` owns the locked pending-operation read, local snapshot, merge, and storage write. Feeding, diaper, sleep, pumping, growth, tummy-time, milestone, and health pulls use this contract.
- Pull commits revalidate the storage user, sync engine, user, and household. A pull aborts if its authentication scope changes before commit.
- `src/services/activity-sync-lossless.test.ts` uses controlled queue, local-write, pull-write, and remote-read barriers. It covers overlapping creates for every collection, an update, a delete, account switching, restart recovery, and a server wait that does not hold the storage lock.

No declared decision or manual-verification checkpoint applied. Push-before-pull foreground ordering was unchanged.

### TDD evidence

- RED then GREEN: feeding create overlap initially ended with an empty local collection.
- RED then GREEN: diaper update overlap initially restored stale server notes.
- RED then GREEN: health delete overlap initially resurrected the server row.
- RED then GREEN: sleep, pumping, growth, tummy-time, and milestone creates were initially erased by their pull paths.
- RED then GREEN: a user-A pull initially resolved after storage switched to user B; it now rejects without changing either user's collection.

### Repository guidelines and review

- Implement and review modes loaded references `00`, `01`, `02`, `06`, `07`, and `10`. Evidence includes strict type-checking, zero-warning lint, public-service integration tests, controlled local test doubles, and root-level test commands.
- Task review compared `main` with `9b68748`. Standards, spec, bug, and security lenses reported no current-diff findings, accepted risks, or blockers. No remediation pass was needed.
- Existing formatter, hook, dependency-maintenance, and repository-policy gaps remain outside this task under the repository assessment and Task 0025.

### Documentation

- `README.md`, section `Architecture / Offline-First Sync Engine`, describes the per-user, per-baby reconciliation lock and pending-mutation protection.
- The write-well audit completed in two passes. The affected section had no remaining findings; unrelated README prose was unchanged.

### Verification

- Baseline: `npm ci`; `npm run typecheck`; `npm run lint`; 43 focused lossless tests; 243 sync tests.
- Focused final: 61 activity lossless, tombstone, and queue tests; 243 sync tests.
- Full final: `npm run test:all` passed 2,261 unit tests and 638 component tests.
- Final quality checks: `npm run typecheck`, `npm run lint`, and `git diff --check` passed.
- Manual verification: not required; the behavior is fully covered by deterministic service-level integration tests.
- Security risks: none accepted.
