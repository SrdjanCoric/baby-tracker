# Task 0055: Prevent self-assignment of household and owner role

**Branch**: `feature/prevent-household-and-owner-self-assignment`
**Depends on**: 0054
**Source**: Task 0052 native/sync audit, 2026-08-01 · **User stories**: a caregiver cannot promote themselves to household owner or move themselves into another household; an owner keeps sole control of caregiver invitations

## What to build

The `users` UPDATE policy from the initial schema is `USING (id = auth.uid())` with no `WITH CHECK`.
Postgres reuses the `USING` expression as the implicit check, and that expression constrains only
`id` — so it cannot reject a row whose `is_owner` or `household_id` changed. Confirmed locally: after
granting `UPDATE` on `public.users` to `authenticated` inside a rolled-back transaction, a
`SET ROLE authenticated` statement setting `is_owner = true` on the caller's own row was accepted by
the row policy.

`is_owner` is the sole authorization predicate for creating, listing and revoking caregiver
invitations in migration 058, so a caller who can set it can mint and revoke invitations for their
household. `household_id` decides which babies and activities `merge_record` will accept writes for.

Constrain the policy so a caller may edit their own profile fields but may not change `household_id`
or `is_owner`. Either recreate the policy with a `WITH CHECK` that pins both columns to their current
values, or revoke `UPDATE` on `public.users` from `authenticated` and route profile edits through a
`SECURITY DEFINER` RPC. Choose based on what the app actually writes to that table.

Whether this is reachable in production today depends on whether the hosted project grants
`authenticated` UPDATE on `public.users`. The local stack cannot answer that: it holds no table
grants at all, because the local schema is built by `scripts/apply-migrations.mjs`, which never
issues the default grants a hosted Supabase project has. Land the constraint regardless — it is
correct either way — but get the answer first, because it decides the severity and the rollout urgency.

Legitimate membership changes must keep working: joining a household by invitation, the role-based
onboarding path, and guest-account migration all move a user between households through their own
server-side paths.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Apply and verify on local Supabase only; the release owner applies to production.
- [ ] Prove both the rejection and the legitimate paths, so the fix cannot pass by breaking invitations.
- [ ] Keep credentials and endpoints synthetic and local.

## Implementation work

- [ ] Inventory every write the application makes to `public.users` — profile edits, onboarding, restoration, guest migration, invitation redemption — and record which columns each one changes and under which role.
- [ ] Add migration `061` constraining self-updates so `household_id` and `is_owner` cannot be changed by the row's own authenticated caller, using whichever of the two approaches the inventory supports.
- [ ] Extend a SQL vector under `scripts/sql/` covering: a `SET ROLE authenticated` attempt to set `is_owner = true` on the caller's own row is rejected; the same for `household_id`; a legitimate profile-field update still succeeds; joining a household by invitation still succeeds.
- [ ] Confirm the caregiver-invitation RPCs still behave as migration 058 intends for a real owner and reject a non-owner.
- [ ] Run `npm run test:sql` and `npm run test:security`.

## Human checkpoints

- [ ] [confirm-db] Run one read-only query in the production SQL editor and report the result before the approach is chosen: `SELECT has_table_privilege('authenticated', 'public.users', 'UPDATE');` · `true` means the escalation is reachable in production today and the rollout is urgent; `false` means the policy gap is latent and the fix is defense in depth.
- [ ] [confirm-security] Approve the chosen approach — constrained policy or revoke-plus-RPC — before it is implemented.
- [ ] [verify] Apply the migration to production and confirm a caregiver cannot promote themselves · Steps: after deployment, sign in as a non-owner caregiver in a test household and attempt a profile update that sets `is_owner` · Expected: the update is rejected and the caregiver still cannot create invitations · Failure: the update succeeds, or ordinary profile edits break · Reason: agents must not access production Supabase.

## Acceptance criteria

- [ ] An authenticated caller cannot change `household_id` or `is_owner` on their own row.
- [ ] Ordinary profile updates, invitation redemption, role-based onboarding and guest migration all still succeed.
- [ ] SQL vectors cover both the rejection and the legitimate paths.
- [ ] The production privilege question is answered and recorded in this task.
