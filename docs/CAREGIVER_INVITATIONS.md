# Caregiver invitations

Household owners authorize a caregiver's email before sharing an invitation code. The code uses the existing eight-character `XXXX-XXXX` format, expires after seven days, and works once. Owners may keep invitations pending for several email addresses, but a household has at most one current invitation for each normalized email.

## Security model

Migration `supabase/migrations/058_email_bound_caregiver_invitations.sql` creates `caregiver_invitations`. Clients cannot read or modify the table directly. Authenticated users call these RPCs:

- `create_caregiver_invitation(text)` creates or replaces an invitation for an email. The caller must own the household.
- `list_caregiver_invitations()` returns current invitations to the owner, including their readable codes.
- `revoke_caregiver_invitation(uuid)` revokes an invitation that belongs to the owner's household.
- `join_household_by_invite_code(varchar)` redeems an invitation for the caller's verified auth email.

Redemption locks the invitation row, checks its expiry and status, compares normalized email addresses, moves the caregiver, and records consumption in one transaction. Unknown codes, legacy household codes, wrong accounts, unverified accounts, expired invitations, revoked invitations, and consumed invitations return no household data. The response does not disclose the intended email or household.

The server permits five failed redemption attempts per authenticated user per hour. The app applies the same limit locally. Codes contain about 40 bits of entropy and exclude ambiguous characters. The intended email is not included in copied or shared text.

## Compatibility

Existing household memberships do not change. The migration keeps the existing `join_household_by_invite_code(varchar)` signature, so an older recipient app can redeem a new email-bound code. Older owner apps cannot create email-bound invitations, and old household-wide codes no longer authorize joins.

Deploy migration 058 before releasing the app update. Do not restore household-wide code authorization as a rollback because that would reopen unauthorized joins.

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
```

Every query must return a non-null object name. If any result is null, stop the release and apply the missing migration through the normal database deployment process. If invitation creation or redemption fails after deployment, confirm migration 058 is present, run the local SQL suite, and revoke and recreate the affected invitation. Do not inspect or copy production invitation rows.

## Deferred website work

Verified HTTPS invitation links, `sofibabytracker.com` landing pages, Apple Universal Links, Android App Links, and association files are deferred. The local `website/` directory is excluded from version control and has no documented deployment procedure, so it is not an authoritative deployment source. Invitations currently use manual copy, share, or dictation. Sofi does not send invitation email.
