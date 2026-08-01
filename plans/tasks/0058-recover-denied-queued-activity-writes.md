# Task 0058: Recover a queued activity write that the server denies

**Branch**: `feature/recover-denied-queued-activity-writes`
**Depends on**: none
**Source**: Reported by the release owner 2026-08-01, scoped from the Task 0052 native/sync audit · **User stories**: a caregiver's saved activity is never stuck forever in the sync queue; when a write genuinely cannot succeed, the app says so instead of retrying in silence

## What to build

Reported from a running app:

```
[SyncEngine] Sync failed after 5 attempts; 1 operations remain queued:
Failed to merge feedings: merge_record: access denied
```

`merge_record` raises `access denied` with `ERRCODE 42501` when the incoming row's `baby_id` does not
join to a household row for `auth.uid()`, or when the existing row's `baby_id` does not. Three
candidate causes, none yet confirmed:

1. the baby row itself has not landed on the server yet, so a child write referencing it is denied
   until the parent merges — an ordering problem between a parent and its children in the queue;
2. the caller's `public.users.household_id` is stale or null after a session or household
   restoration, so every write for a legitimately owned baby is denied;
3. the baby genuinely belongs to another household, which is a correct denial that the client is
   nonetheless handling by retrying forever.

Reproduce first, then fix the confirmed cause. Whatever the cause, the second half of the behavior is
the same and is in scope: a permanently denied operation must reach a terminal, visible state rather
than retrying indefinitely while the caregiver believes the entry is saved. The master plan reserves
quarantine for structurally invalid operations, so decide deliberately whether an authorization
denial is quarantined, surfaced to the caregiver, or retried under a different policy — and record
the decision.

If reproduction shows the cause is the restoration path rather than queue ordering, stop and split
the fix into its own task rather than widening this one.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Reproduce against local Supabase with synthetic accounts before changing behavior.
- [ ] Keep the permanent regression test at the lowest reliable seam, per the bug-PR decision in the master plan.
- [ ] Never weaken the `merge_record` household check to make the symptom disappear.

## Implementation work

- [ ] Reproduce `merge_record: access denied` locally for a feeding write, and identify which of the three candidate causes produces the reported message.
- [ ] Trace how the operation is retried, what `Sync failed after 5 attempts` leaves behind, and what the caregiver sees while the operation stays queued.
- [ ] Fix the confirmed cause so the caregiver's activity converges — for the ordering case, a child write whose parent has not yet merged must succeed once the parent lands, without losing the entry.
- [ ] Give a permanently denied operation a terminal, visible outcome instead of unbounded retry, following the decision recorded below.
- [ ] Add a regression test at the sync-queue seam covering both the recoverable denial and the permanent one.
- [ ] Run `npm run test:sync`, `npm run test:unit` and `npm run test:sql`.

## Human checkpoints

- [ ] [decision] Decide what a permanently denied write should do — quarantine, surface an error to the caregiver, or keep retrying under a bounded policy — given that the master plan reserves quarantine for structurally invalid operations (`talk-it-through`).
- [ ] [verify] Confirm the reported failure is gone on the release owner's own device · Steps: reproduce the original conditions that produced the console error, then check the sync queue drains · Expected: the feeding merges and no operation remains queued · Failure: the error recurs, or an entry the caregiver saved is silently dropped · Reason: the original report came from a real device against production data, which agents must not access.

## Acceptance criteria

- [ ] The cause of the reported `merge_record: access denied` is identified and recorded.
- [ ] A write denied because its parent has not yet merged converges once the parent lands, with no lost entry.
- [ ] A permanently denied write reaches a terminal, visible state rather than retrying indefinitely.
- [ ] Regression tests cover the recoverable and permanent denials at the sync-queue seam.
- [ ] The `merge_record` household check is unchanged.
