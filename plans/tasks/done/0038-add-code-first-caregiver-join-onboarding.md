# Task 0038: Add code-first invited-caregiver onboarding

**Branch**: `feature/add-code-first-caregiver-join-onboarding`
**Depends on**: 0037
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: invited caregivers start with the code they received; authentication does not discard their invitation; successful joining opens the shared baby without unnecessary setup

## What to build

Implement Join a family as a first-class path in the new onboarding state machine. Accept manual code entry before authentication. Validate and persist the code locally when the caregiver presses Continue, then authenticate and collect a required display name without querying or mutating household state. Return to the same code screen with the normalized code preserved and submit only when the authenticated caregiver presses Join family. Preserve the code through social auth, magic-link return, cancellation, restart, and retry. Verified HTTPS links, Universal Links, Android App Links, and invitation-code route prefills remain deferred.

After authentication, submit the code through the existing rate-limited household join boundary. Empty accounts join normally. If the account has current solo baby data, retain the user-approved destructive behavior but replace vague wording with an explicit irreversible warning and a destructive button labeled Delete my data and join. Cancel must preserve all data and return to the code flow. On success, refresh profile, household membership, babies, and selected baby before opening Home. Joined caregivers bypass baby setup and the first-activity prompt.

Handle invalid, expired, own-household, already-shared-household, rate-limited, partial-refresh, offline, and cancelled states without losing the code or navigating to an empty dashboard.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [x] Keep code state, auth intent, destructive confirmation, and join outcomes strictly typed and warning-free; prove with lint and typecheck.
- [x] Test critical success, validation, authorization, rate-limit, destructive, retry, and refresh boundaries against controlled local fixtures.
- [x] Document the join state machine, accepted deletion risk, local fixture setup, and recovery behavior.
- [x] Preserve authentication, authorization, rate-limiting, and secret-detection controls; never submit a link-prefilled code without an authenticated explicit action.

## Implementation work

- [x] Test-first, add named Join a family states for code entry, auth pending, confirmation, joining, refresh, recoverable failure, and completion.
- [x] Normalize manually entered codes and reject malformed values locally.
- [x] Persist the pending code through every auth method, app restart, cancellation, and retry.
- [x] Require a caregiver display name when the authenticated profile lacks one.
- [x] Keep server validation and mutation behind authenticated explicit confirmation and existing client/server rate limits.
- [x] Detect current solo baby data before join and show the agreed irreversible warning with Cancel and Delete my data and join.
- [x] Preserve current data on Cancel; retain the existing destructive server behavior only after the explicit destructive action.
- [x] Refresh auth profile, household, babies, and selection after a successful join before navigation.
- [x] Keep the caregiver on a recoverable state when post-join refresh partially fails rather than presenting a false empty household.
- [x] Open Home directly after successful loading, with no baby setup or first-activity prompt.
- [x] Add unit, component, local Supabase integration, security, rate-limit, restart, and Maestro coverage.
- [x] Update onboarding and household-join documentation, then run focused checks and the canonical code checks.

## Human checkpoints

- [x] [confirm-security] Approve the final manual-code, authentication, explicit-submit, destructive-confirmation, and household-membership trust boundaries before enabling the new join route. Approved: Continue only validates and persists; after authentication and display-name completion, Join family explicitly submits from the same screen; destructive solo-data deletion requires a separate confirmation.

## Accepted security risks

- The caregiver confirmation state can survive display-name completion or session loss. The user accepted this because the app supports accounts without display names and the server still rejects unauthenticated redemption.
- Source baby detection relies on the loaded client snapshot before destructive confirmation. The user accepted the risk that an unavailable or stale snapshot could omit remote solo data and retained the existing server join behavior.

## Acceptance criteria

- [x] Join a family starts with manual code entry before authentication.
- [x] No invitation lookup or submission occurs before an authenticated caregiver explicitly submits a valid code.
- [x] Authentication, display-name completion, cancellation, magic-link return, restart, and retry preserve the normalized code.
- [x] Empty accounts can join and load the shared household normally.
- [x] Accounts with solo baby data see an irreversible warning and must choose Delete my data and join before deletion occurs.
- [x] Cancel leaves all current data intact.
- [x] Invalid, own-household, already-shared, rate-limited, offline, and partial-refresh states remain recoverable.
- [x] Home opens only after the joined household and a selected baby are available, with no first-activity prompt.
- [x] Automated coverage proves the existing server rate limit and destructive behavior remain enforced.

## Verification

- `npm run check:code` — passed: 123 unit files / 2,426 tests, 73 component suites / 739 tests, 109 security tests, 244 sync tests, and 41 CI contract tests.
- `npm run test:sql` — passed, including 26 CRDT vectors, 49 merge assertions, caregiver invitation authorization/rate-limit/destructive cases, and concurrency checks.
- `npm run e2e:prepare-caregiver-join` plus `maestro test e2e/flows/onboarding/caregiver-code-join.yaml` — passed on iPhone 17 Pro; proved code normalization, auth cancellation and restart persistence, explicit redemption, joined-household refresh, selected shared baby, and Home navigation.
- `bash -n e2e/scripts/lib/local-supabase.sh e2e/scripts/start-caregiver-join-metro.sh e2e/scripts/prepare-caregiver-join.sh` — passed.
