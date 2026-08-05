# Cluster: pause semantics

**Planned:** Tasks 0068 and 0069 on 2026-08-05 — `plans/tasks/0068-count-resumed-pause-in-recorded-activity.md`
(the write path: counted duration plus the stop-at-`pausedAt` truncation, one rule) and
`plans/tasks/0069-show-counted-pause-on-running-timer-surfaces.md` (every running readout). Both sit
after Task 0067, so the rule lands in the shared lifecycle module once. This cluster was planned
before timer time editing, so the edit-screen proof items belong to that cluster per the Scope below.

## Members

- [what pause means](../decisions/resolved/006-pause-semantics.md)
- [showing a record whose stored length disagrees with its interval](../decisions/resolved/018-disagreeing-length-display.md)

## Scope

Read the superseded paragraphs inside
[what pause means](../decisions/resolved/006-pause-semantics.md) rather than around them: its per-type
split is replaced by the counted-pause rule that
[showing a record whose stored length disagrees with its interval](../decisions/resolved/018-disagreeing-length-display.md)
sets for all four types.

The household timer control cut of 2026-08-05 removed one item from the older record's Required proof,
a stop issued while paused on one device and finalized by another, and left `toggle_timer_pause`
owner-only. Both are stated in that record. Everything else in the cluster stands.

The edit-screen proof items in
[showing a record whose stored length disagrees with its interval](../decisions/resolved/018-disagreeing-length-display.md)
need the rebuilt form from
[entering and editing activities by clock time](../decisions/resolved/009-clock-time-log-editing.md).
If this cluster is planned first, the write-path change lands here and those items belong to the timer
time editing cluster; if it is planned second, they land here.

## Delivers

One meaning for the pause button across all four timers, applied consistently in the app, the widget,
the Live Activity, and the Watch.

## Why grouped

Changing what pause means also decides what happens to timers already paused under the old meaning
when the app updates, and whether `toggle_timer_pause` from migration `056` keeps its current
contract. [what pause means](../decisions/resolved/006-pause-semantics.md) answered both inside its own
resolution.

[Showing a record whose stored length disagrees with its interval](../decisions/resolved/018-disagreeing-length-display.md)
joined afterwards, from the timer time editing cluster, because it settled the same question for the
other three types: a resumed pause counts on feeding, pumping, and tummy time as well, which
supersedes the split the first decision drew. The two cannot be sliced apart, since they change the
same expression in the same four contexts, and planning either alone would ship half a rule.

The one follow-on the first decision raised,
[backfilling historical paused sleeps](../decisions/resolved/017-paused-sleep-backfill.md), covers records
already saved rather than the meaning of the control, and resolved as a no, so it adds nothing to this
cluster and produces no tasks of its own.
