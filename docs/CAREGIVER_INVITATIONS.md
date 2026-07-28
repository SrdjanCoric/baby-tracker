# Caregiver invitations

Household owners authorize a caregiver's email before sharing an invitation code. The code uses the existing eight-character `XXXX-XXXX` format, expires after seven days, and works once. Owners may keep invitations pending for several email addresses, but a household has at most one current invitation for each normalized email.

## Onboarding

New owners choose an account before entering baby details. The account choice explains that caregiver invitations require an account because shared tracking must synchronize between devices. Continue on this device keeps the baby on that device and does not show another invitation prompt.

After an authenticated owner creates a baby, onboarding offers one optional invitation. A missing caregiver display name must be saved before invitation creation. Not now and Skip remaining setup create no invitation and schedule no reminder. When an invitation is created, the screen shows the verified code returned by `create_caregiver_invitation`. Copying or opening the system share sheet is optional, and dismissing the share sheet does not block onboarding.

## Security model

Migration `supabase/migrations/058_email_bound_caregiver_invitations.sql` creates `caregiver_invitations`. Clients cannot read or modify the table directly. Authenticated users call these RPCs:

- `create_caregiver_invitation(text)` creates or replaces an invitation for an email. The caller must own the household.
- `list_caregiver_invitations()` returns current invitations to the owner, including their readable codes.
- `revoke_caregiver_invitation(uuid)` revokes an invitation that belongs to the owner's household.
- `join_household_by_invite_code(varchar)` redeems an invitation for the caller's verified auth email.

Redemption locks the invitation row, checks its expiry and status, compares normalized email addresses, moves the caregiver, and records consumption in one transaction. After the release owner enables email enforcement, unknown codes, legacy household codes, wrong accounts, unverified accounts, expired invitations, revoked invitations, and consumed invitations return no household data. The response does not disclose the intended email or household.

The server permits five failed redemption attempts per authenticated user per hour. The app applies the same limit locally. Codes contain about 40 bits of entropy and exclude ambiguous characters. The intended email is not included in copied or shared text.

## Compatibility

Existing household memberships do not change. The migration keeps the existing `join_household_by_invite_code(varchar)` signature, so an older recipient app can redeem a new email-bound code.

Migration 058 starts with `caregiver_invitation_rollout.email_binding_enforced` set to `false`. During this compatibility period, new email-bound codes and old household-wide codes both work. Older owner apps can continue inviting caregivers until the new app version is deployed. The release owner then enables email enforcement, which disables household-wide code joins.

## Local verification

Run these commands from the repository root:

```bash
npm run test:sql:setup
npm run test:sql
npm run test:unit -- src/services/household-service.test.ts src/i18n/caregiver-invitation-locales.test.ts src/__tests__/security/invite-code-security.test.ts
npm run test:component -- app/settings/household.component.test.tsx app/settings/join-household.component.test.tsx --runInBand
```

The SQL test covers owner authorization, email normalization, replacement, multiple pending invitations, expiry, revocation, one-time consumption, verified-email matching, legacy-code rejection, the preserved RPC signature, and server rate limiting.

## Release check

The production database check is read-only and must be completed by the release owner before the app update ships:

```sql
SELECT to_regclass('public.caregiver_invitations');
SELECT to_regprocedure('public.create_caregiver_invitation(text)');
SELECT to_regprocedure('public.list_caregiver_invitations()');
SELECT to_regprocedure('public.revoke_caregiver_invitation(uuid)');
SELECT to_regprocedure('public.join_household_by_invite_code(character varying)');
SELECT to_regclass('public.caregiver_invitation_rollout');
SELECT email_binding_enforced
FROM public.caregiver_invitation_rollout
WHERE singleton = true;
```

Every object query must return a non-null name. Before the app release, `email_binding_enforced` must be `false`. If an object is missing or the switch is already enabled, stop the release and correct the database through the normal deployment process.

After the new app version is deployed, the release owner enables email binding:

```sql
UPDATE public.caregiver_invitation_rollout
SET email_binding_enforced = true,
    updated_at = now()
WHERE singleton = true;

SELECT email_binding_enforced
FROM public.caregiver_invitation_rollout
WHERE singleton = true;
```

The final query must return `true`. If the app release is rolled back, setting the switch to `false` restores old-app invitation compatibility and also restores the legacy-code risk. Enable it again after the replacement app version is deployed. If invitation creation or redemption fails, run the local SQL suite and revoke and recreate the affected invitation. Do not inspect or copy production invitation rows.

## Deferred website work

Verified HTTPS invitation links, `sofibabytracker.com` landing pages, Apple Universal Links, Android App Links, and association files are deferred. The local `website/` directory is excluded from version control and has no documented deployment procedure, so it is not an authoritative deployment source. Invitations currently use manual copy, share, or dictation. Sofi does not send invitation email.
