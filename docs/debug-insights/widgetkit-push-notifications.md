# WidgetKit Push Notifications: APNs Request Format

## Problem

After implementing the full WidgetKit push notification pipeline (edge function, token sync, migration, entitlements), widgets were not updating when another caregiver started a timer. The APNs request from the Supabase Edge Function was returning HTTP 400 errors.

## Debugging Timeline

### Attempt 1: `apns-push-type: background` + `content-available: 1`

Initial implementation used the standard background push format:

```
apns-push-type: background
apns-topic: com.sofibaby.app.push-type.widgets
payload: {"aps":{"content-available":1}}
```

This returned `InvalidPushType` from APNs. The `background` push type doesn't match the `.push-type.widgets` topic suffix.

### Attempt 2: `apns-push-type: widget` (singular)

Based on an initial reading of WWDC 2025 session notes, we tried:

```
apns-push-type: widget
```

This also returned `InvalidPushType`. Close, but wrong.

### Attempt 3: `apns-push-type: widgetpush`

Tried via local `test-apns.mjs` curl script:

```
apns-push-type: widgetpush
```

Also `InvalidPushType`.

### Solution: `apns-push-type: widgets` (plural)

The correct value from Apple's documentation ("Updating widgets with WidgetKit push notifications") is:

```
apns-push-type: widgets
apns-topic: com.sofibaby.app.push-type.widgets
payload: {"aps":{"content-changed":true}}
```

The documentation example shows the exact POST request format:

```
:method = POST
:path = /3/device/<DEVICE_TOKEN>
host = api.push.apple.com
apns-push-type = widgets
apns-topic = <bundleID>.push-type.widgets

{"aps":{"content-changed":true}}
```

### Sandbox vs Production

During debugging, we also discovered that the widget push token was generated with `aps-environment: production`, so sending to `api.sandbox.push.apple.com` always failed with `BadEnvironmentKeyInToken`. The edge function now only uses the production endpoint.

## Key Differences from Regular Push Notifications

| Field | Regular Push | WidgetKit Push |
|-------|-------------|----------------|
| `apns-push-type` | `alert` or `background` | `widgets` |
| `apns-topic` | `<bundleID>` | `<bundleID>.push-type.widgets` |
| Payload key | `content-available: 1` | `content-changed: true` |
| Priority | `10` (alert) or `5` (background) | `5` |
| Effect | Shows notification / wakes app | Triggers `reloadAllTimelines()` |

## Architecture Overview

The full pipeline works as follows:

1. Widget extension registers for push via `WidgetPushHandler` protocol
2. Widget writes its push token to App Group UserDefaults (`widgetPushToken` key)
3. React Native app reads the token on foreground and syncs it to `widget_push_tokens` table in Supabase
4. A database webhook on `active_timers` table INSERT/DELETE triggers the `send-widget-push` edge function
5. Edge function looks up other household members' widget push tokens and sends APNs requests
6. APNs delivers the push to the widget extension, which triggers `reloadAllTimelines()`
7. On timeline reload, the widget fetches fresh active timer data from Supabase REST API

## Key Takeaways

1. **WidgetKit push type is `widgets` (plural)** -- not `widget`, not `widgetpush`, not `background`. Apple's APNs is strict about this value matching the topic suffix.

2. **Use `content-changed: true`** (boolean) in the payload, not `content-available: 1` (integer). These are different keys for different push types.

3. **Production vs Sandbox matters** -- the push token's environment must match the APNs endpoint. Widget tokens generated with `aps-environment: production` entitlement will only work against `api.push.apple.com`.

4. **Test with curl first** -- a simple Node.js script hitting APNs directly is the fastest way to isolate header/payload issues from edge function deployment issues.
