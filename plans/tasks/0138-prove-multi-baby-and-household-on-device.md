# Task 0138: Prove multi-baby and two-member household behaviour on device

**Branch**: `feature/e2e-multi-baby-and-household`
**Depends on**: 0129, 0135
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-15 (e2e coverage audit, tier 3) · **User stories**: two parents on two phones share one household with two babies; one starts a nap, the other sees the lock, pauses it, and stops it; a third family's data never shows up; a parent invites, replaces and removes a caregiver; a solo user joins a shared household.

## What to build

One Maestro e2e suite, run on iOS simulators against local Supabase, that proves these six cases. Each case is its own flow file under the existing `e2e/flows/` layout and is registered in a new suite file `e2e/suites/multi-user.yaml`.

| Case | Setup | What must hold |
| --- | --- | --- |
| 1. Two babies, one phone | signed-in owner, seeded babies A and B | Start sleep on A, switch to B, start feeding on B, switch back to A: both timers still run. Stop on A saves A's entry only; B's timer keeps running. No "Stop & Switch" dialog appears. |
| 2. Two babies, guest | guest mode, two babies created in-app | Same isolation as case 1, with no account. |
| 3. Two phones, one household | owner and member on separate simulators, one shared baby | Owner starts a timer; member sees the lock within the household sync window. Member pauses and resumes the owner's timer; owner's readout reflects it. Owner stops; member's card clears. Both phones show the saved entry with "by {owner name}". Covered for sleep, breast feeding, pumping and tummy time. |
| 4. Second household | seed gains a second household with its own owner and baby | After household 1 logs entries and runs a timer, household 2's owner sees no entries, no lock and no baby from household 1. |
| 5. Caregiver management | owner plus member | Owner invites: a code is shown and copied. Replacing the code makes the old code fail to join. Revoking makes the current code fail. Removing the member logs the member out of the household on next launch. Member can leave; owner has no leave option. |
| 6. Join from solo | fresh solo account with one baby, valid invitation | Joining shows the warning that the solo baby will be deleted. After confirm, Home shows the shared baby and the solo baby is gone, on device and in the database. |

Every flow passes on the simulator before it is registered. A flow that fails because the app is wrong means this task fixes the app too.

## Decided

- Two phones use the existing household-timers runner and the two named simulators. — It already handles install, Metro, API container and database assertions; a second runner would drift.
- Case 3 "household sync window" is the runner's existing restart-and-assert pattern, not a fixed wait. — Sync timing is not a product promise.
- Seed stays idempotent and `e2e:cleanup` removes the second household. — Fixtures must not leak between runs.
- Flows run by the owner by hand before an iOS release; CI does not run them. — Owner decision 2026-10-15; no Docker on hosted macOS runners.
- Flows must never target a non-local Supabase. — Existing runner guard applies.

## Clarifications

## Non-goals

- Android runs.
- Lock Screen / Live Activity behaviour (0130).
- Push notifications between phones (0121, 0122).
- Server-side unit coverage of leave and remove (0124).
- Account deletion.

## Context

The regression suite already proves single-baby timers, pauses, edits and saved values on one simulator. The two-simulator runner (`npm run e2e:household-timers`) proves sleep handoff and locks only. Case 1 depends on 0128 removing the "Stop & Switch" dialog and 0127/0129 keeping timers per baby; until those merge, that case cannot pass. Timeline rows expose one accessibility label per entry, so flows match whole labels with a regex; see the "Timer, edit and value-check flows" section of `e2e/README.md`. Pause and resume are offered only to signed-in caregivers.

## Implementation work

- [ ] Case 1 and case 2 flows pass on one simulator — proven by the flow files and `e2e/suites/multi-user.yaml`
- [ ] Case 3 extends the household-timers scenario from sleep to feeding, pumping and tummy time, including remote pause/resume, card clearing and "by {name}" — proven in `e2e/scripts/household-runner.test.mjs` and the flow files
- [ ] Seed creates a second household and cleanup removes it — proven in `e2e/scripts/household-runner.test.mjs`
- [ ] Case 4 flow shows household 2 sees nothing from household 1 — proven by the flow file and the runner's database assertions
- [ ] Case 5 flow covers invite, copy, replace, revoke, remove and leave, with the owner having no leave option — proven by the flow file
- [ ] Case 6 flow covers the warning, the deleted solo baby and the loaded shared baby — proven by the flow file and a database assertion in the runner
- [ ] `e2e/README.md` documents how to run the suite and its fixtures

## Human checkpoints

- [ ] [verify] Run `npm run e2e:household-timers` and the multi-user suite on two booted simulators · Expected: every flow passes, runner exits 0 · Failure: nonzero exit or a flow in the artifacts marked failed · Reason: needs Xcode, Docker and two simulators; not available to the agent in CI.

## Acceptance criteria

- [ ] Every flow in `e2e/suites/multi-user.yaml` exists and passes on an iPhone simulator against local Supabase.
- [ ] `npm run e2e:household-timers:test` passes.
- [ ] `npm run check:code` passes.
