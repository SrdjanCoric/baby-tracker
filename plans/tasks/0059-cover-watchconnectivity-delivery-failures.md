# Task 0059: Cover WatchConnectivity delivery failures

**Branch**: `feature/cover-watchconnectivity-delivery-failures`
**Depends on**: none
**Source**: Task 0052 native/sync audit, 2026-08-01 · **User stories**: an action sent from the Watch is not lost when the phone is unreachable; elapsed times read the same on the phone, the Watch and the widget

## What to build

The Watch surface carries the heaviest post-July change in the app, and its delivery failure modes
have no automated coverage. Four specific gaps, none of which is a proven defect — each is behavior
with no defined, tested outcome:

- the reply-expecting send path has no timeout, so a reply that never arrives has no recovery;
- `transferUserInfo` is called without inspecting failure;
- actions travel over two paths at once — `transferUserInfo`, a serial durable queue, and
  `sendMessage`, immediate and unreliable — with no specified ordering between them;
- the reconciliation path adopts the remote snapshot wholesale, so a late-arriving stale snapshot has
  no guard.

Existing Watch tests assert message routing and identity construction, not delivery failure or
reachability transitions.

Define and test the intended behavior for each: what happens when a reply never comes, when a queued
transfer fails, when a newer action is overtaken by an older one, and when a stale snapshot arrives
after a local change.

Also in scope, from the same audit: the relative-time ladder that reduces to days, months and years
exists in three places — the phone's `timeSince`, the Watch formatter, and a separate copy in the
widget target. The Watch copy lacked day reduction before the July 5 baseline and rendered a
forty-day-old entry as `959h 0m`; that is fixed, but nothing guards the three against drifting apart,
and the repository has no Swift test target. Add a guard that covers all three, and make it robust to
a semantically equivalent rewrite rather than keyed to one literal spelling.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Cover failure and ordering paths, not only successful delivery.
- [ ] A guard that cannot fail when the defect returns is worse than no guard: prove each new check fails against a deliberately broken copy before trusting it.
- [ ] The tracked Watch and widget sources live under `targets/`, not in the gitignored prebuild output.

## Implementation work

- [ ] Define the intended behavior for a missing reply, a failed `transferUserInfo`, out-of-order arrival across the two delivery paths, and a stale reconciliation snapshot. Record each decision in this task.
- [ ] Implement the defined behavior where the current code has none, keeping the change at the message-handler seam.
- [ ] Add tests at that seam for each of the four scenarios.
- [ ] Add a guard that the phone, Watch and widget relative-time ladders reduce at the same thresholds, and verify it fails against a deliberately broken copy of each of the three sources — including a commented-out branch and an equivalent rewrite such as `days > 0` for `days >= 1`.
- [ ] Run `npm run test:unit`, `npm run test:component` and `npm run test:ci`.

## Human checkpoints

- [ ] [verify] Confirm Watch delivery on real hardware · Steps: with the phone app force-quit, send a timer action from the Watch, then relaunch the phone app; separately, start a timer on the Watch and stop it on the phone · Expected: the queued action arrives and is applied once, and the Watch stops showing the timer shortly after the phone records the completion · Failure: the action is lost, applied twice, overwritten by an older action, or the Watch keeps showing a stopped timer · Reason: WatchConnectivity reachability and queued delivery cannot be reproduced in JavaScript tests or reliably in a simulator.

## Acceptance criteria

- [ ] Each of the four failure modes has defined behavior and a test at the message-handler seam.
- [ ] The three relative-time ladders are guarded against drift, and the guard is proven to fail against each broken copy.
- [ ] The release owner has confirmed queued delivery and cross-device convergence on hardware.
