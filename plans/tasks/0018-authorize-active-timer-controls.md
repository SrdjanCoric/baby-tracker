# Task 0018: Authorize active-timer controls

**Branch**: `feature/authorize-active-timer-controls`
**Depends on**: 0017
**Source**: release review conversation, July 2026 · **User stories**: callers cannot impersonate another caregiver; only authorized users can acquire, release, pause, or resume a timer

## What to build

Close the active-timer authorization bypass across Postgres RPCs and the pause Edge Function. Timer functions must derive or validate identity from the authenticated caller rather than trusting `p_user_id`. The caller must belong to the baby's household, and owner-only timer mutations must match the lock's `started_by` user.

The Edge Function must validate the bearer token, reject missing or invalid users, validate its input, and invoke the database through an authorization-preserving path. Anonymous and unrelated authenticated callers must not be able to mutate a timer by knowing its UUIDs. Apply and test migrations only on local Supabase during implementation.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Add negative authorization tests at every changed trust boundary and keep private payloads and tokens out of logs.
- [x] Document the caller and permission contract close to the RPC and Edge Function interfaces.

## Before implementation

Run the security baseline only against a reset local Supabase instance.

```bash
git status --short --branch
npm ci
docker info
npx supabase start
npx supabase db reset --local --no-seed
npx supabase status
npm run test:security
npm run test:sql
```

Confirm every reported service URL is local. Preserve the existing exploit reproduction before changing the functions, and do not connect to a linked or production project.

## Implementation work

- [x] Preserve the local exploit scripts as failing security regressions before changing the implementation.
- [x] Bind acquire, release, and toggle operations to `auth.uid()` and explicit household membership.
- [x] Restrict function grants and search paths to the minimum roles and schemas required.
- [x] Authenticate and authorize the pause Edge Function before using privileged credentials or sending notifications.
- [x] Validate baby IDs, activity types, timer ownership, and pause state at the boundary.
- [x] Verify valid same-household flows through the two-account iOS suite.

## Human checkpoints

- [x] [confirm-security] Approved the RPC grants, caller identity rules, Edge Function token validation, and local-only migration plan. Unregistered solo users keep local-only timers; authenticated solo and household users use protected Supabase timer controls.

## Decisions

- Preserve local-only timer behavior for unregistered users. Supabase's anonymous role represents unauthenticated network callers, not local guest mode, and receives no timer-control execution rights.
- Keep existing RPC identity parameters for old-client compatibility, require them to match `auth.uid()`, and derive all writes from the authenticated caller.
- Allow authenticated household members to read timer locks for exclusivity feedback, while only the lock's `started_by` user may release, pause, or resume it.
- Validate the Edge Function bearer token and request before using service-role credentials; use the caller's JWT for the timer mutation and privileged credentials only for post-mutation notifications.
- Apply and test migration 056 only against local Supabase. No linked or production database operations are authorized.

## Accepted security risks

- Direct `active_timers` table update/delete policies continue to authorize by `started_by` without rechecking current baby-household membership. A caregiver who leaves a household may still mutate a stale lock they originally started. Accepted because the current user base is small; the RPC and Edge Function paths still enforce current membership.

## Acceptance criteria

- [x] The proven cross-household acquire, release, and pause attacks fail under the authenticated database role.
- [x] Anonymous, malformed, expired-token, unrelated-household, and wrong-owner requests are denied without mutation.
- [x] Valid timer owners can acquire, pause, resume, and release their timers.
- [x] Other household members retain read-only visibility and exclusivity feedback.
- [x] Local SQL, Edge Function, security, and two-account timer tests pass.

## Implementation record

- Migration `supabase/migrations/056_authorize_active_timer_controls.sql` binds timer RPC writes to `auth.uid()`, checks active baby-household membership, enforces lock ownership, removes stale pause fields on resume, narrows function grants, and documents each permission contract with `COMMENT ON FUNCTION`.
- `supabase/functions/toggle-timer-pause/handler.ts` validates bearer identity and request data before mutation. `index.ts` uses the caller JWT for the RPC and creates the service-role client only for notifications after a successful mutation.
- APNs device tokens must be bounded, even-length hexadecimal strings. Logs no longer include token fragments or timer-state payloads.
- SQL regressions live in `scripts/sql/active-timer-authorization-tests.sql` and run through `npm run test:sql`. The disposable local HTTP/Auth regression is `scripts/test-active-timer-edge.mjs`, exposed as `npm run test:edge:timer`.
- E2E fixtures preserve the restricted stale-lock cleanup grant and verify authenticated versus anonymous timer RPC permissions.

## Review and proof

- Guidelines loaded in scope, implement, and review modes: `00-overview`, `02-testing`, `03-documentation`, `07-security`, and `10-definition-of-done`. Proof includes real SQL and HTTP boundaries, isolated local fixtures, canonical checks, interface-adjacent contracts, and CI still required before PR completion.
- TDD observed failing then passing regressions for cross-household acquire, wrong-owner release/pause, missing and invalid bearer tokens, payload impersonation, malformed inputs, database denial, notification failure sanitization, and malformed Live Activity tokens.
- Task review converged after one remediation pass. It fixed malformed Live Activity token handling and local fixture cleanup. The former-caregiver direct-table policy finding was accepted above.
- README sections updated: Timer Exclusivity, Project Structure, and Testing. The `write-well` audit completed in two passes; the second pass found no new issues in the affected text.
- Fresh local migration chain: 58 migrations applied through 056. Every Supabase URL used during implementation was confirmed as loopback-only. No linked project or production system was accessed.
- Automated proof passed: `npm run test:sql`, `npm run test:edge:timer`, `npm run test:security` (103 tests), `npm run typecheck`, `npm run lint`, `npm run test:unit` (2,233 tests), `npm run test:component` (622 tests), and `npm run e2e:household-timers:test` (11 tests).
- Clean two-account iOS proof passed with owner/member acquire, lock visibility, release, and handoff. Artifacts: `e2e/artifacts/household-timers/2026-07-21T22-16-24-509Z`.
