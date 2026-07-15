# Task 0012: Keep Watch baby selection storage-consistent

**Branch**: `feature/watch-baby-selection-storage-consistency`
**Depends on**: none
**Source**: verification review 2026-07-14 · **User stories**: a Watch action for a household baby added through Realtime binds to that baby and completes; a failed selection cannot leave the Watch command queue stuck

## What to build

Keep the loaded baby collection, persisted baby collection, and selected baby consistent when
Realtime changes arrive. A Watch command may validate a target against the loaded household only if
the selection path can bind activity providers to the same baby. If binding fails, finish the
request with a deterministic failure path and leave later commands retryable. Unknown or
unauthorized baby IDs must still fail before selection or activity side effects.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Keep one typed source of truth for baby selection and use consistent state and storage naming.
- [x] Test Realtime insertion, selection, provider rebinding, Watch execution, failure recovery, and restart through production interfaces.
- [x] Preserve household authorization at the external-message boundary and do not log baby IDs or private payload contents.
- [x] Prove the change with focused integration tests plus the canonical unit, component, security, lint, and typecheck commands.

## AFK tasks

- [x] Add a failing integration regression that loads baby A, receives baby B through Realtime, and sends a Watch activity command for baby B.
- [x] Keep Realtime baby inserts, updates, and deletes consistent with the persisted collection used by selection and restart restoration.
- [x] Make Watch queue recovery explicit when selection returns no baby or providers cannot bind to the requested ID.
- [x] Verify that the command runs against baby B only after every activity provider has rebound, with no write against baby A.
- [x] Cover duplicate request IDs, subsequent queued commands, unknown baby rejection, and restart after a Realtime change.

## Acceptance criteria

- [x] A household baby received through Realtime can be selected immediately and remains selectable after restart.
- [x] A Watch command for that baby executes once against the requested baby's activity providers.
- [x] Selection failure cannot leave the queue waiting indefinitely or block later commands.
- [x] Unknown and unauthorized baby IDs cause no selection or activity write.
- [x] The integration test uses the real baby selection and persistence path instead of manually changing a mocked selected ID.
- [x] Focused regressions and the full canonical validation commands pass.

## Implementation log

- Realtime baby mutations now update the loaded and persisted collection through a serialized, auth- and household-scoped storage path, including reconciliation with snapshots already in flight.
- Watch requests validate household membership, select through the real BabyContext, wait for every activity provider to bind to the requested baby, deduplicate request IDs, and terminalize failure paths without blocking later commands.
- Activity providers reject stale load completions and clean up Live Activities created after a baby-binding change. Auth-scoped provider remounting prevents state from being reused by a different account.
- The unapplied migration `055_idempotent_owned_sync_operations.sql` was made backward-compatible with installed app versions: it adds the five-argument idempotent RPC without changing the existing three-argument RPC contract. A fresh local Supabase rebuild applied all 57 migrations, and the SQL suite proved both old and new authenticated calls.
- Verification passed: `npm run test:unit` (2,240 tests); `npm run test:component -- --runInBand` (577 tests); `npm run test:security` (90 tests); `npm run test:sync` (243 tests); `npm run test:sql` (26 vectors and 45 merge assertions); `npm run lint`; `npm run typecheck`; and `git diff --check`.
- Accepted risk: the user chose to defer cancellation of already-running timer starts across account switches because account switching during timer startup is considered unlikely. The official security scan calibrated the four instances as medium severity. The user then instructed PR creation after disclosure of the provider diagnostic-log findings and the legacy authenticated baby-key upgrade gap; those follow-ups remain deferred rather than silently treated as fixed.
