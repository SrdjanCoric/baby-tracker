# Cluster: shared timer seam

**Planned:** Tasks 0066 and 0067 on 2026-08-05 —
`plans/tasks/0066-extract-shared-timer-lifecycle-tummy-time.md` (module, adapter interface, tummy
time) and `plans/tasks/0067-migrate-remaining-timers-to-shared-lifecycle.md` (pumping, feeding,
sleep).

## Members

- [the seam that keeps all four timers identical](../decisions/resolved/010-shared-timer-seam.md)

## Scope

Weigh this cluster before planning it. Two of the three arguments that sized it have expired. The
household timer control cut of 2026-08-05 retired the remote finalization that forced a record builder
callable from outside the context that started the timer, and
[showing a record whose stored length disagrees with its interval](../decisions/resolved/018-disagreeing-length-display.md)
made the eight duration sites identical and took the duration rule out of the adapter, leaving six
members. What still argues for it is the duplication: eight screens under timer time editing, six
under interval overlap detection, and roughly 300 repeated restore lines per context. That is a
maintainability case, not a forcing one, and doing nothing is now a live option.

## Delivers

One shared timer lifecycle module with a per-type adapter, replacing the roughly 300 duplicated
restore lines in each of the four contexts, landed as a restructuring that changes no behavior and
migrated one type at a time starting with tummy time. Every later behavior decision in this map then
lands once instead of four times.

## Why grouped

The seam's shape follows from every behavioral answer this map produces, so the cluster stayed open
until the contract was settled. `design-it-twice` was considered and skipped, so no design comparison
or separate migration-order decision joins it, and the cluster holds a single member.
