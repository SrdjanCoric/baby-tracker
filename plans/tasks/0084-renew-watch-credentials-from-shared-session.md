# Task 0084: Watch uses the shared Supabase credential safely

**Branch**: `feature/renew-watch-credentials-from-shared-session`
**Depends on**: 0083
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 2 scope note
**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

The Watch receives task 0083's versioned session capsule through WatchConnectivity and uses its
access token for Supabase RPCs. It must never redeem the phone's refresh token: no cross-device
lock or best-effort replication channel can guarantee that the phone and Watch will not reuse
different generations of one rotating refresh-token family. On 401, the Watch marks the credential
stale and requests a fresh phone publication.

## Implementation decision

- [x] [decision] The supported topology is one account with one paired Watch. The Watch receives
      task 0083's versioned session capsule through the existing WatchConnectivity channel, stores
      it in Watch-local Keychain, and uses only the current access token. The old
      `watchSupabaseAccessToken` UserDefaults channel is removed. Confirmed by the user on
      2026-08-11.
- [x] [confirm-security] After review, the user confirmed on 2026-08-11 that the Watch must never
      redeem the phone's rotating refresh token. A 401 requests a phone sync instead. An
      independently renewable Watch requires a separately designed device-specific session.

## Implementation work

- [x] In `targets/watch/index.swift` / `WatchActivitySummary.swift`, read the session from the
      shared store from 0083 instead of the static access token.
- [x] On RPC 401: surface unauthorized, mark the credential stale, and request a phone sync without
      redeeming or replacing the shared refresh-token family.
- [x] Remove the Watch's reliance on any credential field 0083 deprecated (e.g. the old
      `UserDefaults` access token), if anything still reads it.

## Human checkpoints

- [ ] [verify] Physical Apple Watch with an expired access token, then trigger a Watch summary
      refresh. · Expected: the stale-credential banner appears and the Watch requests a phone sync;
      opening the phone republishes a fresh capsule and Watch requests resume. · Failure: the Watch
      silently keeps stale data or redeems the phone refresh token.

## Acceptance criteria

- [x] The Watch never redeems or replaces the phone's rotating refresh-token family.
- [x] A Watch 401 activates stale-credential recovery and requests a fresh capsule from the phone.
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
