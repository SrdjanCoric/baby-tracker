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

- [x] Model verified empty, loading, restored, unavailable, and signed-out states explicitly and strictly; prove with lint and typecheck.
- [x] Add deterministic tests for success, selected-baby fallback, confirmed empty, unavailable, cancellation, sign-out, and retry behavior across auth and storage boundaries.
- [x] Document restoration semantics and the distinction between verified empty and unavailable account data.
- [x] Preserve session isolation and avoid logging auth payloads or restored family data.

## Implementation work

- [x] Test-first, add returning-user auth, restoring, restored, verified-empty, unavailable, and signed-out states.
- [x] Route Sign in from Welcome with a returning-user auth intent and resume after social or magic-link authentication.
- [x] Require display-name completion only when missing.
- [x] Refresh profile, household, babies, and persisted selection before Home can open.
- [x] Select the persisted baby when it belongs to the restored household, otherwise select the first restored baby.
- [x] On a verified empty result, offer Add a baby and Join a family through the new state machine.
- [x] On network, auth, or refresh failure, show Retry and Sign out without interpreting the result as empty or offering baby creation.
- [x] Prevent repeated auth callbacks and retries from creating a baby or dispatching stale household state.
- [x] Add unit, component, provider integration, auth-resume, offline-failure, and Maestro coverage.
- [x] Update onboarding restoration documentation, then run focused checks and the canonical code checks.

## Human checkpoints

- [x] [confirm-security] Approved the returning-auth intent, restricted profile fallback, ordered household restoration, stale-attempt handling, and sign-out boundaries before implementation.

## Acceptance criteria

- [x] Returning users with household babies open Home with the correct selected baby and no setup prompts.
- [x] Missing display names are collected without treating a loaded account as new.
- [x] Only a successful verified-empty response offers Add a baby or Join a family.
- [x] Unavailable data shows Retry and Sign out and cannot lead to duplicate baby creation.
- [x] Auth cancellation, repeated callbacks, app restart, retry, and sign-out leave navigation and account scope consistent.
- [x] The development flow distinguishes restored, verified empty, and unavailable states in automated tests.
- [x] Production still uses the existing onboarding guard until the cutover task.

## Completion record

### Implementation

- Added explicit returning authentication, restoration, verified-empty, unavailable, restored, and signed-out states in `src/types/new-owner-onboarding.ts` and `src/services/new-owner-onboarding-storage.ts`.
- Added ordered restoration in `src/services/returning-user-restoration.ts`, including household-scoped persisted-selection validation and first-baby fallback.
- Added the restricted profile fallback in `src/components/ReturningUserProfileFallback.tsx`, the restoration screen in `app/onboarding/owner/restore.tsx`, and exhaustive preview routing in `src/services/new-owner-onboarding-routing.ts`.
- Serialized post-auth completion, made auth callback routing state-aware, and changed sign-out cleanup so a failed remote sign-out keeps local account data and queued work.
- Kept the new flow behind the existing development-only preview guard. Production routing was not cut over.

### Decisions and review

- The approved boundary keeps the normal provider tree closed until a valid authenticated sync identity exists. The fallback can refresh a missing profile identity, retry, or sign out without mounting activity providers.
- Compact task review used Standards, Spec, Bug, and Security lenses against `main` at initial head `0f36c29`. One remediation batch added documentation, provider integration proof, missing failure cases, restart and retry proof, exhaustive callback routes, single-owner profile restoration, terminal-state revalidation, and safe sign-out ordering.
- Two security risks were accepted. Post-auth returning state is not bound to a user ID because the user considered a shared-device account switch during restoration very unusual and unlikely. An in-flight household membership change is not bound to the attempt because the user considered that timing very unlikely and not an issue.
- No unresolved non-security findings remain, and the remediation did not require a second full review.

### Repository guidelines and documentation

- Loaded guideline references `00-overview`, `01-style-and-code-quality`, `02-testing`, `03-documentation`, and `07-security` in scope, implementation, and review modes.
- Strict typing and lint proof came from `npm run check:code`. Unit, component, provider integration, security, sync, and CI-contract suites passed.
- Updated `docs/NEW_OWNER_ONBOARDING_PREVIEW.md` with restoration states, refresh order, empty-versus-unavailable semantics, restart behavior, and validation commands. The write-well audit passed after one full pass.
- Updated the README sections **New owner onboarding preview** and **Testing**. The write-well audit passed after two full passes.

### Proof

- Focused Vitest proof covered the state machine, auth resume, preview routing, restoration outcomes, selection fallback, missing identity, failed storage, cancellation, stale attempts, and retry.
- Focused Jest proof covered Welcome intent, display-name completion, repeated callbacks, profile failure, restricted fallback, sign-out failure, restoration UI, SyncAuthGate, and real HouseholdProvider/BabyProvider restoration.
- Final `npm run check:code` passed: 125 Vitest files with 2,448 tests, 76 Jest suites with 756 tests, 13 security files with 110 tests, 20 sync files with 244 tests, and 41 CI-contract tests.
- The local-only Maestro flow `e2e/flows/onboarding/returning-user-restoration.yaml` passed against disposable Supabase fixtures. It proved pending-auth restart recovery, returning-owner sign-in, Home navigation with `E2E Baby`, and no new-owner baby setup prompt.
