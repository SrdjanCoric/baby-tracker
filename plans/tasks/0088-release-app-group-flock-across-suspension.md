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

- [x] Add background-task assertions around every `flock`-held critical section in the shared-session native code (app side and extension side), with expiration handlers that force-release the descriptor.
- [x] Release held descriptors on `didEnterBackground` when idle.
- [x] Prove interrupted-redemption recovery at the existing Swift test seam: a forced release mid-critical-section leaves the vault recoverable by the next caller.
- [x] Run `npm run test:widget:swift` and `npm run test:unit`.

## Implementation record (2026-08-16)

- **Widget/extension side**: the POSIX lock moved from the adapters into the Foundation-only core
  (`targets/widget/SharedSupabaseSession.swift`) as `PosixSharedSessionLock` with an injectable
  lock-file URL and a `SuspensionGuarding` seam, so the test harness exercises the real `flock` and
  the real force-release. The production guard (`ProcessExpiringActivityGuard`,
  `ProcessInfo.performExpiringActivity`) and the App Group wiring stay in
  `SharedSupabaseSessionAdapters.swift`; the `PosixSharedSessionLock()` call site in
  `targets/widget/index.swift` is unchanged via a convenience init.
- **Lease protocol**: `CrossProcessSessionLock.withLock` now hands the body a
  `CrossProcessLockLease`. On assertion expiry the lock revokes the lease first, then unlocks and
  closes the descriptor (all descriptor operations serialized through one mutex — no double close,
  no lock on a reused descriptor number). The transport calls `lease.ensureHeld()` immediately
  before persisting a redeemed pair and abandons the write with the new
  `SharedSessionError.lockRevoked` when the lock was force-released; the next caller re-reads and
  recovers under the existing revision CAS (proved by harness slices 12–13, including a waiter whose
  assertion expires mid-acquire aborting instead of spinning).
- **App side**: `ios/SofiBabyTracker/SharedSupabaseSession.swift` is **generated** (gitignored) from
  `plugins/with-shared-supabase-session/ios/SharedSupabaseSession.swift`; the plugin file is the
  committed source and both copies are kept identical. Each acquired handle is covered by
  `UIApplication.beginBackgroundTask` from before the acquire wait; the expiration handler
  force-releases the flock, marks the handle revoked, and ends the assertion. Releasing a revoked
  handle is a harmless no-op (the JS `finally` path), `invalidate()` also ends assertions, and a
  `didEnterBackground` observer force-releases any descriptor whose assertion was never granted
  (`.invalid`). Idle steady state holds no descriptor by construction: a descriptor exists only
  between acquire and release of an in-flight critical section.
- **App-side write abandonment**: the app writes the capsule only while holding the lock (auth-js
  lock contract in `src/services/shared-supabase-session.ts`), so `writeSession` rejects with
  `LOCK_REVOKED` while any force-released handle is outstanding — a resumed auth transaction whose
  lock was taken away cannot clobber a rotation the widget performed meanwhile; auth-js retries
  under a fresh lock. Capsule format, lineage, revision discipline, and Keychain access are
  unchanged. `removeSession` is deliberately not guarded (sign-out intent is idempotent).
- **Proof**: `npm run test:widget:swift` PASS (widget + watch iphoneos/watchos typechecks and all
  harnesses, including new slices: revoked-lease abandonment + recovery, expiration force-release
  with a second holder acquiring mid-section, expiration during acquire). `npm run test:security`
  PASS (129) with new source-inspection guards for the suspension protocol. `npm run test:unit`:
  2811/2812 — the one failure (`widget-snapshot-wiring.test.ts`, sleep-prediction wiring string) is
  pre-existing on `main` from PR #249, which changed `targets/widget/index.swift` without updating
  that test; untouched by this branch and deliberately not fixed here.
- **Limitation**: the app-target native module has no compiled test seam (imports React); its
  changes are proved by the shared design tested at the widget seam, the security source guards,
  and the real-device `[verify]` checkpoint.

## Human checkpoints

- [x] [confirm-security] Approve the change to the shared-session locking protocol (session/Keychain trust boundary from Task 0083). — Approved by owner 2026-08-16: background-task assertions around every flock-held section (expiration handler force-releases the descriptor and invalidates the handle); `ProcessInfo.performExpiringActivity` on the extension side; idle release on `didEnterBackground`; a body that loses its lock mid-flight abandons its write so revision CAS recovery stays sound. Capsule format, lineage, revision discipline, and read access unchanged.
- [ ] [verify] Confirm the kill is gone on a real device · Steps: on a TestFlight or dev build, open the app fresh (forcing a session refresh) and immediately background or swipe it away; repeat several times over a few days of normal use; check Settings → Privacy & Security → Analytics & Improvements → Analytics Data for new `SofiBabyTracker-*.ips` files · Expected: no new `.ips` with termination code `3735883980` (`0xDEAD10CC`) · Failure: a new log with that code appears · Reason: the kill is issued by RunningBoard on real-device suspension timing; simulators and CI cannot reproduce it.

## Review decisions

- skipped (minor): TR-10 — The new native failure modes have no regression test at the JS seams that own the documented recovery behaviour. — minor test-coverage gap accepted
- skipped (minor): TR-11 — The production `SuspensionGuarding` implementation is covered only by source inspection rather than the compiled Swift harness. — minor test-coverage gap accepted

## Acceptance criteria

- [ ] No code path holds the App Group flock without an active background-task assertion whose expiration handler releases it.
- [ ] Entering background with no protected work in flight leaves no lock descriptor held.
- [ ] A forced mid-section release leaves the shared session vault recoverable (test at the Swift seam).
- [ ] Real-device verification above passes with no new `0xDEAD10CC` logs.
