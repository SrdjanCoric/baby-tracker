# Task 0035: Create email-bound caregiver invitations

**Branch**: `feature/share-verified-caregiver-invitation-links`
**Depends on**: none
**Source**: onboarding improvement conversation 2026-07-28, revised during implementation 2026-08-01 · **User stories**: owners authorize a specific caregiver before sharing a readable code; recipients can redeem the code only from the intended verified account; existing households and older recipient clients continue working

## What to build

Replace household-wide join authorization with single-use invitations bound to a normalized caregiver email. An owner enters the intended email in Household settings, receives the existing readable `XXXX-XXXX` code format, and copies, shares, or dictates the code manually. The recipient signs in or creates an account and explicitly submits the code. The server permits the join only when the authenticated account has the matching verified email.

Each invitation expires after seven days. A household may have invitations pending for multiple caregivers, but only one active invitation per normalized email. Owners can view, copy, replace, and revoke pending invitations. Existing memberships and household data remain unchanged.

Keep the existing `join_household_by_invite_code` RPC signature so older recipient app versions can redeem newly issued codes. Migration 058 must default to a compatibility period in which legacy household-wide codes still work, so applying the migration before the app release does not block older owner apps. After the new app version is deployed, the release owner explicitly enables email enforcement and legacy codes stop authorizing joins. HTTPS invitation links, website deployment, Universal Links, App Links, association files, automatic email delivery, and onboarding UI are deferred.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [x] Keep invitation creation and redemption typed, deterministic, and free of family details; prove with lint, typecheck, focused tests, and local SQL integration tests.
- [x] Test owner authorization, email normalization and validation, expiry, revocation, replacement, one-time redemption, generic failure responses, rate limiting, and the legacy RPC signature without production services.
- [x] Document the invitation security model, compatibility behavior, operational checks, and the deferred website deployment work in repository-owned documentation.
- [x] Preserve security scanning, secret detection, and dependency-audit posture without adding an email, analytics, or deferred-linking dependency.

## Implementation work

- [x] Add persistent email-bound caregiver invitations with seven-day expiry and one active invitation per household/email pair.
- [x] Add owner-authorized operations to create or replace, list, and revoke pending invitations.
- [x] Keep the readable eight-character code format and server-side attempt limiting.
- [x] Replace the household-wide join implementation behind the existing RPC signature with atomic verified-email matching, single-use redemption, and an explicit post-release enforcement switch.
- [x] Preserve existing household memberships and current join cleanup/data-loss behavior.
- [x] Update Household settings so owners can enter an email and copy, share, replace, or revoke pending invitation codes.
- [x] Keep explicit recipient submission in the existing join UI and show generic errors for unknown, mismatched, expired, revoked, or consumed invitations.
- [x] Add automated migration, service, component, authorization, malformed-input, expiry, replacement, revocation, one-time-use, and backward-compatibility tests.
- [x] Document the security model, compatibility behavior, local verification, rollout checks, and recovery.

## Human checkpoints

- [x] [decision] Use `sofibabytracker.com` as a future canonical host, but defer URL links and deployment because the local static website has no version-controlled deployment procedure.
- [x] [decision] Use manually shared email-bound codes now; keep Settings in this task and onboarding invitation UI in Tasks 0037/0038.
- [x] [decision] Use single-use seven-day invitations, allow multiple intended caregivers, replace only the invitation for the same normalized email, and keep owner-visible codes.
- [x] [confirm-security] Owner-only invitation management, verified-email redemption, generic failures, atomic single use, server-side rate limiting, and the preserved legacy RPC signature approved by the user.
- [x] [decision] Migration 058 starts in compatibility mode so old household codes work until the new app version is deployed; the release owner then enables email enforcement through a documented database switch.

## Acceptance criteria

- [x] An owner can create a seven-day invitation for an email and copy or manually share its readable code.
- [x] Owners can manage multiple pending caregiver invitations and replace or revoke each one independently.
- [x] Only an authenticated account with the matching verified email can redeem a current invitation, and redemption still requires an explicit button press.
- [x] A code cannot be redeemed after expiry, revocation, replacement, or successful use.
- [x] Unknown and unauthorized invitation attempts do not disclose the intended email or household.
- [x] Existing memberships remain intact, and an older recipient client can redeem a newly issued code through the preserved RPC signature.
- [x] Legacy household-wide codes remain usable before app deployment and no longer authorize joins after the release owner enables email enforcement.
- [x] No email-delivery, deferred-linking, or analytics dependency is added.
- [x] Automated verification covers valid, malformed, unauthorized, expired, revoked, replaced, consumed, rate-limited, and backward-compatible behavior.

## Implementation record

- Migration: `supabase/migrations/058_email_bound_caregiver_invitations.sql` adds invitation storage, owner-only management RPCs, verified-email redemption, persistent attempt limiting, and the release-controlled compatibility switch.
- App: `app/settings/household.tsx` manages pending invitations; `app/settings/join-household.tsx` retains explicit code submission and shows one rejection message.
- Services and translations: `src/services/household-service.ts` exposes typed invitation operations, and all nine locale files contain the new workflow copy.
- Compatibility: the migration defaults to legacy-code fallback, new email-bound codes work before and after cutover, and the release owner enables enforcement only after app deployment.

## Repository-guideline proof

- Loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, and `references/07-security.md` in scope, implementation, and review modes.
- `npm run check` passed lint, strict type checking, 2,335 unit tests, 680 component tests, 103 security tests, 244 sync tests, 41 CI contract tests, a clean local migration reset, and the SQL authorization suite.
- `npm run audit:dependencies` passed with the repository's existing reviewed exception and no new dependency.
- `docs/CAREGIVER_INVITATIONS.md`, `docs/SECURITY.md`, `CLAUDE.md`, and the README document the current behavior, rollout switch, release check, recovery, and deferred website work.

## TDD and review

- Observed red-green cycles for invitation creation, listing, revocation, verified-email redemption, owner UI, invitation expiry display, generic rejection messaging, readable code sharing, and staged legacy compatibility.
- Task review used `base=main` with Standards, Spec, Bug, and Security lenses. It fixed readable-code sharing, app-language expiry formatting, explicit replacement and consumed-code proof, non-owner management coverage, and keyboard dismissal.
- Final review found no unresolved non-security findings. The two accepted security risks below remain visible for PR review.

## README and proof

- Added **Caregiver Invitations** under Architecture and updated the migration range in Project Structure.
- `write-well` completed one full audit pass over the README changes with no remaining findings.
- Highest-level proof: `npm run check` passed after review and rollout remediation. Production migration inspection and the post-deployment switch remain release-owner operations documented in `docs/CAREGIVER_INVITATIONS.md`; no production system was accessed during implementation.

## Accepted security risks

- `get_household_babies_by_invite_code(varchar)` remains executable for compatibility with current users. The user accepted that a caller with a legacy household code could use this unused RPC to read baby profile fields. The current app and repository history contain no client call to this function.
- Legacy household-wide joins remain enabled between migration 058 and the post-deployment cutover. The user accepted this temporary exposure so applying the migration cannot break invitations from old app versions.

## Deferred work

Verified HTTPS invitation links, the `sofibabytracker.com` landing page, Apple and Android association files, website deployment documentation, and onboarding invitation screens require future planning. The currently discovered `website/` directory is excluded through `.git/info/exclude` and is not an authoritative deployment source.
