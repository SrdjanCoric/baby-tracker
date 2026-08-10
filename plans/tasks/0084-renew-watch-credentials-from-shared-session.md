# Task 0084: Watch renews its Supabase credential from the shared session

**Branch**: `feature/renew-watch-credentials-from-shared-session`
**Depends on**: 0083
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 2 scope note

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

## Implementation work

- [ ] In `targets/watch/index.swift` / `WatchActivitySummary.swift`, read the session from the
      shared store from 0083 instead of the static access token.
- [ ] On RPC 401: redeem, write back, retry once, log on failure — using the redemption
      discipline approved in 0083.
- [ ] Remove the Watch's reliance on any credential field 0083 deprecated (e.g. the old
      `UserDefaults` access token), if anything still reads it.

## Human checkpoints

- [ ] [verify] Physical Apple Watch, phone app force-closed for over an hour, then trigger a Watch
      summary refresh (open the Watch app or wait for its scheduled refresh). · Expected: the
      Watch shows fresh data without the phone app being opened. · Failure: Watch summaries stay
      stale until the phone app opens. · Reason: JWT expiry and watchOS background refresh cannot
      be reproduced in an automated harness; no Swift test target exists.

## Acceptance criteria

- [ ] A Watch refresh more than one hour after the last app session succeeds via 401 → redeem →
      retry.
- [ ] The Watch and the app both keep working after either one renews the pair (no sign-out, no
      redemption race).
- [ ] No Watch code path still reads a credential field deprecated by 0083.
- [ ] Renewal failures are logged, not swallowed.
