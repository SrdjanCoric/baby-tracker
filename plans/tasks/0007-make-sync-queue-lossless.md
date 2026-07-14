# Task 0007: Make authenticated activity sync lossless

**Branch**: `feature/lossless-activity-sync`
**Depends on**: 0006
**Source**: production bug hunt 2026-07-14 · **User stories**: a locally saved timer stop or manual activity remains visible through offline periods and transient server failures until Supabase acknowledges it; startup auth timing never bypasses durable queueing

## What to build

Close the confirmed data-loss paths between local activity storage and Supabase. Authenticated providers must not render before the sync engine has the current user/household context, activity writes must use the persistent queue rather than a silent direct-write fallback, and valid operations must remain pending across transient retry exhaustion instead of being quarantined and removed. Pull/merge logic must continue preserving every unacknowledged local entity.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Keep authenticated and guest/local-only behavior explicit without weakening row-level security or bypassing the CRDT merge path.
- [ ] Add deterministic failure-path tests for auth setup timing, queue persistence, retry exhaustion, app restart, and pull-before-ack protection.
- [ ] Do not log tokens, secrets, or private payload contents while improving sync diagnostics.

## AFK tasks

- [ ] Reproduce the authenticated startup gap, silent direct-write failure, and valid-operation quarantine loss with failing tests.
- [ ] Gate authenticated activity providers until sync auth context is installed, while preserving guest/local-only startup.
- [ ] Remove silent direct database fallbacks for authenticated activity mutations and make the persistent queue the sole durable transport path.
- [ ] Retain valid failed operations for future retry after transient errors; quarantine only structurally invalid operations.
- [ ] Ensure fetch/merge code protects locally stored entities for every queued create/update/delete state until acknowledgement.
- [ ] Add bounded diagnostics and state reporting so a failed sync remains visible rather than being reported as success after dropping work.

## Acceptance criteria

- [ ] An authenticated activity mutation cannot occur with a missing sync auth context during provider startup.
- [ ] Network/RPC failures leave the operation durably pending across repeated sync attempts and engine reinitialization.
- [ ] A server pull cannot remove or replace an unacknowledged local activity.
- [ ] Structurally invalid operations are still isolated safely without blocking valid queue work.
- [ ] Guest/local-only activity tracking remains functional and does not create invalid authenticated queue entries.
- [ ] Existing CRDT, offline, security, and service-unavailability tests continue to pass alongside new regression coverage.
- [ ] Typecheck, lint, and focused/full unit tests pass.
