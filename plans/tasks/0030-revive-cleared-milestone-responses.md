# Task 0030: Revive cleared milestone responses

**Branch**: `feature/revive-cleared-milestone-responses`
**Depends on**: 0005, 0007, 0021
**Source**: conversation 2026-07-27 · **User stories**: recheck a previously cleared milestone and keep it checked after sync and restart; recover an already affected milestone without manual production data changes

## What to build

Treat `(baby_id, milestone_id)` as one logical milestone response across its full state cycle. Clearing a response writes a CRDT tombstone while retaining the canonical row identity in internal sync state. Rechecking it revives that row with a newer `deleted = false` clock instead of creating a second UUID that conflicts with the database uniqueness constraint.

Tombstones must not affect visible milestone state or progress and completion counts. Pull and Realtime paths must still retain enough internal identity to revive a response after another caregiver or an earlier app session cleared it.

Recover existing affected state as part of the normal sync path. A server tombstone and any pending create that uses another ID for the same logical milestone must converge on the canonical row without losing the caregiver's latest selection. Recovery must not leave a permanently retrying operation or produce two active responses. The repair must work across restart and multi-caregiver synchronization without requiring deletion or direct editing of production rows.

Do not redesign the milestone state cycle or change unrelated activity tombstone behavior.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [x] Add deterministic tests across context behavior and the local persistence-to-PostgreSQL path, including the durable queue, for the complete clear-and-recheck sequence and upgrade recovery.
- [x] Record the stable milestone identity and tombstone-revival behavior in the relevant architecture documentation, removing any diagnostic workaround that is no longer needed.
- [x] Preserve household authorization and RLS behavior for every changed query or RPC, with cross-household rejection proof when the server write path changes.

## Implementation work

- [x] Use TDD to reproduce `yes → not_sure → not_yet → yes`, followed by pull and simulated restart, with the final `yes` currently disappearing.
- [x] Preserve tombstoned milestone response identity through local storage and both foreground-pull and Realtime paths while keeping tombstones hidden from all user-facing selectors and counts.
- [x] Revive the canonical response with its existing row ID and selected state, using a newly clocked `deleted = false` write.
- [x] Reconcile a pre-existing pending create whose ID differs from the canonical tombstoned row so the durable queue can acknowledge it and local and server identity converge.
- [x] Prove two caregivers cannot create duplicate active responses or regress a newer clear or recheck during Realtime reconciliation.
- [x] Add or update the local migration and SQL merge tests if server-side conflict recovery is required; do not access or mutate production data.
- [x] Run focused milestone and sync regressions, then pass the canonical `npm run check` command.

## Acceptance criteria

- [x] A cleared milestone can be checked again and remains checked after synchronization and app restart.
- [x] An existing tombstoned response is revived under its canonical row ID with a newer `deleted = false` clock and no duplicate database row.
- [x] A legacy or already queued alternate-ID create converges without data loss or a stuck queue item. It requires no manual production repair.
- [x] Tombstoned responses remain absent from visible milestone state and all progress or completion calculations.
- [x] Multi-caregiver clear and recheck operations converge while household authorization remains enforced.
- [x] No unrelated milestone UX or non-milestone tombstone behavior changes.

## Completion record

- **Built**: milestone persistence now retains hidden tombstones, rechecks queue a newly clocked
  `deleted=false` write under the canonical UUID, and public context state and progress selectors
  expose only live responses. Foreground pull and Realtime both reconcile an alternate pending
  create by comparing its greatest queued HLC with the canonical row before queuing recovery.
- **Server recovery**: `supabase/migrations/057_canonical_milestone_response_identity.sql`
  serializes milestone merges by logical identity and redirects alternate UUIDs to the canonical
  row. `scripts/sql/merge-record-tests.sql` proves one-row convergence and cross-household
  rejection. Only disposable local Supabase was reset and migrated; no production system or data
  was accessed.
- **Decisions and obstacles**: no product or trust-boundary decision required a user checkpoint.
  Task review found and fixed Realtime persistence, stale-selection ordering, and Realtime
  alternate-ID recovery gaps. No security finding or accepted risk remains.
- **Repository guidelines**: loaded `references/00-overview.md`, `02-testing.md`,
  `03-documentation.md`, and `07-security.md`. Deterministic storage, context, durable-queue,
  multi-replica, migration, and authorization tests provide the required evidence.
- **Documentation**: updated `docs/tombstone-read-path-audit.md` and the README Real-Time
  Multi-Caregiver Sync and project-structure sections. The README `write-well` audit completed in
  two passes with no remaining finding.
- **Automated proof**: final `npm run check` passed with 107 Vitest files / 2,273 tests, 51 Jest
  suites / 642 tests, 103 security tests, 244 sync tests, and 49 CI-contract tests. The SQL stage
  applied all 59 local migrations and passed 26 CRDT vectors, 49 merge assertions, concurrent merge
  and idempotency checks, one-row milestone recovery, and cross-household rejection.
- **Manual verification**: not required. The highest available behavior is covered through the real
  context/storage/queue interfaces and disposable local PostgreSQL.
