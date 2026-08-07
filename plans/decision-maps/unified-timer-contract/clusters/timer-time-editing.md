# Cluster: timer time editing

**Planned:** Tasks 0070, 0071, 0072, 0073, and 0074 on 2026-08-05 (the last renumbered to 0075 on
2026-08-07, when a new 0074 was inserted after 0073)

## Members

- [running timer start time edit](../decisions/resolved/007-running-timer-start-time-edit.md)
- [entering and editing activities by clock time](../decisions/resolved/009-clock-time-log-editing.md)

## Scope

The owner cut household timer control on 2026-08-05: one caregiver never controls a timer another
started, on any surface, though the second phone still displays it. That cut reaches
[running timer start time edit](../decisions/resolved/007-running-timer-start-time-edit.md), which
was resolved while the work was live. The start-time edit belongs to the caregiver who started the
timer alone, the dashboard card keeps the read-only gate it applies today, and no row policy changes.
That record's own **Scope cut** paragraph states it, and its Required proof is already reduced to what
can be built. Nothing in
[entering and editing activities by clock time](../decisions/resolved/009-clock-time-log-editing.md)
is affected, because a saved record is shared by the household either way.

The server trigger this cluster adds on `active_timers.started_at` guarded the same column as open task
`0056`. That was resolved by merging: Task `0070` takes migration `060` and rejects exactly the
future-`started_at` write `0056` was written for, `0056`'s own finding recorded that row-level security
already blocks `started_by` reassignment, and the owner removed `0056` on 2026-08-05.

## Delivers

A caregiver sets the real start and end times of an activity without arithmetic: correcting a running
timer's start in place, and entering or editing a saved activity by clock time on both the manual
logging screens and the edit screens.

## Why grouped

The two share one validation model. Whatever bounds a running timer's start also bounds a saved
record's start, or the same activity accepts a value in one place and rejects it in the other. The
overlap warning and the morning sleep classification both fire from these edits.

[Stop time rewind](../decisions/resolved/008-stop-time-rewind.md) was a third member until it resolved
as a no. It produces no tasks and has left the cluster, and the end-time rules it would have set
belong to [clock time log editing](../decisions/resolved/009-clock-time-log-editing.md) instead.

[Showing a record whose stored length disagrees with its interval](../decisions/resolved/018-disagreeing-length-display.md)
was a fourth member, charted here because a record that stores less than its own interval would have
needed a display rule in this form. It resolved by removing that state from the write path instead,
so it changes pause accounting rather than the form and has moved to
[pause semantics](pause-semantics.md). The form behaves exactly as
[clock time log editing](../decisions/resolved/009-clock-time-log-editing.md) specified.
