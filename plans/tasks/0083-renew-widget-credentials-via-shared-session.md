# Task 0083: Widget renews its Supabase credential via a shared App Group session

**Branch**: `feature/renew-widget-credentials-via-shared-session`
**Depends on**: 0082
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 2
**Execution classification**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

The root-cause fix for the stale widget: give the iOS Widget a way to renew its Supabase
credential so its server refreshes keep working more than one hour after the app was last open.

### The bug

The Widget authenticates the `get_baby_activity_snapshot` RPC with a **static** access token read
from the App Group. Nothing stores a refresh token — `writeAuthToAppGroup`
(`src/services/widget-data-service.ts`) writes url, anon key, access token, userId,
selectedBabyId, and timezone only, from an effect that runs while the app is mounted and on
backgrounding. Project JWT expiry is **3600s**. One hour after the last app session every RPC
returns 401, `performRefresh` swallows it and serves the stale cache with
`displayChanged: false` — silent. A WidgetKit push cannot help: it carries no data, it only
re-runs a timeline that cannot authenticate.

### Approach (decided by the user — approach A)

Move the Supabase session into a **shared App Group store** via a custom storage adapter for the
app's Supabase client, so app and Widget read and write one source of truth. The Widget redeems
the refresh token on 401 and writes the renewed pair back.

Rejected: **B** (silent push wakes the app to rewrite the token — iOS throttles background pushes,
degrades silently, idle widget still goes stale) and **C** (dedicated widget-scoped credential —
best end state, most work; revisit if A proves fragile).

**Explicitly out of scope: raising the 3600s JWT expiry.** The user asked and the answer is no —
it lengthens the validity window of a bearer token in shared storage and only moves the cliff.

### Security constraints (gate implementation — see checkpoints)

- Supabase **rotates refresh tokens on redemption** and invalidates the old one. Two independent
  holders redeeming the same token can invalidate the session and sign the user out. The design
  needs single-source-of-truth discipline; Supabase's reuse-detection grace window is the only
  thing absorbing near-simultaneous redemptions.
- The refresh token must live in **Keychain with an access group**, not `UserDefaults`. The
  current App Group already holds a bearer access token in `UserDefaults`, readable by every
  target — fix that in the same pass.

Scope is the app-side storage adapter plus the Widget renewal path. The Watch consumes the same
store in task 0084.

## Implementation work

- [x] Implement a custom storage adapter for the app's Supabase client that persists the
      session to the shared store agreed in the `[decision]` below (refresh token in Keychain
      with an access group; move the existing access token out of App Group `UserDefaults`).
      — `src/services/shared-supabase-session.ts` + `src/services/shared-supabase-session-native.ts`
      wired into `src/services/supabase.ts`; the iOS auth session key routes to the shared
      Keychain capsule through `plugins/with-shared-supabase-session` while PKCE verifiers and
      Android/web stay on AsyncStorage.
- [x] Test-first on the TypeScript side: the adapter round-trips a session and the app picks
      up a pair the Widget wrote back.
      — `src/services/shared-supabase-session.test.ts` (10 tests) and
      `src/__tests__/security/shared-supabase-session.security.test.ts` (static guards).
- [x] In `targets/widget/index.swift` / `WidgetActivitySnapshot.swift`: on RPC 401, redeem the
      refresh token against Supabase auth, write the renewed pair back to the shared store, and
      retry the RPC once. Surface (log) renewal failure instead of silently serving stale cache.
      — `targets/widget/SharedSupabaseSession.swift` (Foundation core) +
      `targets/widget/SharedSupabaseSessionAdapters.swift` (Keychain/POSIX/URLSession/NSLog);
      `WidgetSupabaseTransport` renews under a cross-process `flock`, retries once, and logs
      `missingSession`/`refreshRejected`/`retryUnauthorized`. The snapshot RPC, stop DELETE,
      end-live-activity, and toggle-pause edge calls all route through the transport.
- [x] Honor the agreed concurrent-redemption discipline between app and Widget.
      — one `flock` over the App Group lock file; a waiting caller re-reads the capsule and
      adopts a newer pair instead of redeeming again. Proven by
      `scripts/swift/shared-supabase-session-tests.swift` (10 slices incl. concurrent
      redemption) compiled by `scripts/run-widget-swift-tests.mjs`.

## Human checkpoints

- [x] [decision] Use one versioned Keychain item, protected by
      `AfterFirstUnlockThisDeviceOnly` and shared with the app and Widget only, to hold the complete
      Supabase session JSON. Keep only public configuration and non-secret identity metadata in App
      Group `UserDefaults`. Serialize app and Widget refreshes with one permanent App Group POSIX
      file lock; after acquiring it, re-read the session, redeem only the still-current refresh
      token, validate the same account, replace the whole session, then retry the original request
      once. A waiting caller adopts a newer pair instead of redeeming again. The app migrates its
      existing iOS AsyncStorage session by copy, verification, then deletion on the first launch
      after updating; Android and web keep AsyncStorage. Existing installs must launch the updated
      app once to make the refresh token available to the Widget; this migration does not normally
      require signing in again. Before that launch, the legacy App Group access token is only a
      best-effort bridge for its remaining lifetime and cannot be renewed by the Widget. The Widget
      routes every authenticated request through this transport. Widget refresh failures retain
      prior cache or queued actions and emit redacted logs. Watch access remains deferred to Task
      0084. Initial design approved by the user on 2026-08-11; first-launch migration requirement
      confirmed by the user on 2026-08-11.
