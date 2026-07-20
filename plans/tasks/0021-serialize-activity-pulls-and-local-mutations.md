# Task 0021: Serialize activity pulls and local mutations

**Branch**: `feature/serialize-activity-pulls`
**Depends on**: 0017
**Source**: release review conversation, July 2026 · **User stories**: a server refresh cannot erase a local activity being queued; pending creates, updates, and deletes remain visible

## What to build

Put activity pull reconciliation and local collection mutation behind one per-storage-key serialization contract. A pull must not read pending operations and local data from different logical moments, then overwrite a mutation that became durable while the pull was in flight.

Cover every synchronized activity collection. Preserve push-before-pull foreground ordering and avoid holding a storage lock across unnecessary network waits.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Keep synchronization ownership explicit and shared rather than adding per-activity timing checks.
- [ ] Prove all meaningful interleavings with deterministic barriers and durable queue assertions.

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

- [ ] Add failing create, update, and delete tests where pull reconciliation overlaps queue persistence and local mutation.
- [ ] Define a per-key critical section for the local snapshot, pending-operation view, merge, and write.
- [ ] Fetch remote data outside the critical section, then re-read current pending and local state before committing the merge.
- [ ] Apply the contract to all activity pull paths.
- [ ] Verify restart recovery and authentication-scope changes do not cross storage owners.

## Acceptance criteria

- [ ] No tested pull and enqueue ordering loses or hides a pending local mutation.
- [ ] Pending deletes are not resurrected and pending creates or updates are not replaced by stale server rows.
- [ ] Storage locking does not deadlock concurrent activity operations.
- [ ] Lossless sync, activity sync, restart, lint, and type-check suites pass.
