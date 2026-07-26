# Task 0029: Warn and safely calculate overlapping manual sleep

**Branch**: `feature/warn-union-overlapping-manual-sleep`
**Depends on**: 0028
**Source**: Production sleep diagnosis and talk-it-through session 2026-07-26 · **User stories**: caregivers are warned before logging past sleep over an existing session; caregivers may deliberately continue; overlapping records do not double-count or shorten derived sleep

## What to build

Add a non-blocking overlap check to the Log Past Sleep workflow. When the proposed interval intersects an existing completed sleep for the selected baby, show a localized warning with Cancel and Continue anyway. Cancel leaves data unchanged; Continue anyway preserves both raw records and completes the ordinary durable add flow.

Because overlap remains permitted, prediction and statistics preprocessing must treat overlapping records as one interval from the earliest start to the latest end. It must not double-count overlap or shorten a longer sleep when a contained record ends earlier. Preserve raw records and existing live-timer household locking. Do not automatically delete, merge, or rewrite persisted sessions.

This task follows 0028 to serialize changes to the shared sleep-processing module.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`

- [ ] Reuse or repair the repository's existing sleep duplicate-detection and confirmation patterns instead of creating an inconsistent warning path; prove with lint and typecheck.
- [ ] Test interval overlap by start and end boundaries, containment, partial overlap, adjacency, Cancel, Continue anyway, and downstream union calculations.

## Implementation work

- [ ] Test-first, extend completed-sleep duplicate detection to compare full intervals rather than only start-time proximity.
- [ ] Wire the check into Log Past Sleep using the selected baby's current completed sleeps.
- [ ] Add localized Cancel and Continue anyway warning copy; Cancel must not save, while Continue must execute the normal durable add exactly once.
- [ ] Correct sleep preprocessing so overlapping intervals use the maximum end time and their union is counted once.
- [ ] Preserve existing below-threshold continuation semantics for non-overlapping sessions and existing live-timer lock behavior.
- [ ] Run focused duplicate-detection, manual-entry component, and sleep-processing tests, then canonical lint and typecheck.

## Acceptance criteria

- [ ] A manual sleep intersecting an existing completed sleep shows a non-blocking warning.
- [ ] Cancel writes nothing, and Continue anyway stores the proposed sleep once without altering the existing record.
- [ ] Two partially overlapping intervals contribute only their union to predictions and statistics.
- [ ] A contained overlap cannot shorten the containing sleep.
- [ ] Adjacent non-overlapping sessions are not reported as overlaps.
- [ ] Live-timer locking and persisted raw sleep history are unchanged.
