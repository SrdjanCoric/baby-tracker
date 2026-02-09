# APNs Sandbox Per-Token Routing

## Problem
Dev builds (Xcode) register sandbox APNs device tokens. The edge functions were hardcoded to use either production or sandbox APNs based on the global `APNS_SANDBOX` env var. This meant all tokens went to the same endpoint, which doesn't work when both dev and prod users coexist.

## Solution
Added `is_sandbox` column to `user_push_tokens` so each token knows its APNs environment. Edge functions read the flag per-token and route to the correct APNs host. No global `APNS_SANDBOX` env var needed.

### Changes Made

#### 1. Migration `036_add_is_sandbox_to_push_tokens.sql`
- Added `is_sandbox BOOLEAN NOT NULL DEFAULT false` to `user_push_tokens`
- Recreated `get_due_feeding_reminders()` to return `is_sandbox`
- Recreated `get_due_wake_window_reminders()` to return `is_sandbox`

#### 2. `src/services/push-token-service.ts`
`saveDeviceToken` now writes `is_sandbox: __DEV__` alongside the device token.

#### 3. All three edge functions
`check-wake-window-reminders`, `check-feeding-reminders`, `send-activity-notification` — each changed to:
- Add `is_sandbox` to interface / query select
- Accept `isSandbox: boolean` in `sendApnsAlert` instead of reading `APNS_SANDBOX` env var
- Route to `api.sandbox.push.apple.com` or `api.push.apple.com` per-token

#### 4. `src/contexts/notification-context.tsx`
`requestPermissions` now registers the push token immediately after permission is granted. Previously, if the user signed in before granting notification permission, the token was never registered (see Bug #3 below).

## Bugs Encountered & Fixed

### Bug 1: "BadDeviceToken" (HTTP 400)
**Symptom:** Edge function sent sandbox device token to `api.push.apple.com` (production).
**Root cause:** No per-token routing — all tokens went to same APNs host.
**Fix:** `is_sandbox` column + per-token routing in all edge functions.

### Bug 2: "InvalidProviderToken" (HTTP 403)
**Symptom:** Production notifications broke after changing .p8 key.
**Root cause:** Changed `APNS_AUTH_KEY` to a new .p8 key but didn't update `APNS_KEY_ID` to match the new key's ID.
**Fix:** Always update BOTH `APNS_AUTH_KEY` and `APNS_KEY_ID` together.

### Bug 3: Token not registered when permission granted after sign-in
**Symptom:** Device token never saved to DB. Edge functions reported "No device tokens found." No `[NotifContext]` logs appeared.
**Root cause:** `registerPushTokenForUser` is called on sign-in. If notification permission is `"undetermined"` at that point, the function exits early without registering the token. When the user later grants permission via `requestPermissions`, nothing re-triggers token registration — the userId hasn't changed, so the `NotificationAuthSetup` effect doesn't re-fire.
**Fix:** Added token registration logic directly inside `requestPermissions` callback, so granting permission immediately registers the token.

### Bug 4: APNs returns 200 but notifications not received
**Symptom:** Edge function logs "sent 1/1" with APNs 200, but device never shows the notification.
**Root cause:** Installing a dev build over a production build changes the device token. The old production token in DB becomes stale. APNs accepts the push (200) but silently doesn't deliver it.
**Fix:** User must open the production app (or new build) so it re-registers the correct token. The `is_sandbox` flag ensures the right APNs host is used for each token type.

## Lessons Learned

### Supabase secrets management
- `supabase secrets set APNS_AUTH_KEY="$(cat file.p8)"` can corrupt multiline PEM keys
- Setting an additional secret (e.g., `APNS_AUTH_KEY_BASE64`) corrupted existing secrets and wouldn't recover via CLI
- **Fix:** Set secrets through the **Supabase Dashboard UI** (Settings → Edge Functions → Secrets)
- When changing keys, always update BOTH `APNS_AUTH_KEY` and `APNS_KEY_ID` together

### Device token lifecycle
- The `aps-environment` entitlement in the provisioning profile determines sandbox vs production token
- Dev builds from Xcode → sandbox token, TestFlight/App Store → production token
- `__DEV__` in React Native correlates with this but is not the authoritative source
- Installing a dev build over a prod build changes the device token — the old prod token in DB becomes stale
- APNs may return 200 for a stale token but silently not deliver

### Permission timing
- On a fresh install, notification permission is `"undetermined"` until the user explicitly grants it
- Token registration must handle the case where permission is granted AFTER sign-in, not just during sign-in
- Always verify the full flow: sign in → grant permission → token registered → DB updated

## Status: Resolved
- All three alert edge functions use per-token `is_sandbox` routing
- Migration 036 adds `is_sandbox` column and updates both SQL functions
- `push-token-service.ts` writes `is_sandbox = __DEV__` on token registration
- `requestPermissions` registers token immediately after permission is granted
- Sandbox and production APNs delivery both working
