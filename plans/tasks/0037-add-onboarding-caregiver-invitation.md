# Task 0037: Add optional account creation and caregiver invitation

**Branch**: `feature/add-onboarding-caregiver-invitation`
**Depends on**: 0035, 0036
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: guest owners understand that sharing requires an account; owners can skip sharing without being nagged later; account creation never loses the baby they just added

## What to build

Insert an account choice after Start tracking and before baby setup. Explain plainly that inviting a partner or caregiver requires an account so Sofi can synchronize everyone. Offer Sign in, Create account, and Continue on this device. A caregiver who continues on this device creates a local guest baby and proceeds to the first-activity chooser without another invitation prompt or later account reminder.

Use intent-aware authentication and return to the same onboarding flow after social authentication or a magic link. If the authenticated account already has a baby, complete onboarding and open the app without creating or migrating another baby. If it has no baby, require a display name when the profile lacks one, create the baby directly in its single-caregiver account workspace, then offer an optional caregiver invitation with Not now and Skip remaining setup. Authentication never assumes that the caregiver wants to invite someone.

Replace the current account-age heuristic used when a guest creates an account later with an explicit, durable guest-to-account migration. Preserve the guest snapshot until its authenticated copy, selected-baby mapping, applicable activity remapping, and server acknowledgement are durable. An exact single match on normalized name, birth date, and gender maps to the existing baby. A different or ambiguous account dataset requires an explicit choice: keep the account data and confirm deletion of the guest snapshot, or use another account while preserving the guest snapshot. Retries, restarts, duplicate auth callbacks, and Realtime echoes must not lose or duplicate data.

Do not implement the invited caregiver's join path or general returning-account startup restoration here.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [x] Keep authentication intent, migration phase, ID mapping, and retry state strictly typed; prove with lint and typecheck.
- [x] Test the auth, persistence, sync, and navigation boundaries with controlled Supabase fixtures and deterministic failure injection.
- [x] Document the migration invariant, recovery behavior, development test accounts, and focused verification commands.
- [x] Preserve current authentication and security checks; do not log tokens, email addresses, invite codes, baby data, or provider payloads.

## Implementation work

- [x] Test-first, extend the onboarding state model with account choice, auth pending, authenticated baby setup, invitation ready, skipped, and recovery states.
- [x] Add fully translated copy that explicitly says an account is required to invite a caregiver and that guest data otherwise remains on the current device.
- [x] Add Sign in, Create account, Continue on this device, Not now, and Skip remaining setup without adding a later reminder.
- [x] Make the auth UI reflect onboarding intent while retaining Apple, Google, and email magic-link methods.
- [x] Route authenticated accounts with babies into the app and accounts without babies into authenticated baby setup without treating a single caregiver as an error.
- [x] Require and persist the caregiver display name when the authenticated profile lacks one before creating an invitation.
- [x] For later guest authentication, merge an exact single baby match and require an explicit keep-account or use-another-account choice for different or ambiguous data.
- [x] Replace account-age detection with a durable migration record that survives restart and makes completion idempotent.
- [x] Preserve the guest snapshot until authenticated baby creation or matching, activity remapping when applicable, selected-baby persistence, and server acknowledgement succeed.
- [x] Recover from cancellation, network failure, app restart, repeated callbacks, and Realtime acknowledgements without duplication or hidden data.
- [x] Present the verified code from Task 0035; dismissing or failing to open the share sheet must still let onboarding continue.
- [x] Add unit, component, integration, local Supabase, auth-resume, and failure-recovery tests.
- [x] Update onboarding and migration documentation, then run focused checks and the canonical code checks.

## Human checkpoints

- [x] [decision] Put authentication before baby creation during onboarding. Existing accounts with babies open the app; accounts without babies continue to authenticated baby setup and may skip invitation. Later guest authentication uses exact matching or an explicit keep-account/use-another-account choice.
- [x] [confirm-security] The user approved durable intent-based auth return, profile recovery before authenticated baby creation, display-name enforcement before invitation, guest snapshot retention until durable migration or explicit deletion, no automatic shared-data deletion, and redacted auth/family logs.
- [x] [accepted-security] The user accepted retaining an interrupted guest-migration record, health data, and milestone data after a normal sign-out because that local persistence is acceptable. Guest deletion still requires a separate destructive confirmation.

## Acceptance criteria

- [x] Account choice appears before baby creation, and the account requirement is explicit before authentication.
- [x] The guest path creates a local baby and proceeds without an invitation prompt or later reminder.
- [x] Authenticated accounts with babies open the app; accounts without babies create an authenticated baby before the optional invitation step.
- [x] Not now and Skip remaining setup work without creating an invitation or scheduling a later reminder.
- [x] Missing display names are collected before a caregiver can be invited.
- [x] Social and magic-link authentication return to the pending onboarding state after cancellation-safe, restart-safe navigation.
- [x] Later guest data is cleared only after durable migration or explicit confirmation to keep differing account data.
- [x] Retries, callbacks, and Realtime acknowledgements cannot create a duplicate baby or lose the guest snapshot.
- [x] The owner can share the verified code or dismiss sharing and continue.
- [x] Logs and errors expose no credentials, emails, invite codes, provider payloads, or baby data.

## Completion record

- **Implementation:** Account choice now precedes baby setup, and authentication returns to its saved onboarding state. Authenticated setup can offer a verified invitation. Guest-to-account migration keeps stable IDs and waits for server acknowledgement before clearing guest data.
- **Review:** Task review completed in two remediation passes against `main`. Remediation added auth retry and strict route-parameter validation. It also covered full dataset conflicts, invitation restore failures, and a second confirmation before guest deletion.
- **Guidelines:** References 01, 02, 03, and 07 were checked. `npm run check` proved the code and local SQL behavior against the repository's maintained gates.
- **Documentation:** Updated `README.md` and the onboarding and invitation guides. The guest migration debug note now describes the durable invariant. The README and changed prose passed two write-well audit passes.
- **Proof:** `npm run check` passed 2,413 unit tests and 716 component tests. It also passed 107 security tests, 244 sync tests, 41 CI contract tests, and all SQL vectors. The iOS Maestro onboarding restart flow passed from account choice through Start over.
- **Accepted risk:** A normal sign-out may retain an interrupted guest-migration record plus local health and milestone data. The user accepted that local persistence; choosing Keep account data still requires a separate destructive confirmation.
