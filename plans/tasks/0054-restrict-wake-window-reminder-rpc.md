# Task 0054: Restrict the wake-window reminder RPC to the service role

**Branch**: `feature/restrict-wake-window-reminder-rpc`
**Depends on**: none
**Source**: Task 0052 native/sync audit, 2026-08-01 · **User stories**: a household's baby names and device push tokens are readable only by the server that sends their reminders; the release owner can confirm the exposure is closed with a repeatable query

## What to build

`public.get_due_wake_window_reminders()` is `SECURITY DEFINER` and selects baby names, user rows and
`user_push_tokens.device_token` across every household with no predicate tied to the caller. Postgres
grants `EXECUTE` on a new function to `PUBLIC` by default, and no migration has ever revoked it, so
the function is callable through PostgREST with the publishable anon key. Its only legitimate caller
is the `check-wake-window-reminders` Edge Function, which holds the service-role key and does not
need the client roles to have the grant.

Add a migration that revokes `EXECUTE` from `PUBLIC`, `anon` and `authenticated`, grants it to
`service_role`, and pins the function's `search_path` to `public, pg_temp` — migrations 055 and 057
already use that two-element form, while this function pins only `public`.

Reminder delivery must be unchanged: the Edge Function still retrieves due reminders and sends them.

The function dates to migration `032_wake_window_reminders.sql`. Seven later migrations recreate it
(033, 034, 035, 036, 037, 039, 053, 059), and `CREATE OR REPLACE` preserves the existing ACL while a
`DROP`+`CREATE` resets it to the default, so the grant must be asserted, not assumed, after any
future recreate.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Apply and verify the migration on local Supabase only; the release owner applies it to production.
- [ ] Prove the new privilege state with an assertion that fails loudly, not by reading the migration back.
- [ ] Keep synthetic accounts and local endpoints throughout; no production token or account identifier appears in any artifact.

## Implementation work

- [ ] Add migration `060` revoking `EXECUTE` on `public.get_due_wake_window_reminders()` from `PUBLIC`, `anon` and `authenticated`, granting it to `service_role`, and recreating the function with `SET search_path = public, pg_temp`.
- [ ] Extend a SQL vector under `scripts/sql/` to assert `has_function_privilege` is false for `anon` and `authenticated` and true for `service_role`, so a later `DROP`+`CREATE` that resets the ACL fails the suite.
- [ ] Audit the sibling functions introduced alongside it in the 032–059 wake-window series for the same default-`PUBLIC` grant, and revoke any that are equally unnecessary for client roles. Record any that legitimately need a client grant.
- [ ] Prove reminder delivery still works end to end against local Supabase through the `check-wake-window-reminders` Edge Function with its service-role key.
- [ ] Run `npm run test:sql` and `npm run test:security`.

## Human checkpoints

- [ ] [confirm-security] Approve the revoke-and-grant migration before it runs, including the list of sibling functions whose grants change · all endpoints and credentials stay local and synthetic.
- [ ] [verify] Apply the migration to production and confirm the exposure is closed · Steps: run the deployment's normal migration path, then in the production SQL editor run `SELECT has_function_privilege('anon', 'public.get_due_wake_window_reminders()', 'EXECUTE');` · Expected: `false`, and wake-window reminders continue to arrive on a device · Failure: the query returns `true`, or reminders stop arriving · Reason: agents must not access production Supabase, and only a real deployment proves the ACL landed.

## Acceptance criteria

- [ ] `anon` and `authenticated` cannot execute `get_due_wake_window_reminders()`; `service_role` can.
- [ ] The function's `search_path` is pinned to `public, pg_temp`.
- [ ] A SQL vector fails if any future migration restores the client grant.
- [ ] Wake-window reminders are still produced and delivered locally through the Edge Function.
- [ ] The release owner has confirmed the production privilege query returns `false`.
