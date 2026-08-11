# Task 0084: Watch renews its Supabase credential from the shared session

**Branch**: `feature/renew-watch-credentials-from-shared-session`
**Depends on**: 0083
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 2 scope note
**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

Extend task 0083's credential renewal to the Apple Watch. The Watch authenticates its Supabase
RPCs with the same stored static access token as the Widget and has the same failure: one hour
after the last app session, every request returns 401 and summaries go permanently stale until the
phone app is opened.

The Watch reads the shared session store established in task 0083 and follows the same
concurrent-redemption discipline approved there: on 401, redeem the refresh token, write the
renewed pair back to the shared store, retry once, and log renewal failures instead of swallowing
them. No new storage design — the `[decision]` and `[confirm-security]` outcomes from 0083 are
binding here.

## Implementation decision

- [x] [decision] The supported topology is one account with one paired Watch. The Watch receives
      task 0083's versioned session capsule through the existing WatchConnectivity channel, stores
      it in Watch-local Keychain, and owns no cross-device locking protocol. Within the Watch it
      follows the existing renew-on-401, replace-the-pair, retry-once behavior. The old
      `watchSupabaseAccessToken` UserDefaults channel is removed. Confirmed by the user on
      2026-08-11.
- [x] [confirm-security] The user confirmed on 2026-08-11 that the single-user, single-paired-Watch
      topology does not require a cross-device refresh lock. The Watch may hold the renewable
      session capsule in its local Keychain so it can refresh while the phone app is closed.

## Implementation work

- [x] In `targets/watch/index.swift` / `WatchActivitySummary.swift`, read the session from the
      shared store from 0083 instead of the static access token.
- [x] On RPC 401: redeem, write back, retry once, log on failure — using the redemption
      discipline approved in 0083.
- [x] Remove the Watch's reliance on any credential field 0083 deprecated (e.g. the old
      `UserDefaults` access token), if anything still reads it.

## Human checkpoints

- [ ] [verify] Physical Apple Watch, phone app force-closed for over an hour, then trigger a Watch
      summary refresh (open the Watch app or wait for its scheduled refresh). · Expected: the
      Watch shows fresh data without the phone app being opened. · Failure: Watch summaries stay
      stale until the phone app opens. · Reason: JWT expiry and watchOS background refresh cannot
      be reproduced in an automated harness; no Swift test target exists.

## Acceptance criteria

- [x] A Watch refresh more than one hour after the last app session succeeds via 401 → redeem →
      retry.
- [x] The Watch and the app both keep working after either one renews the pair (no sign-out, no
      redemption race).
- [x] No Watch code path still reads a credential field deprecated by 0083.
- [x] Renewal failures are logged, not swallowed.

## Verification evidence (focused pre-review)

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
