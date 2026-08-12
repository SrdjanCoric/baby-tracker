# Task 0084: Watch renews its credential through phone-mediated sync

**Branch**: `feature/renew-watch-credentials-from-shared-session`
**Depends on**: 0083
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 2 scope note
**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

The Watch receives task 0083's versioned session capsule through WatchConnectivity and uses its
access token for Supabase RPCs. It must never redeem the phone's refresh token: no cross-device
lock or best-effort replication channel can guarantee that the phone and Watch will not reuse
different generations of one rotating refresh-token family. On 401, the Watch asks the paired
phone to refresh its authoritative session and republish the renewed capsule. The iPhone app may
be backgrounded or suspended; when the phone is unavailable or the app was explicitly force-quit,
the Watch waits for the phone instead of owning an independent session.

## Implementation decision

- [x] [decision] The supported topology is one account with one paired Watch. The Watch receives
      task 0083's versioned session capsule through the existing WatchConnectivity channel, stores
      it in Watch-local Keychain, and uses only the current access token. The old
      `watchSupabaseAccessToken` UserDefaults channel is removed. Confirmed by the user on
      2026-08-11.
- [x] [confirm-security] After review, the user confirmed on 2026-08-11 that the Watch must never
      redeem the phone's rotating refresh token. A 401 requests a phone sync instead. An
      independently renewable Watch requires a separately designed device-specific session.
- [x] [decision] The user clarified on 2026-08-11 that no independent Watch session is required.
      The normal path must work while the paired phone app is backgrounded: the phone refreshes and
      republishes its authoritative session when Watch requests sync. If iOS cannot run the phone
      app, the Watch may wait until it can.

## Implementation work

- [x] In `targets/watch/index.swift` / `WatchActivitySummary.swift`, read the session from the
      shared store from 0083 instead of the static access token.
- [x] On RPC 401: surface unauthorized, mark the credential stale, and request a phone sync without
      redeeming or replacing the shared refresh-token family on Watch. The phone handles that
      request by refreshing its shared session and republishing the latest capsule.
- [x] Remove the Watch's reliance on any credential field 0083 deprecated (e.g. the old
      `UserDefaults` access token), if anything still reads it.

## Human checkpoints

- [x] [verify] Physical Apple Watch with an expired access token while the paired iPhone app is
      backgrounded, then trigger a Watch request. · Expected: the Watch requests phone sync; iOS
      wakes the companion app, the phone refreshes and republishes, and Watch requests resume
      without opening the app UI. · Failure: manual app opening is required, the Watch silently
      keeps stale data, or the Watch redeems the phone refresh token. The user confirmed this
      checkpoint passed on 2026-08-12.

## Acceptance criteria

- [x] The Watch never redeems or replaces the phone's rotating refresh-token family.
- [x] A Watch 401 activates stale-credential recovery and asks the phone to refresh and republish
      its authoritative capsule.
- [x] The phone-side `requestSync` handler refreshes and republishes without requiring the app UI to
      be foregrounded; an unavailable or explicitly force-quit phone may defer delivery.
- [x] The app and Widget cannot be signed out by Watch-side refresh-token reuse.
- [x] No Watch code path still reads a credential field deprecated by 0083.
- [x] Missing, rejected, or expired Watch credentials activate stale-session recovery instead of
      being swallowed.

## Verification evidence (original focused pre-review; superseded by review remediation)

- Phone publication contract: `npm run test:unit -- src/services/watch-service.test.ts` passed
  11/11. The application context carries the exact versioned Task 0083 capsule, retains it across
  language-only republishing, omits the deprecated bearer field, and clears it on sign-out.
- Language-only publication compatibility: `npm run test:unit --
  src/services/native-language-service.test.ts` passed 4/4 and preserves the renewable capsule
  when republishing an already-synced Watch context.
- Watch renewal core: `npm run test:widget:swift` passed. The Foundation harness proves capsule
  install/removal, 401 renewal, one atomic local pair replacement, exactly one retry, preserved
  state plus one log on redemption failure, and a logged second 401 without a third send.
- Production Watch sources typecheck against the watchOS SDK in `npm run test:widget:swift`; the
  same gate also passed the existing Widget production typecheck and snapshot/summary harnesses.
- Credential guard: `npm run test:unit --
  src/__tests__/security/shared-supabase-session.security.test.ts` passed 11/11. It proves no Watch
  code references `watchSupabaseAccessToken`, the capsule uses Watch-local Keychain with
  `AfterFirstUnlockThisDeviceOnly`, and all seven authenticated Watch request paths use the
  renewing transport.
- Targeted ESLint and repository TypeScript typecheck passed. Logs are under
  `/tmp/agent-workflows/e2f8af45fd34/49b8e8362ee8/` (`watch-session-publication.log`,
  `native-language-session.log`, `watch-renewal-logging.log`, `watch-security.log`,
  `watch-swift.log`, `eslint.log`, and `typecheck.log`).