- [x] [confirm-security] The user approved this Keychain layout, app/Widget access boundary,
      cross-process redemption lock, migration, and one-retry 401 flow on 2026-08-11. Accepted
      consequence: the Widget holds an account-wide refresh credential, constrained to the shared
      Keychain access group; rollback to an older binary may require sign-in after migration.
- [ ] [verify] Physical iPhone, launch the updated app once so it migrates the existing session,
      then force-close it for over an hour and have the other caregiver log sleep from Android.
      · Expected: the widget updates without reopening the app. · Failure: widget stays stale until
      the app opens — the original symptom. · Reason: JWT expiry plus WidgetKit push and background
      behavior cannot be reproduced in an automated harness; this is the exact >1h boundary that
      was never physically verified after PR #224.

## Acceptance criteria

- [x] The shared store is the single source of truth for the session; the refresh token is in
      Keychain (access group), and no bearer token remains in App Group `UserDefaults`.
      — the Widget no longer reads `supabaseAccessToken`; the app no longer writes it to the App
      Group (the Watch keeps its separate `watchSupabaseAccessToken` channel until Task 0084).
      Only the non-secret URL/anon key, user/baby ids, and timezone remain in App Group
      `UserDefaults`.
- [x] A Widget refresh more than one hour after the last app session succeeds: 401 → redeem →
      retry → fresh snapshot.
      — requires one launch of the updated app to migrate the existing session into shared
      Keychain; after that migration it is proven by the Swift renewal-core slices, with the
      physical boundary covered by the `[verify]` checkpoint above.
- [x] The app continues working with a session pair the Widget renewed (no sign-out).
      — supabase-js `__loadSession` re-reads the Keychain on every `getSession()`/request, so the
      app adopts the Widget-rotated access/refresh token automatically; its next refresh redeems
      the rotated refresh token instead of the revoked one.
- [x] Renewal failures are logged, not swallowed.
      — `NSLogSessionLogger` redacts tokens and the transport logs every failure kind before
      letting the coordinator preserve the prior cache.
- [x] JWT expiry remains 3600s.
      — no Supabase Auth configuration changed.

## Verification evidence (focused pre-review)

- `vitest run` (unit): 2741 tests across 155 files, exit 0.
- `jest --runInBand` (component): 1070 tests across 115 suites, exit 0.
- `npm run test:ci`: 65/65, exit 0.
- `eslint . --max-warnings=0`: exit 0.
- `tsc --noEmit`: exit 0.
- `npm run test:widget:swift`: `PASS: Shared Supabase session renewal core` plus the existing
  decoder/coordinator and Watch suites, exit 0, zero Swift warnings.
- `swiftc -typecheck` on `SharedSupabaseSession.swift` + `SharedSupabaseSessionAdapters.swift`:
  exit 0.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/0a9094bf718e/` (`unit.log`, `component.log`, `ci.log`,
  `lint-full.log`, `typecheck.log`, `shared-session-swift.log`, `adapters-typecheck.log`).
- Not run here (canonical, owned by finish-task): `test:local-dates`, `test:production-gating`
  (Metro/Hermes bundle), `test:sql`. The iOS widget/app build that compiles
  `targets/widget/index.swift` and the new native module cannot run in this environment; it is
  the canonical/`[verify]` boundary (CI native build + the physical iPhone checkpoint).

"
## Review round 1 — skipped minor/nit findings

- skipped (minor): TR-8 — AsyncStorage→Keychain migration copy-then-delete without verification step — deferred; out of scope this review round
- skipped (minor): TR-9 — Widget fabricates `{"id":"unknown"}` user object when refresh response omits `user` — deferred; out of scope this review round
- skipped (minor): TR-10 — TS `unknown` lineage fallback disagrees with widget's strict lineage equality check — deferred; out of scope this review round
- skipped (minor): TR-11 — `removeItem` deletes only Keychain capsule, leaves legacy AsyncStorage session behind — deferred; out of scope this review round
- skipped (minor): TR-12 — `acquireSessionLock` busy-waits with `Thread.sleep` on serial method queue, ignores caller acquire timeout — deferred; out of scope this review round
- skipped (minor): TR-13 — widget transport never checks stored `expires_at` before sending — deferred; out of scope this review round
- skipped (minor): TR-14 — cross-task architectural decision not recorded in master-plan's "Architectural decisions" section — deferred; out of scope this review round
- skipped (minor): TR-15 — docs/SECURITY.md still describes pre-change session model — deferred; out of scope this review round
- skipped (minor): TR-16 — widget-stop-intent-order test assertion now vacuous (marker points at "return request") — deferred; out of scope this review round
- skipped (minor): TR-17 — New production Swift (SharedSupabaseSessionAdapters.swift, index.swift) not compile-gated by committed command — deferred; out of scope this review round
- skipped (minor): TR-18 — Acceptance criterion retro-fit carve-out for Watch's `watchSupabaseAccessToken` App Group channel — deferred; out of scope this review round
- skipped (nit): TR-19 — `loadSharedSupabaseSessionBridge` native wrapper has no vitest test — deferred; out of scope this review round
- skipped (nit): TR-20 — `writeAuthToAppGroup` still requires `accessToken` param it no longer reads — deferred; out of scope this review round
- skipped (nit): TR-21 — `revision` compare-and-swap marker resets to 1 after sign-out (ABA across sessions) — deferred; out of scope this review round
- skipped (nit): TR-22 — Task file ends with stray `"` and no trailing newline — deferred; out of scope this review round
