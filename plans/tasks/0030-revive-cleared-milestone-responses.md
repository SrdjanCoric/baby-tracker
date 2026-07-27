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

- [ ] Add deterministic tests across context behavior and the local persistence-to-PostgreSQL path, including the durable queue, for the complete clear-and-recheck sequence and upgrade recovery.
- [ ] Record the stable milestone identity and tombstone-revival behavior in the relevant architecture documentation, removing any diagnostic workaround that is no longer needed.
- [ ] Preserve household authorization and RLS behavior for every changed query or RPC, with cross-household rejection proof when the server write path changes.

## Implementation work

- [ ] Use TDD to reproduce `yes → not_sure → not_yet → yes`, followed by pull and simulated restart, with the final `yes` currently disappearing.
- [ ] Preserve tombstoned milestone response identity through local storage and both foreground-pull and Realtime paths while keeping tombstones hidden from all user-facing selectors and counts.
- [ ] Revive the canonical response with its existing row ID and selected state, using a newly clocked `deleted = false` write.
- [ ] Reconcile a pre-existing pending create whose ID differs from the canonical tombstoned row so the durable queue can acknowledge it and local and server identity converge.
- [ ] Prove two caregivers cannot create duplicate active responses or regress a newer clear or recheck during Realtime reconciliation.
- [ ] Add or update the local migration and SQL merge tests if server-side conflict recovery is required; do not access or mutate production data.
- [ ] Run focused milestone and sync regressions, then pass the canonical `npm run check` command.

## Acceptance criteria

- [ ] A cleared milestone can be checked again and remains checked after synchronization and app restart.
- [ ] An existing tombstoned response is revived under its canonical row ID with a newer `deleted = false` clock and no duplicate database row.
- [ ] A legacy or already queued alternate-ID create converges without data loss or a stuck queue item. It requires no manual production repair.
- [ ] Tombstoned responses remain absent from visible milestone state and all progress or completion calculations.
- [ ] Multi-caregiver clear and recheck operations converge while household authorization remains enforced.
- [ ] No unrelated milestone UX or non-milestone tombstone behavior changes.
