# Task 0090: Restore sign-in screen exit and working Google/Apple sign-in

**Branch**: `feature/restore-sign-in-exit-and-social-auth`
**Depends on**: none
**Source**: Conversation 2026-08-28 (user-reported production failures) · **User stories**: As a user, I can always leave the sign-in screen with the X, and Google and Apple sign-in complete successfully.

## What to build

The sign-in screen (`app/auth/sign-in.tsx`) becomes reliably exitable and both social sign-in
providers work end to end. This is the top-priority task — implement before all other open tasks.

### Reported failures (production, 2026-08-28)

1. **Google sign-in fails** with the generic alert. The underlying error is unknown because the
   caller discards it: `handleGoogleSignIn` shows `t("auth.googleSignInError")` for every failure
   and logs nothing. Failure may date back to the 2026-07-28 sign-in rework (`e4d1f5d`) — the
   provider flow itself (`signInWithGoogle` in `src/contexts/auth-context.tsx`) has not changed
   since — or be external (Google Cloud OAuth client config, certificate fingerprint, Supabase
   Google/Apple provider settings). Apple sign-in has the same swallow-the-error pattern and must
   be verified too.
2. **X (close) button does nothing.** Candidate causes found by inspection:
   - The full-screen keyboard-dismiss `Pressable` is declared after the absolutely-positioned
     close button and may render above it, stealing the tap.
   - With an onboarding intent, `handleClose` awaits
     `NewOwnerOnboardingStorageService.cancelAuthentication()` (a queued mutation) before
     `router.back()`; a jammed queue or rejection leaves the screen stuck with no feedback.
   - `router.back()` may be a no-op when there is no back stack.

### Required behavior

- **Close always works.** X exits the screen on first tap in every entry path:
  - opened from onboarding (`onboardingIntent`/`resumeOnboarding`) → return to the onboarding
    screen it came from;
  - opened from settings/profile or anywhere in the app → return to the app, still unsigned.
  - Closing must never hang on storage mutations: cancel bookkeeping must not block navigation
    (navigate first or bound/fire-and-forget the cleanup) and a failure in it must not trap the
    user on the screen.
- **Google and Apple sign-in work.** Diagnose with a dev build (Metro console) to capture the real
  error, fix the root cause wherever it lies (app code, Google Cloud console, Supabase provider
  config), and verify both providers complete sign-in through to the authenticated app.
- **Errors stop being swallowed.** Google and Apple failure paths log the underlying error
  (console + any existing telemetry channel) and the user-facing alert keeps a translated message;
  cancelled dialogs still show no error.

## Implementation work

- [ ] Reproduce on a dev build: tap X from a settings entry path and an onboarding entry path;
      attempt Google and Apple sign-in; record exact errors and which close-failure cause applies.
- [ ] Fix the close button for all entry paths (touch ordering/hit area and non-blocking cancel
      bookkeeping), test-first where the failure is expressible in component tests (tdd skill).
- [ ] Add error logging to the Google and Apple failure paths so future failures are diagnosable
      from logs; keep translated user-facing alerts.
- [ ] Fix the diagnosed Google (and, if affected, Apple) sign-in root cause. If the fix is
      config-side (Google Cloud / Supabase), document the exact change in the task file and README
      auth section.

## Human checkpoints

- [ ] [verify] On a device build: tap X on the sign-in screen from settings and from onboarding ·
      Expected: screen closes first tap, returning to the correct place · Failure: X does nothing
      or app hangs · Reason: real navigation stack and touch layering are device behaviors not
      fully covered by component tests.
- [ ] [verify] Sign in with Google and with Apple on a device build · Expected: both complete and
      land in the authenticated app · Failure: any error alert · Reason: real OAuth against
      Google/Apple/Supabase cannot be automated.
- [ ] [confirm-security] Any change to Google Cloud OAuth client, certificate fingerprints, or
      Supabase auth provider settings requires user approval before applying.

## Acceptance criteria

- [ ] Component tests cover: close button receives taps (not occluded), close from onboarding
      intent returns to onboarding and never blocks on `cancelAuthentication`, close without
      intent returns to the app unsigned.
- [ ] Google and Apple failure paths log the underlying error; cancelled sign-ins show no alert.
- [ ] Both [verify] checkpoints confirmed passing by the user on a device build.
- [ ] Root cause of the Google failure documented (in this file) with the fix that resolved it.