- Not run here: the physical >1-hour phone-closed Watch checkpoint above and the final canonical
  gate, which remain owned by the manual review loop and `finish-task`.

## Review remediation evidence

- The user confirmed the security-safe behavior: the Watch never redeems the phone's rotating
  refresh token. An expired Watch access token marks credentials stale and requests a phone sync;
  independently renewable Watch authentication remains a separate architecture task.
- `npm run test:widget:swift` passed, including Widget and Watch production typechecks, the shared
  session harness, the Watch session safety harness, and Watch summary tests.
- Focused Vitest batch passed 29/29 across Watch publication, shared-session security, Watch
  credential retention, and summary wiring.
- `npm run test:component -- --runInBand --runTestsByPath
  src/contexts/auth-context.component.test.tsx` passed 22/22.
- Focused ESLint and repository TypeScript typecheck passed. Final logs are under
  `/tmp/agent-workflows/e2f8af45fd34/49b8e8362ee8/` (`final-swift.log`,
  `final-vitest.log`, `final-auth-component.log`, `final-eslint.log`, and
  `final-typecheck.log`).
- The remediation-verification pass confirmed the intended phone-mediated behavior: the Watch has
  no independent session, and a Watch `requestSync` asks the background-capable companion app to
  refresh the phone-owned session and republish its persisted application context.
- TR-15–TR-18 focused validation passed: `npm run test:widget:swift`, 13/13 Watch-service Vitest
  tests, 18/18 Watch message-handler component tests, focused ESLint, and repository TypeScript
  typecheck. Logs are under `/tmp/agent-workflows/e2f8af45fd34/49b8e8362ee8/` with the
  `tr15-18-final-` prefix.
- Final focused repair proof passed 15/15 tests across
  `src/services/native-language-service.test.ts` and
  `src/__tests__/security/shared-supabase-session.security.test.ts`. The WatchConnectivity mock
  now includes the persisted-context API used by production, and the security guard matches the
  shared authenticated-request boundary.
- `npm run test:widget:swift` passed both production Swift typechecks, Widget snapshot and shared
  session tests, Watch session safety tests, and Watch summary tests.
- `npm run check:code` passed on 2026-08-12. The capped log is
  `/tmp/agent-workflows/baby-tracker/feature-renew-watch-credentials-from-shared-session/canonical-after-test-fix.log`.

## Review decisions

- accepted (security risk): TR-23 — A capsule-less account change can retain the previous account's
  Watch credential across relaunch — there won't be account switching.
- skipped (minor): TR-12 — Watch credential-guard tests do not fully prove the properties they
  name — I don't care about them.
- skipped (minor): TR-13 — Renewal failures can emit a misleading refresh-rejection diagnostic —
  I don't care about them.
- skipped (minor): TR-14 — Planning artifacts were bundled into the implementation commit — I
  don't care about them.
- skipped (minor): TR-19. An `unknown` lineage could collide across sessions; supported Supabase
  access tokens include `session_id`.
- skipped (minor): TR-20. Replaying an unchanged capsule can briefly clear stale state and waste
  one request; the transient behavior does not justify remediation in this task.
- skipped (minor): TR-21. Two Swift harness tests no longer exercise meaningful failure or
  concurrency paths; skipped by user decision.
- accepted (security risk): TR-22. The Watch retains the phone's unused refresh token in its local
  Keychain capsule; the user directed that this risk be accepted without remediation.

## Completion record

- Built phone-mediated Watch credential recovery across `src/services/watch-service.ts`,
  `src/hooks/useWatchMessageHandler.ts`, `app/_layout.tsx`, and `targets/watch/`. A Watch 401 marks
  its credential stale and requests a phone refresh without redeeming the shared refresh token.
- The Watch session capsule is stored in Watch-local Keychain, the deprecated UserDefaults bearer
  is purged, and authenticated Watch requests use the shared transport and recovery boundary.
- The Watch active-timer probe runs every ten minutes while the phone is reachable and every two
  minutes while it is unavailable.
- README disposition: updated `iOS Native Integrations` to describe Watch credential recovery and
  polling cadence. The affected Apple Watch prose passed one full `write-well` audit.
- Review outcome: three retained review passes closed. TR-1–TR-11, TR-15–TR-18, and TR-24–TR-27
  were fixed; TR-12–TR-14 and TR-19–TR-21 were skipped for the reasons above. TR-22 and TR-23 were
  accepted as security risks for the recorded user reasons.
- Automated proof: the final focused Vitest batch passed 15/15, `npm run test:widget:swift`
  passed, and `npm run check:code` passed.
- Manual proof: the user confirmed the physical Apple Watch background-phone credential recovery
  checkpoint passed on 2026-08-12.
- Planning included with this PR by owner request: `plans/master-plan.md`,
  `plans/tasks/0086-cut-redundant-client-sync-traffic.md`, and
  `supabase/migrations/063_bound_wake_window_reminder_scans.sql` in commit `f7b1791`.
