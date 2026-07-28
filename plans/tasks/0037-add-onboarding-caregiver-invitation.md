# Task 0037: Add optional account creation and caregiver invitation

**Branch**: `feature/add-onboarding-caregiver-invitation`
**Depends on**: 0035, 0036
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: guest owners understand that sharing requires an account; owners can skip sharing without being nagged later; account creation never loses the baby they just added

## What to build

Insert an optional Track together step after the Start tracking baby is durably created and before the first-activity chooser. Explain plainly that inviting a partner or caregiver requires an account so Sofi can synchronize everyone. Offer Create account and invite, Not now, and the existing Skip remaining setup behavior. Do not add a later backup or account reminder.

When the owner chooses the account path, use intent-aware authentication, require a display name when the profile lacks one, and return to the same onboarding flow after social authentication or a magic link. Replace the current account-age heuristic with an explicit, durable guest-to-account migration. Preserve the guest baby until its authenticated household copy and selected-baby mapping are acknowledged; retries, restarts, duplicate auth callbacks, and Realtime echoes must not lose or duplicate it. After migration, present the verified invitation from Task 0035 and allow the owner to continue even if they dismiss the system share sheet.

Do not implement the invited caregiver's join path or returning-account restoration here.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Keep authentication intent, migration phase, ID mapping, and retry state strictly typed; prove with lint and typecheck.
- [ ] Test the auth, persistence, sync, and navigation boundaries with controlled Supabase fixtures and deterministic failure injection.
- [ ] Document the migration invariant, recovery behavior, development test accounts, and focused verification commands.
- [ ] Preserve current authentication and security checks; do not log tokens, email addresses, invite codes, baby data, or provider payloads.

## Implementation work

- [ ] Test-first, extend the onboarding state model with Track together, auth pending, migration pending, invitation ready, skipped, and recovery states.
- [ ] Add fully translated copy that explicitly says account creation is required to invite a caregiver and that guest data otherwise remains on the current device.
- [ ] Add Create account and invite, Not now, and Skip remaining setup without adding a later reminder.
- [ ] Make the auth UI reflect onboarding intent while retaining Apple, Google, and email magic-link methods.
- [ ] Require and persist the caregiver display name when the authenticated profile lacks one.
- [ ] Define explicit behavior for the edge case where an OAuth identity already belongs to an account with household baby data before migrating the new guest baby.
- [ ] Replace account-age detection with a durable migration record that survives restart and makes completion idempotent.
- [ ] Preserve the guest snapshot until authenticated baby creation, activity remapping when applicable, selected-baby persistence, and server acknowledgement succeed.
- [ ] Recover from cancellation, network failure, app restart, repeated callbacks, and Realtime acknowledgements without duplication or hidden data.
- [ ] Present the verified link and code from Task 0035; dismissing or failing to open the share sheet must still let onboarding continue.
- [ ] Add unit, component, integration, local Supabase, auth-resume, and failure-recovery tests.
- [ ] Update onboarding and migration documentation, then run focused checks and the canonical code checks.

## Human checkpoints

- [ ] [decision] Decide how Start tracking handles an OAuth identity that is already attached to a household with baby data, while preserving the newly created guest baby (`talk-it-through`).
- [ ] [confirm-security] Approve the final intent-aware auth return contract, display-name requirement, guest snapshot lifetime, and authenticated migration boundary before replacing the current heuristic.

## Acceptance criteria

- [ ] The optional caregiver screen appears after baby creation and before the optional first activity.
- [ ] The account requirement is explicit before the user starts authentication.
- [ ] Not now and Skip remaining setup work without scheduling a later account reminder.
- [ ] Missing display names are collected before a caregiver can be invited.
- [ ] Social and magic-link authentication return to the pending caregiver step after cancellation-safe, restart-safe navigation.
- [ ] Guest data is cleared only after the authenticated copy and ID mapping are durable.
- [ ] Retries, callbacks, and Realtime acknowledgements cannot create a duplicate baby or lose the guest snapshot.
- [ ] The owner can share the verified link and code or dismiss sharing and continue.
- [ ] Logs and errors expose no credentials, invite codes, or baby data.
