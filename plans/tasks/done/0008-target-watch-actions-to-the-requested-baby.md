# Task 0008: Target Watch actions to the requested baby

**Branch**: `feature/watch-action-baby-targeting`
**Depends on**: 0006
**Source**: production bug hunt 2026-07-14 · **User stories**: an Apple Watch command for a non-selected baby never reads, starts, stops, pauses, resumes, or logs activity against the previously selected baby

## What to build

Make Watch message handling wait for and bind to the requested baby before invoking activity context operations. Preserve request-ID deduplication, acknowledgements, widget pending-action cleanup, household timer exclusivity, and the existing Watch response contract.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Keep Watch payload validation and baby authorization at the external-message boundary.
- [x] Add integration-style regression tests that exercise a command whose baby differs from the phone's current selection.
- [x] Preserve deterministic command acknowledgement and duplicate-request behavior.

## AFK tasks

- [x] Reproduce the stale React-closure baby-targeting failure with a failing handler test.
- [x] Validate that the requested baby belongs to the loaded household before changing selection or running an action.
- [x] Defer or route the command until contexts are bound to the requested baby; do not call timer/activity callbacks captured for the old selection.
- [x] Verify start, stop, pause, resume, quick-log, and request-sync paths plus duplicate request IDs.

## Acceptance criteria

- [x] Every Watch activity command executes against the payload's authorized `babyId`, regardless of the phone's prior selection.
- [x] Unknown or unauthorized baby IDs fail safely without changing selection or data.
- [x] A deduplicated request cannot execute twice while still returning a stable response.
- [x] Timer lock, pending widget action, and Watch acknowledgement behavior remains correct.
- [x] Focused tests, typecheck, and lint pass.

## Implementation notes

- Reproduced the defect with a component integration test: after `selectBaby()` resolved, the original handler continued through callbacks captured for the previously selected baby.
- Added a serialized Watch command queue. Commands for another baby wait until React has rebound every activity context to that authorized baby before execution.
- Validate action names and resolve `babyId` through the loaded `BabyContext` list before selection or side effects. Rejected messages do not log baby IDs or private payloads.
- Route timer start, stop, pause, resume, quick logs, side changes, and sync requests through the same baby-bound queue.
- Preserve request-ID deduplication and cache request-sync replies so repeated delivery returns the original response without executing twice.
- Pending widget stop cleanup now compares against the command's target baby rather than the stale selected-baby closure.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors and 82 existing warnings; task 0008 added no warnings and removed the prior Watch-handler dependency warning.
- `npm run test:unit` — 98 files and 2,208 tests passed.
- `npm run test:component -- --runInBand src/hooks/useWatchMessageHandler.component.test.tsx src/hooks/useWidgetStopHandler.component.test.tsx` — passed.
- `npx eslint src/hooks/useWatchMessageHandler.ts src/hooks/useWatchMessageHandler.component.test.tsx` — passed with no warnings.

## Review and proof

- Automatic review attempt `initial`: no blocker or major findings. Standards, spec, bug, and security lenses checked guideline references `00`, `01`, `02`, `07`, and `10` against the diff and test evidence.
- An Apple Watch and paired iPhone simulator were not available in the sandbox. The component integration suite is the highest-level automated substitute: it delivers messages through the registered Watch handler, changes the selected baby during an in-flight command, rerenders all mocked activity contexts, and verifies routing, rejection, deduplication, replies, and widget cleanup.
- README update not needed: the fix restores the existing Watch behavior and changes no user workflow, setup, configuration, or command.
