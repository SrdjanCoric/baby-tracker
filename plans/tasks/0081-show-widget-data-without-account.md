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

- [x] [verify] On a simulator or device with no account: start a timer in the app, add the widget,
      background the app. · Expected: widget shows the running timer ticking and the day's totals
      from the local cache. · Confirmed by owner 2026-08-10: working. · Reason: no Swift test target
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

## Review findings fixed after re-review

- fixed (security): TR-5 — TogglePauseActivityIntent/StopActivityIntent now gate on `widgetSnapshotRuntime.identity.currentIdentity()` non-nil, so the unauthenticated toggle-timer-pause POST can no longer be issued from a signed-out/accountless surface. (Was accepted; gated while narrowing TR-1, per re-review.)
- fixed (bug): TR-1 — Sign-out now marks the retained cache as orphaned (widgetDataOrphaned); the credentialless render strips live timers only for orphaned caches, so a live accountless user's running timer keeps ticking. (Re-review caught the over-broad first fix that stripped accountless timers.)

## Review findings skipped/deferred

- deferred (standards): TR-6 — Swift test exercises only the pure selector, not production readSnapshot/loadWidgetData. Raising index.swift store reachability into the Foundation-only harness is a larger refactor deferred to a follow-up.
- skipped (minor): TR-7 — sign-out test proves non-removal of widgetData only; overwrite-to-clear is not exercised by the current service and is deferred as a minor coverage gap.
- skipped (minor): TR-8 — credentialless legacy render applies no local-day freshness gate; day totals going stale past local midnight is a cosmetic refinement deferred.
- skipped (minor): TR-9 — newborn wake-window opt-in key retention on the credentialless path is an enhancement deferred.
- skipped (minor): TR-10 — rendering-dependent acceptance criteria remain subject to the device/simulator `[verify]` gate at finish-task; checkbox state deferred to that gate.
- skipped (minor): TR-11 — server-snapshot mirror into widgetData vs the "app-written cache" wording is a plan/decision restatement deferred to the next doc revisit.

## Finish-task record

- README: Updated `### iOS Native Integrations` to document locally cached widget data for accountless and signed-out users, including live accountless timers and non-ticking timers left by sign-out.
- README audit: `write-well` audit pass 1 completed over the affected bullet; no findings. No em dashes, filler, staging, redundancy, or vague claims.
- Final focused automated proof (2026-08-10 23:50 CEST): Swift decoder/coordinator harness passed; `src/services/widget-data-service.test.ts` passed 7/7; affected ESLint passed; `git diff --check` passed. Logs: `/tmp/agent-workflows/e2f8af45fd34/dbee47e8abc5/final-swift.log`, `final-widget-data-vitest.log`, `final-eslint.log`, `final-diff-check.log`.
- Manual `[verify]` (2026-08-10): Owner confirmed WidgetKit behavior works on simulator/device. Accountless widget shows local-cache totals and its live timer ticks; signed-out widget retains cache without a departed timer ticking. This confirms the two rendering-dependent acceptance criteria.
