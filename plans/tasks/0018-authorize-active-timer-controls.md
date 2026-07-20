# Task 0018: Authorize active-timer controls

**Branch**: `feature/authorize-active-timer-controls`
**Depends on**: 0017
**Source**: release review conversation, July 2026 · **User stories**: callers cannot impersonate another caregiver; only authorized users can acquire, release, pause, or resume a timer

## What to build

Close the active-timer authorization bypass across Postgres RPCs and the pause Edge Function. Timer functions must derive or validate identity from the authenticated caller rather than trusting `p_user_id`. The caller must belong to the baby's household, and owner-only timer mutations must match the lock's `started_by` user.

The Edge Function must validate the bearer token, reject missing or invalid users, validate its input, and invoke the database through an authorization-preserving path. Anonymous and unrelated authenticated callers must not be able to mutate a timer by knowing its UUIDs. Apply and test migrations only on local Supabase during implementation.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Add negative authorization tests at every changed trust boundary and keep private payloads and tokens out of logs.
- [ ] Document the caller and permission contract close to the RPC and Edge Function interfaces.

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

- [ ] Preserve the local exploit scripts as failing security regressions before changing the implementation.
- [ ] Bind acquire, release, and toggle operations to `auth.uid()` and explicit household membership.
- [ ] Restrict function grants and search paths to the minimum roles and schemas required.
- [ ] Authenticate and authorize the pause Edge Function before using privileged credentials or sending notifications.
- [ ] Validate baby IDs, activity types, timer ownership, and pause state at the boundary.
- [ ] Verify valid same-household flows through the two-account iOS suite.

## Human checkpoints

- [ ] [confirm-security] Review and approve the RPC grants, caller identity rules, Edge Function token validation, and migration plan before implementation changes the authorization boundary.

## Acceptance criteria

- [ ] The proven cross-household acquire, release, and pause attacks fail under the authenticated database role.
- [ ] Anonymous, malformed, expired-token, unrelated-household, and wrong-owner requests are denied without mutation.
- [ ] Valid timer owners can acquire, pause, resume, and release their timers.
- [ ] Other household members retain read-only visibility and exclusivity feedback.
- [ ] Local SQL, Edge Function, security, and two-account timer tests pass.
