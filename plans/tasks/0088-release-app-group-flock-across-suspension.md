# Task 0088: Release the App Group flock across suspension (0xDEAD10CC)

**Branch**: `feature/release-app-group-flock-across-suspension`
**Depends on**: none
**Source**: TestFlight crash-log diagnosis, conversation 2026-08-16 (`.ips` logs from v4.9.1, v4.9.4, v4.9.6) · **User stories**: opening the app and backgrounding it never gets the app killed by iOS; TestFlight/App Store crash metrics stop accumulating `0xDEAD10CC` terminations

## What to build

All three captured TestFlight `.ips` logs show the same non-crash kill: `SIGKILL`, RunningBoard
termination code `3735883980` (`0xDEAD10CC`) — the documented kill iOS applies to an app that gets
suspended while holding a file lock on a file inside a shared App Group container.

The shared Supabase session vault (shipped v4.9.0 with Task 0083) serializes cross-process access
by holding a POSIX `flock` on `shared-supabase-session.lock` in the App Group container — and holds
it across the awaited refresh-token redemption body, which performs network calls with retries and
a 10-second acquire timeout. App opens, refresh begins, user backgrounds the app before it
finishes, the process suspends holding the flock, iOS kills it. Matches the reported "opened it and
exited, then a crash" pattern exactly.

Make suspension-while-locked impossible:

1. Wrap every lock-held section in a background task assertion
   (`UIApplication.beginBackgroundTask` from app-process code; `ProcessInfo.performExpiringActivity`
   where UIKit is unavailable, e.g. the widget/watch extension side) so the process is not
   suspended while the flock is held; the expiration handler must force-release the lock (close the
   descriptor) before the assertion ends.
2. Release any held lock descriptors when the app enters background if no protected work is in
   flight, so the steady state holds no lock.
3. Preserve the vault's correctness contract: a forced release must leave the Keychain capsule and
   lock file in a state a later caller can recover from (the compare-and-swap/re-read design from
   Task 0083 must tolerate an interrupted redemption).

Deliberately excluded, split into a follow-up if kills persist after this lands: redesigning the
vault so the flock never spans the network await at all (lock only around read/write, coordinate
redemption via compare-and-swap on the token version).

## Implementation work

- [ ] Add background-task assertions around every `flock`-held critical section in the shared-session native code (app side and extension side), with expiration handlers that force-release the descriptor.
- [ ] Release held descriptors on `didEnterBackground` when idle.
- [ ] Prove interrupted-redemption recovery at the existing Swift test seam: a forced release mid-critical-section leaves the vault recoverable by the next caller.
- [ ] Run `npm run test:widget:swift` and `npm run test:unit`.

## Human checkpoints

- [ ] [confirm-security] Approve the change to the shared-session locking protocol (session/Keychain trust boundary from Task 0083).
- [ ] [verify] Confirm the kill is gone on a real device · Steps: on a TestFlight or dev build, open the app fresh (forcing a session refresh) and immediately background or swipe it away; repeat several times over a few days of normal use; check Settings → Privacy & Security → Analytics & Improvements → Analytics Data for new `SofiBabyTracker-*.ips` files · Expected: no new `.ips` with termination code `3735883980` (`0xDEAD10CC`) · Failure: a new log with that code appears · Reason: the kill is issued by RunningBoard on real-device suspension timing; simulators and CI cannot reproduce it.

## Acceptance criteria

- [ ] No code path holds the App Group flock without an active background-task assertion whose expiration handler releases it.
- [ ] Entering background with no protected work in flight leaves no lock descriptor held.
- [ ] A forced mid-section release leaves the shared session vault recoverable (test at the Swift seam).
- [ ] Real-device verification above passes with no new `0xDEAD10CC` logs.
