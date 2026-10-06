# Task 0105: Prepare and gate the 4.10.2 release

**Branch**: `feature/gate-4-10-2-release`
**Depends on**: 0103, 0104
**Base**: `main` after Task 0104 has merged.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-06; open release gates of Task 0094 · **User stories**: the 4.10
household timer features reach users only after the combined build is proven end to end and
production holds everything the build needs.

## What to build

The 4.10.2 release candidate on `main` is documented and gated so the owner can submit it through
the existing release workflows:

- `release-notes.md` opens with a `4.10.2` section in all nine existing languages. It lists only the
  user-visible changes since 4.9.23: any household caregiver can stop, pause, and resume a timer;
  household timers can be controlled from the widget and the Watch; the starter's Live Activity ends
  when someone else stops the timer; a household member's iPhone shows a Live Activity when another
  member starts a timer; stopping another caregiver's timer works on the first tap.
- The release checklist's production verification lists the migrations the 4.10.2 build requires
  (through 069). It lists the exact signatures of every server function the build calls, including
  the Live Activity token registration functions and the atomic completion function. It lists the
  production setup Live Activity mirroring needs: the updated `send-widget-push` and
  `end-live-activity` functions, the `active_timers` INSERT and DELETE webhooks with the
  service-role bearer, and APNs credentials.

## Decided

- Release notes describe changes relative to 4.9.23, the build now in store submission — owner,
  2026-10-06.
- No 4.10.2 build is submitted until every human checkpoint below passes — the owner's 2026-09-05
  rule that nothing ships before the combined household E2E passes, extended to this merge.
- No agent connects to production; every production fact comes from the owner — owner rule.
- Passing these checkpoints also closes Task 0094's open release gates.

## Clarifications

## Non-goals

- Building, tagging, or submitting 4.10.2 (owner-triggered release process).
- Review findings skipped in Task 0091 (TR-11 through TR-21), unless the owner promotes one.
- A Stop button on the Live Activity; the current Live Activity offers Open only.

## Context

Task 0094 merged on 2026-09-06 with its release gates deferred: the combined-`main` household E2E
was never run, and locked-device push-to-start and mirrored end delivery were never observed (the
local runtime has no APNs credentials or timer push webhook). Its notes also record that the widget
needed a foreground refresh to show a remote timer, and that standalone Watch delivery was not
established. The atomic completion function deletes the lock inside the database; the delete
webhook is a table trigger, so it is expected to fire there too, but only a device run proves it.

## Implementation work

- [ ] `release-notes.md` carries the 4.10.2 section in nine languages; no test covers release notes,
      so the first acceptance criterion is its proof.
- [ ] The release checklist lists required migrations, function signatures, and Live Activity
      production setup for 4.10.2 — proven in `scripts/release-workflow.test.mjs`.

## Human checkpoints

- [ ] [confirm-db] Owner runs the checklist's read-only production queries and confirms migrations
      066–069 and every listed function signature are present, the two functions are deployed, the
      INSERT and DELETE webhooks exist with the service-role bearer, and APNs credentials are set.
- [ ] [verify] Combined household E2E on the release commit: `npm run e2e:household-timers:clean`. ·
      Expected: every scenario passes. · Failure: any step. · Reason: simulators, Maestro, Docker.
- [ ] [verify] Two real iOS 17.2+ devices on production, both signed into one household. Lock B; A
      starts sleep. · Expected: B shows one Live Activity without opening the app. Then B stops it
      from the app: both Live Activities end, one record owned by B, no lock, A's app shows no
      timer. Repeat with B foregrounded: no duplicate Live Activity. · Failure: missing, duplicate,
      or surviving activity, a remaining lock, or two records. · Reason: APNs push delivery cannot
      run locally.
- [ ] [verify] On those devices, B stops A's timer from the widget, then from the Watch. ·
      Expected: one record, no lock, A's Live Activity ends; note whether the widget shows the
      remote timer without opening the app. · Failure: lock remains or two records. · Reason:
      needs real widget and Watch.
- [ ] [decision] If the widget still needs a foreground refresh to show a remote timer, does that
      block 4.10.2? (`talk-it-through`)

## Acceptance criteria

- [ ] The 4.10.2 section exists in all nine languages with the same bullets in each.
- [ ] Every function signature the 4.10.2 client calls appears in the checklist.
- [ ] `npm run check` passes on the release commit, with Docker running.
- [ ] Every human checkpoint above is checked.
