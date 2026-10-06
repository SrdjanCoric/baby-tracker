# Task 0106: Handle a shared login that changed before the app's save or sign-out

**Branch**: `feature/handle-shared-session-change`
**Depends on**: 0103
**Base**: `main` after Task 0103 has merged.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: Sentry REACT-NATIVE-S and REACT-NATIVE-T, 2026-10-06, iOS 4.9.14; conversation
2026-10-06 · **User stories**: a caregiver stays signed in after a background token refresh, and
signing out signs the app, widget, and Watch out, even when the widget or Watch touched the shared
login a moment earlier.

## What to build

On iOS the app, widget, and Watch share one stored login. Every save or removal of it states the
version the app last read. When the stored login has changed since that read, the native layer
refuses the save ("The shared session changed before this write") or the removal ("The shared
session changed before this removal"). Today that refusal reaches the caller as an error on the
normal save and sign-out paths; only a replay of a queued save after a lost lock tolerates it.

First reproduce both refusals locally and record what the user experiences after each. Then make
each case end in the outcome below.

| Case | Stored login at the time of the app's save or removal | Required outcome |
| --- | --- | --- |
| Token save | Same login, already refreshed to a newer version by the widget or Watch | The newer stored version is kept; the app keeps working signed in with it; no error reaches the caller or Sentry; a breadcrumb records the conflict |
| Token save | A different login (another sign-in completed in between) | The other login is kept, never overwritten; the app keeps working with the stored login; no error reaches Sentry; a breadcrumb records it |
| Token save | No stored login (removed in between) | Nothing is written; the app treats the user as signed out; a breadcrumb records it |
| Sign-out | Same login, newer version | The stored login is removed; app, widget, and Watch are signed out |
| Sign-out | A different login | That other login is kept; the app's own sign-out completes; a breadcrumb records it |
| Sign-out | No stored login | Sign-out completes; nothing to remove; no error |
| Either | Read or delete of the stored login fails for any other reason | Unchanged: the error reaches the caller and is reported as today |

"Same login" and "different login" use the existing login lineage the stored envelope already
records; "version" is its existing revision.

If diagnosis shows a row is unreachable, or that the current behavior already meets its outcome, the
task records the evidence in its Implementation evidence and changes nothing for that row.

## Decided

- Not a blocker for 4.10.2 or Tasks 0104 and 0105 — owner, 2026-10-06.
- Diagnose first with the `diagnose` skill and reproduce before changing code — repository rule for
  Sentry-driven fixes.
- The native version check stays: the app must never overwrite a newer or different stored login.
- No agent connects to production or changes Sentry settings.

## Clarifications

## Non-goals

- Lock abandonment and lock-file errors (Tasks 0088 and 0097, Sentry REACT-NATIVE-9).
- The manifest permission error (REACT-NATIVE-8) and app hangs (Task 0098).
- Android and Wear OS, which do not use this shared iOS login.
- Changing when the widget or Watch refreshes the login.

## Context

Both Sentry issues have one event each, first seen 2026-10-06 on 4.9.14, and Sentry splits them only
by message. The refusals come from the version checks in the shared-session native module's write
and removal. The JavaScript storage adapter reads the stored login, then saves or removes with the
read version; Supabase auth calls it on token save and sign-out. How a widget or Watch change can
land between that read and the write while the cross-process session lock is supposed to be held is
unverified; lock abandonment after suspension (Tasks 0088 and 0097) is one candidate. Task 0097 is
the precedent for treating an expected native outcome as a breadcrumb instead of an error.

## Implementation work

- [ ] Both refusals are reproduced and the observed user effect is recorded per table row — proven
      in `src/services/shared-supabase-session.test.ts`.
- [ ] Token saves meet the three token-save rows — proven in
      `src/services/shared-supabase-session.test.ts`.
- [ ] Sign-out meets the three sign-out rows, including a newer version of the same login being
      removed — proven in `src/services/shared-supabase-session.test.ts` and
      `scripts/swift/shared-supabase-session-tests.swift`.
- [ ] Other read and delete failures still reach the caller and Sentry — proven in
      `src/services/shared-supabase-session-native.test.ts`.

## Human checkpoints

- [ ] [confirm-security] Approve any change to how sign-out removes a newer version of the same
      stored login (session and Keychain trust boundary from Task 0083).

## Acceptance criteria

- [ ] Every table row holds in the tests named above.
- [ ] `npm run check` passes, with Docker running.
