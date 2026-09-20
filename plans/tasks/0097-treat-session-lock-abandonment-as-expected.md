# Task 0097: Treat shared-session lock abandonment as an expected outcome

**Branch**: `hotfix/4.9.18-session-lock-abandonment`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). Not `main`.
**Execution classification**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: yes.
**Source**: Sentry REACT-NATIVE-9 (12 users), REACT-NATIVE-B (5 users), REACT-NATIVE-F (1 user),
2026-09-14 → 2026-09-19, all iOS 4.9.14, all `in_foreground: false` · **User stories**: a caregiver's
app never surfaces a crash-level error because iOS suspended it mid-refresh; the widget and Watch keep
their last good data and refresh next time.

## What to build

Task 0088 made the shared Supabase session lock abandon its critical section instead of holding a
file lock across suspension. Its three abandon outcomes are now the three Sentry issues:

| Native abandon reason | Sentry issue | Meaning |
| --- | --- | --- |
| No background assertion granted | REACT-NATIVE-F | iOS refused background time |
| Assertion expired before acquisition | REACT-NATIVE-B | App suspended while waiting |
| Lock file open failed, errno 1 | REACT-NATIVE-9 | App Group file unreadable (locked device) |

Each one is rejected to JavaScript, rethrown by the lock wrapper, and reaches `onunhandledrejection`
because the callers (Supabase auth transactions, widget data refresh, Watch refresh) have no catch
for it.

After this task, every lock abandonment is an expected, non-fatal outcome at each caller: the body
that needed the lock is skipped, previously known data is kept, the next foreground or scheduled
refresh tries again, and Sentry records at most a breadcrumb — never an error-level event.

| Condition | Result |
| --- | --- |
| Lock abandoned for any of the three reasons, app not in foreground | Skip the body; keep prior data; breadcrumb only |
| Lock abandoned for any of the three reasons, app in foreground | Skip the body; keep prior data; report at warning level once per session |
| Lock timed out (busy holder) | Unchanged behavior |
| Lock acquired | Unchanged behavior |
| Abandon reason unrecognized | Treat as an error as today |

## Decided

- Reproduce first with `diagnose`: the feedback loop is a unit test that drives the wrapper with each
  native rejection code and observes whether the rejection escapes. Because the errors are
  deterministic native codes, no device repro is required to fix; the device check is verification.
- The native lock protocol from Task 0088 is unchanged. This task changes only how JavaScript
  consumes its outcomes — the protocol is the security boundary approved on 2026-08-16.
- Grouping: the three Sentry issues are one task because they are one function's three exits.

## Clarifications

## Non-goals

- Retrying the abandoned body in the background.
- The AsyncStorage file-protection failure on the same wake — Task 0096.
- The 0xDEAD10CC device verification still open on Task 0088.

## Context

Every event carries `mechanism: onunhandledrejection` and no stack trace, which is how a bare native
rejection looks. Users are on 4.9.14, the first build that carried Task 0088. Sentry issues:
https://sofibaby.sentry.io/issues/REACT-NATIVE-9 · REACT-NATIVE-B · REACT-NATIVE-F

## Implementation work

- [x] The lock wrapper's callers classify the three abandon codes per the table and skip without an
      unhandled rejection; proved in `src/services/shared-supabase-session-native.test.ts`.
- [x] Widget and Watch refresh keep prior data on abandonment; proved in their existing service tests.
- [x] Abandonment produces a breadcrumb (background) or one warning per session (foreground), never
      an error-level event; proved in the wrapper test.
- [x] Bump `app.json` and add a release note.

## Implementation record (2026-09-20)

- [x] The native lock wrapper consumes `LOCK_NO_ASSERTION`, `LOCK_REVOKED`, and `LOCK_OPEN`, skips
      the lock body, and leaves `LOCK_TIMEOUT` and unknown codes as rejections. Background
      abandonments record a breadcrumb; foreground abandonments report one warning per app session.
- [x] Widget refresh clears its published-hash guard only for an expected abandonment so the next
      foreground or scheduled refresh retries; Watch refresh leaves its last application context in
      place and returns `false` when credential refresh is abandoned; auth initialization treats a
      skipped session read as non-fatal.
- [x] `app.json` is 4.9.18 and `release-notes.md` has the localized 4.9.18 entry.
- [x] RED/GREEN proof: `red-lock-abandonment.log` → `green-lock-abandonment.log`,
      `red-widget-abandonment.log` → `green-widget-abandonment.log`,
      `red-watch-abandonment.log` → `green-watch-abandonment.log`, and
      `red-auth-abandonment.log` → `green-auth-abandonment.log`.
- [x] Validation: `unit.log`, `security.log`, `component-changed.log`, `typecheck.log`, and
      `lint-affected.log` in the task log directory all pass.
- skipped (minor): TR-6 — the module-level foreground warning flag has no reset hook — skipped at the user's request.
- skipped (minor): TR-7 — the unobservable pending-mutation flush path consumes the foreground warning — skipped at the user's request.

## Human checkpoints

- [ ] [verify] Device build: lock the phone, wait for a widget refresh, unlock · Expected: no new
      REACT-NATIVE-9/B/F events for that device · Failure: any new event · Reason: background
      assertion grants are decided by RunningBoard on a real device.

## Acceptance criteria

- [x] The wrapper test proves each abandon code is consumed without an unhandled rejection.
- [x] `npm run test:unit` and `npm run test:security` pass with no new failures.
- [ ] The device verification above passes.
