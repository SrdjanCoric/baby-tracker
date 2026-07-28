# Task 0035: Create email-bound caregiver invitations

**Branch**: `feature/share-verified-caregiver-invitation-links`
**Depends on**: none
**Source**: onboarding improvement conversation 2026-07-28, revised during implementation 2026-08-01 · **User stories**: owners authorize a specific caregiver before sharing a readable code; recipients can redeem the code only from the intended verified account; existing households and older recipient clients continue working

## What to build

Replace household-wide join authorization with single-use invitations bound to a normalized caregiver email. An owner enters the intended email in Household settings, receives the existing readable `XXXX-XXXX` code format, and copies, shares, or dictates the code manually. The recipient signs in or creates an account and explicitly submits the code. The server permits the join only when the authenticated account has the matching verified email.

Each invitation expires after seven days. A household may have invitations pending for multiple caregivers, but only one active invitation per normalized email. Owners can view, copy, replace, and revoke pending invitations. Existing memberships and household data remain unchanged.

Keep the existing `join_household_by_invite_code` RPC signature so older recipient app versions can redeem newly issued codes. Legacy household-wide codes must no longer authorize a join, and older owner apps cannot create new invitations. HTTPS invitation links, website deployment, Universal Links, App Links, association files, automatic email delivery, and onboarding UI are deferred.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Keep invitation creation and redemption typed, deterministic, and free of family details; prove with lint, typecheck, focused tests, and local SQL integration tests.
- [ ] Test owner authorization, email normalization and validation, expiry, revocation, replacement, one-time redemption, generic failure responses, rate limiting, and the legacy RPC signature without production services.
- [ ] Document the invitation security model, compatibility behavior, operational checks, and the deferred website deployment work in repository-owned documentation.
- [ ] Preserve security scanning, secret detection, and dependency-audit posture without adding an email, analytics, or deferred-linking dependency.

## Implementation work

- [ ] Add persistent email-bound caregiver invitations with seven-day expiry and one active invitation per household/email pair.
- [ ] Add owner-authorized operations to create or replace, list, and revoke pending invitations.
- [ ] Keep the readable eight-character code format and server-side attempt limiting.
- [ ] Replace the household-wide join implementation behind the existing RPC signature with atomic verified-email matching and single-use redemption.
- [ ] Preserve existing household memberships and current join cleanup/data-loss behavior.
- [ ] Update Household settings so owners can enter an email and copy, share, replace, or revoke pending invitation codes.
- [ ] Keep explicit recipient submission in the existing join UI and show generic errors for unknown, mismatched, expired, revoked, or consumed invitations.
- [ ] Add automated migration, service, component, authorization, malformed-input, expiry, replacement, revocation, one-time-use, and backward-compatibility tests.
- [ ] Document the security model, compatibility behavior, local verification, rollout checks, and recovery.

## Human checkpoints

- [x] [decision] Use `sofibabytracker.com` as a future canonical host, but defer URL links and deployment because the local static website has no version-controlled deployment procedure.
- [x] [decision] Use manually shared email-bound codes now; keep Settings in this task and onboarding invitation UI in Tasks 0037/0038.
- [x] [decision] Use single-use seven-day invitations, allow multiple intended caregivers, replace only the invitation for the same normalized email, and keep owner-visible codes.
- [x] [confirm-security] Owner-only invitation management, verified-email redemption, generic failures, atomic single use, server-side rate limiting, disabled legacy household-code authorization, and preserved legacy RPC signature approved by the user.

## Acceptance criteria

- [ ] An owner can create a seven-day invitation for an email and copy or manually share its readable code.
- [ ] Owners can manage multiple pending caregiver invitations and replace or revoke each one independently.
- [ ] Only an authenticated account with the matching verified email can redeem a current invitation, and redemption still requires an explicit button press.
- [ ] A code cannot be redeemed after expiry, revocation, replacement, or successful use.
- [ ] Unknown and unauthorized invitation attempts do not disclose the intended email or household.
- [ ] Existing memberships remain intact, and an older recipient client can redeem a newly issued code through the preserved RPC signature.
- [ ] Legacy household-wide codes no longer authorize joins.
- [ ] No email-delivery, deferred-linking, or analytics dependency is added.
- [ ] Automated verification covers valid, malformed, unauthorized, expired, revoked, replaced, consumed, rate-limited, and backward-compatible behavior.

## Accepted security risks

- `get_household_babies_by_invite_code(varchar)` remains executable for compatibility with current users. The user accepted that a caller with a legacy household code could use this unused RPC to read baby profile fields. The current app and repository history contain no client call to this function.

## Deferred work

Verified HTTPS invitation links, the `sofibabytracker.com` landing page, Apple and Android association files, website deployment documentation, and onboarding invitation screens require future planning. The currently discovered `website/` directory is excluded through `.git/info/exclude` and is not an authoritative deployment source.
