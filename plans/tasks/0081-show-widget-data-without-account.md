# Task 0081: Show widget data without an account or sign-in

**Branch**: `feature/show-widget-data-without-account`
**Depends on**: none
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 3 "Also in scope"

## What to build

Restore the iOS Widget for signed-out and accountless users. Since PR #224 (task 0077),
`loadWidgetData` in `targets/widget/index.swift` requires userId, selectedBabyId, and
supabaseAccessToken from the App Group before it will render anything; before that PR it read the
app-written `widgetData` cache unconditionally. Signed-out and accountless users therefore get a
**blank widget**, contradicting the shipped release note "anche senza un account".

The behavior to restore: when credentials are absent, the widget renders the app-written cache
(timers, totals, last times) exactly as it did before PR #224. When credentials are present,
nothing changes — the server-snapshot path stays as PR #224 built it.

## Implementation work

- [ ] In `targets/widget/index.swift`, make `loadWidgetData` fall back to the app-written
      `widgetData` cache when the App Group holds no credentials, instead of returning nothing.
- [ ] Keep the credentialed path (server RPC snapshot) untouched.
- [ ] If any TypeScript-side logic gates writing `widgetData` on being signed in, cover the
      accountless write path with a unit test.

## Human checkpoints

- [ ] [verify] On a simulator or device with no account: start a timer in the app, add the widget,
      background the app. · Expected: widget shows the running timer ticking and the day's totals
      from the local cache. · Failure: blank or placeholder widget. · Reason: no Swift test target
      exists for the widget extension; WidgetKit rendering can only be observed on
      simulator/device.

## Acceptance criteria

- [ ] An accountless user's widget shows timers and totals from the app-written cache.
- [ ] A signed-out user's widget shows the last app-written cache instead of going blank.
- [ ] A signed-in user's widget behavior is unchanged.
