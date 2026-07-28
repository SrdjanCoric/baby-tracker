# Task 0039: Restore returning users before opening Home

**Branch**: `feature/restore-returning-users-before-home`
**Depends on**: 0038
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: returning caregivers restore their existing family instead of creating a duplicate baby; network failures never masquerade as an empty account; empty accounts receive a useful next choice

## What to build

Implement Sign in as the returning-user path in the new onboarding state machine. Use intent-aware authentication and require a display name only when the account lacks one. After authentication, remain on a restoration state while Sofi refreshes the profile, household, babies, and selected baby.

When one or more babies load successfully, select the persisted baby when valid or the first household baby and open Home without showing new-owner setup or a first-activity prompt. When the server successfully confirms that the account has no babies, offer Add a baby and Join a family, routing into the existing new onboarding paths. When restoration fails or cannot distinguish empty from unavailable, show Retry and Sign out and do not permit baby creation from that failed state.

Do not change production onboarding routing or retire old screens in this task.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Model verified empty, loading, restored, unavailable, and signed-out states explicitly and strictly; prove with lint and typecheck.
- [ ] Add deterministic tests for success, selected-baby fallback, confirmed empty, unavailable, cancellation, sign-out, and retry behavior across auth and storage boundaries.
- [ ] Document restoration semantics and the distinction between verified empty and unavailable account data.
- [ ] Preserve session isolation and avoid logging auth payloads or restored family data.

## Implementation work

- [ ] Test-first, add returning-user auth, restoring, restored, verified-empty, unavailable, and signed-out states.
- [ ] Route Sign in from Welcome with a returning-user auth intent and resume after social or magic-link authentication.
- [ ] Require display-name completion only when missing.
- [ ] Refresh profile, household, babies, and persisted selection before Home can open.
- [ ] Select the persisted baby when it belongs to the restored household, otherwise select the first restored baby.
- [ ] On a verified empty result, offer Add a baby and Join a family through the new state machine.
- [ ] On network, auth, or refresh failure, show Retry and Sign out without interpreting the result as empty or offering baby creation.
- [ ] Prevent repeated auth callbacks and retries from creating a baby or dispatching stale household state.
- [ ] Add unit, component, provider integration, auth-resume, offline-failure, and Maestro coverage.
- [ ] Update onboarding restoration documentation, then run focused checks and the canonical code checks.

## Human checkpoints

- [ ] [confirm-security] Approve the final returning-auth intent, session restoration, household refresh, and sign-out boundaries before replacing the current navigation behavior.

## Acceptance criteria

- [ ] Returning users with household babies open Home with the correct selected baby and no setup prompts.
- [ ] Missing display names are collected without treating a loaded account as new.
- [ ] Only a successful verified-empty response offers Add a baby or Join a family.
- [ ] Unavailable data shows Retry and Sign out and cannot lead to duplicate baby creation.
- [ ] Auth cancellation, repeated callbacks, app restart, retry, and sign-out leave navigation and account scope consistent.
- [ ] The development flow distinguishes restored, verified empty, and unavailable states in automated tests.
- [ ] Production still uses the existing onboarding guard until the cutover task.
