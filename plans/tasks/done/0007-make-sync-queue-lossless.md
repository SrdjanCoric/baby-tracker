# Task 0007: Make authenticated activity sync lossless

**Branch**: `feature/lossless-activity-sync`
**Depends on**: 0006
**Source**: production bug hunt 2026-07-14 · **User stories**: a locally saved timer stop or manual activity remains visible through offline periods and transient server failures until Supabase acknowledges it; startup auth timing never bypasses durable queueing

## What to build

Close the confirmed data-loss paths between local activity storage and Supabase. Authenticated providers must not render before the sync engine has the current user/household context, activity writes must use the persistent queue rather than a silent direct-write fallback, and valid operations must remain pending across transient retry exhaustion instead of being quarantined and removed. Pull/merge logic must continue preserving every unacknowledged local entity.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Keep authenticated and guest/local-only behavior explicit without weakening row-level security or bypassing the CRDT merge path.
- [x] Add deterministic failure-path tests for auth setup timing, queue persistence, retry exhaustion, app restart, and pull-before-ack protection.
- [x] Do not log tokens, secrets, or private payload contents while improving sync diagnostics.

## AFK tasks

- [x] Reproduce the authenticated startup gap, silent direct-write failure, and valid-operation quarantine loss with failing tests.
- [x] Gate authenticated activity providers until sync auth context is installed, while preserving guest/local-only startup.
- [x] Remove silent direct database fallbacks for authenticated activity mutations and make the persistent queue the sole durable transport path.
- [x] Retain valid failed operations for future retry after transient errors; quarantine only structurally invalid operations.
- [x] Ensure fetch/merge code protects locally stored entities for every queued create/update/delete state until acknowledgement.
- [x] Add bounded diagnostics and state reporting so a failed sync remains visible rather than being reported as success after dropping work.

## Acceptance criteria

- [x] An authenticated activity mutation cannot occur with a missing sync auth context during provider startup.
- [x] Network/RPC failures leave the operation durably pending across repeated sync attempts and engine reinitialization.
- [x] A server pull cannot remove or replace an unacknowledged local activity.
- [x] Structurally invalid operations are still isolated safely without blocking valid queue work.
- [x] Guest/local-only activity tracking remains functional and does not create invalid authenticated queue entries.
- [x] Existing CRDT, offline, security, and service-unavailability tests continue to pass alongside new regression coverage.
- [x] Typecheck, lint, and focused/full unit tests pass.

## Implementation notes

- Added `SyncAuthGate` so authenticated activity providers wait for queue restoration and the real user/household sync identity; logout clears engine and Realtime auth state before guest providers continue.
- Removed activity-service direct Supabase write fallbacks. Local writes now enqueue durably, background sync failures remain visible, and valid operations survive retry exhaustion and restart.
- Pull reconciliation now preserves pending creates and updates and suppresses pending deletes for every activity table.
- Queue restoration retains compatible operations across queue-version upgrades, isolates structurally invalid entries, retries transient persistence failures, and never uploads before auth is configured.
- Guest migration clears source data only after every queue entry is durable and derives stable UUIDs so a partial migration retry cannot duplicate activities.
- Made locale-sensitive time tests assert device-locale behavior so the full unit suite is deterministic outside English locales.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors; 83 existing warnings remain assigned to task 0010.
- `npm run test:unit` — 98 files and 2,208 tests passed.
- `npx vitest run src/services/sync/sync-engine.test.ts src/services/sync/sync-lossless.test.ts src/services/activity-sync-lossless.test.ts src/__tests__/edge-cases/service-unavailability.edge-case.test.ts` — 44 tests passed.
- `npm run test:component -- --runInBand src/__tests__/sync-auth-setup.integration.test.tsx` — passed.

## Review and proof

- Automatic review attempt `initial`: no blocker or major findings. Standards, spec, bug, and security lenses ran; guideline references `00`, `01`, `02`, `07`, and `10` were checked against the diff and verification evidence.
- A literal Supabase outage/restart device E2E was not practical in the local sandbox. The highest-level automated substitute combines the provider integration test, persistent AsyncStorage queue restart tests, controlled RPC outage tests, service-unavailability tests, and the full unit suite.
- README update not needed: this task changes internal durability and recovery behavior without changing user-visible workflows, setup, configuration, or commands.
