# Task 0081: Show widget data without an account or sign-in

**Branch**: `feature/show-widget-data-without-account`
**Depends on**: none
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 3 "Also in scope"

## Implementation record

- **Change class**: `code`
- **Validation tier**: `focused`
- **TDD applicable**: `true`
- **Automated seam**: credential presence selects either the server snapshot or the app-written
  App Group cache; accountless TypeScript cache publication is tested only if current code gates it.
- **Manual seam**: WidgetKit rendering without an account remains the declared `[verify]` checkpoint.
- **Resolved decision (2026-08-10)**: Explicit sign-out and session expiry preserve the last
  app-written `widgetData` cache in the App Group while clearing credentials and authenticated
  per-baby snapshots. Continued local Home Screen or Lock Screen visibility is intentional because
  the data remains on the user's phone. The fallback does not publish data anywhere or widen server
  access.
- **Required automated proof**: the Foundation-only Swift snapshot seam covers credentialed
  per-baby selection and credentialless legacy-cache selection; the TypeScript service test proves
  sign-out cleanup preserves `widgetData` while removing credentials and authenticated snapshots.

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

- [x] In `targets/widget/index.swift`, make `loadWidgetData` fall back to the app-written
      `widgetData` cache when the App Group holds no credentials, instead of returning nothing.
- [x] Keep the credentialed path (server RPC snapshot) untouched.
- [x] If any TypeScript-side logic gates writing `widgetData` on being signed in, cover the
      accountless write path with a unit test.

## Human checkpoints

- [ ] [verify] On a simulator or device with no account: start a timer in the app, add the widget,
      background the app. · Expected: widget shows the running timer ticking and the day's totals
      from the local cache. · Failure: blank or placeholder widget. · Reason: no Swift test target
      exists for the widget extension; WidgetKit rendering can only be observed on
      simulator/device.

## Acceptance criteria

- [x] An accountless user's widget shows timers and totals from the app-written cache.
- [x] A signed-out user's widget shows the last app-written cache instead of going blank.
- [x] A signed-in user's widget behavior is unchanged.

## Implementation proof

- Swift selector RED failed because `WidgetSnapshotSelector` did not exist. GREEN proves a complete
  identity still selects the existing per-baby snapshot while a missing identity selects the legacy
  app-written cache. The authenticated fetch coordinator and RPC transport were not changed.
- TypeScript cleanup RED proved sign-out still removed `widgetData`. GREEN proves cleanup preserves
  that legacy cache while removing credentials, selected identity, timezone, tracked per-baby
  snapshots, and their newborn opt-in keys.
- The existing `publishes app snapshots to the preferred per-baby cache` service test calls
  `updateWidgetData` without auth context, confirming the accountless publication path has no auth
  gate and needs no additional production change.
- Focused pre-review validation covers the Foundation-only Widget snapshot harness, the Widget data
  service unit suite, affected-file ESLint, and `git diff --check`. The WidgetKit device/simulator
  checkpoint remains open for `finish-task`.

## Review findings accepted as security risk

- accepted (security): TR-3 — Sign-out preserves the unbound App Group widgetData cache, so on a shared device the next account sees the previous account's widget data. — Single-owner device assumption; shared-device cross-account leak treated as out of scope for this task.
- accepted (security): TR-5 — Returning data while signed out un-blocks TogglePauseActivityIntent, which issues an unauthenticated toggle-timer request naming the previous account's babyId. — Residual risk accepted; shared-device/intent-triggerable unauthenticated call out of scope for this task.
