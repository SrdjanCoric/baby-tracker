# Task 0038: Add code-first invited-caregiver onboarding

**Branch**: `feature/add-code-first-caregiver-join-onboarding`
**Depends on**: 0037
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: invited caregivers start with the code they received; authentication does not discard their invitation; successful joining opens the shared baby without unnecessary setup

## What to build

Implement Join a family as a first-class path in the new onboarding state machine. Accept manual code entry or the verified-link prefill from Task 0035 before authentication. Validate format locally, but do not query or mutate household state until the caregiver authenticates and has a required display name. Preserve the normalized code through social auth, magic-link return, cancellation, restart, and retry.

After authentication, submit the code through the existing rate-limited household join boundary. Empty accounts join normally. If the account has current solo baby data, retain the user-approved destructive behavior but replace vague wording with an explicit irreversible warning and a destructive button labeled Delete my data and join. Cancel must preserve all data and return to the code flow. On success, refresh profile, household membership, babies, and selected baby before opening Home. Joined caregivers bypass baby setup and the first-activity prompt.

Handle invalid, expired, own-household, already-shared-household, rate-limited, partial-refresh, offline, and cancelled states without losing the code or navigating to an empty dashboard.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Keep code state, auth intent, destructive confirmation, and join outcomes strictly typed and warning-free; prove with lint and typecheck.
- [ ] Test critical success, validation, authorization, rate-limit, destructive, retry, and refresh boundaries against controlled local fixtures.
- [ ] Document the join state machine, accepted deletion risk, local fixture setup, and recovery behavior.
- [ ] Preserve authentication, authorization, rate-limiting, and secret-detection controls; never submit a link-prefilled code without an authenticated explicit action.

## Implementation work

- [ ] Test-first, add named Join a family states for code entry, auth pending, confirmation, joining, refresh, recoverable failure, and completion.
- [ ] Prefill and normalize verified-link codes without automatic submission; reject malformed values locally.
- [ ] Persist the pending code through every auth method, app restart, cancellation, and retry.
- [ ] Require a caregiver display name when the authenticated profile lacks one.
- [ ] Keep server validation and mutation behind authenticated explicit confirmation and existing client/server rate limits.
- [ ] Detect current solo baby data before join and show the agreed irreversible warning with Cancel and Delete my data and join.
- [ ] Preserve current data on Cancel; retain the existing destructive server behavior only after the explicit destructive action.
- [ ] Refresh auth profile, household, babies, and selection after a successful join before navigation.
- [ ] Keep the caregiver on a recoverable state when post-join refresh partially fails rather than presenting a false empty household.
- [ ] Open Home directly after successful loading, with no baby setup or first-activity prompt.
- [ ] Add unit, component, local Supabase integration, security, rate-limit, restart, and Maestro coverage.
- [ ] Update onboarding and household-join documentation, then run focused checks and the canonical code checks.

## Human checkpoints

- [ ] [confirm-security] Approve the final code-prefill, authentication, explicit-submit, destructive-confirmation, and household-membership trust boundaries before enabling the new join route.

## Acceptance criteria

- [ ] Join a family starts with manual or prefilled code entry before authentication.
- [ ] A prefilled code is visible but never submitted automatically.
- [ ] Authentication, display-name completion, cancellation, magic-link return, restart, and retry preserve the normalized code.
- [ ] Empty accounts can join and load the shared household normally.
- [ ] Accounts with solo baby data see an irreversible warning and must choose Delete my data and join before deletion occurs.
- [ ] Cancel leaves all current data intact.
- [ ] Invalid, own-household, already-shared, rate-limited, offline, and partial-refresh states remain recoverable.
- [ ] Home opens only after the joined household and a selected baby are available, with no first-activity prompt.
- [ ] Automated coverage proves the existing server rate limit and destructive behavior remain enforced.
