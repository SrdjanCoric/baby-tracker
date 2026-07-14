# Task 0008: Target Watch actions to the requested baby

**Branch**: `feature/watch-action-baby-targeting`
**Depends on**: 0006
**Source**: production bug hunt 2026-07-14 · **User stories**: an Apple Watch command for a non-selected baby never reads, starts, stops, pauses, resumes, or logs activity against the previously selected baby

## What to build

Make Watch message handling wait for and bind to the requested baby before invoking activity context operations. Preserve request-ID deduplication, acknowledgements, widget pending-action cleanup, household timer exclusivity, and the existing Watch response contract.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Keep Watch payload validation and baby authorization at the external-message boundary.
- [ ] Add integration-style regression tests that exercise a command whose baby differs from the phone's current selection.
- [ ] Preserve deterministic command acknowledgement and duplicate-request behavior.

## AFK tasks

- [ ] Reproduce the stale React-closure baby-targeting failure with a failing handler test.
- [ ] Validate that the requested baby belongs to the loaded household before changing selection or running an action.
- [ ] Defer or route the command until contexts are bound to the requested baby; do not call timer/activity callbacks captured for the old selection.
- [ ] Verify start, stop, pause, resume, quick-log, and request-sync paths plus duplicate request IDs.

## Acceptance criteria

- [ ] Every Watch activity command executes against the payload's authorized `babyId`, regardless of the phone's prior selection.
- [ ] Unknown or unauthorized baby IDs fail safely without changing selection or data.
- [ ] A deduplicated request cannot execute twice while still returning a stable response.
- [ ] Timer lock, pending widget action, and Watch acknowledgement behavior remains correct.
- [ ] Focused tests, typecheck, and lint pass.
