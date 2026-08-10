# Task 0083: Widget renews its Supabase credential via a shared App Group session

**Branch**: `feature/renew-widget-credentials-via-shared-session`
**Depends on**: 0082
**Source**: `handoffs/main/widget-refresh-and-credential-renewal.md` (2026-08-10 investigation), Part 2

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

- [ ] Implement a custom storage adapter for the app's Supabase client that persists the session
      to the shared store agreed in the `[decision]` below (refresh token in Keychain with an
      access group; move the existing access token out of App Group `UserDefaults`).
- [ ] Test-first on the TypeScript side: the adapter round-trips a session and the app picks up a
      pair the Widget wrote back.
- [ ] In `targets/widget/index.swift` / `WidgetActivitySnapshot.swift`: on RPC 401, redeem the
      refresh token against Supabase auth, write the renewed pair back to the shared store, and
      retry the RPC once. Surface (log) renewal failure instead of silently serving stale cache.
- [ ] Honor the agreed concurrent-redemption discipline between app and Widget.

## Human checkpoints

- [ ] [decision] Where exactly the session lives (Keychain access-group layout, what remains in
      `UserDefaults`) and how app, Widget, and Watch avoid concurrent refresh-token redemption
      (`talk-it-through`) — the handoff names this the gate for implementation.
- [ ] [confirm-security] Approve the final storage and redemption design before merge: Keychain
      items, access group, what each target may read/write, and the 401-renewal flow.
- [ ] [verify] Physical iPhone, app force-closed for over an hour, then the other caregiver logs
      sleep from Android. · Expected: the widget updates without the app being opened. · Failure:
      widget stays stale until the app opens — the original symptom. · Reason: JWT expiry plus
      WidgetKit push and background behavior cannot be reproduced in an automated harness; this is
      the exact >1h boundary that was never physically verified after PR #224.

## Acceptance criteria

- [ ] The shared store is the single source of truth for the session; the refresh token is in
      Keychain (access group), and no bearer token remains in App Group `UserDefaults`.
- [ ] A Widget refresh more than one hour after the last app session succeeds: 401 → redeem →
      retry → fresh snapshot.
- [ ] The app continues working with a session pair the Widget renewed (no sign-out).
- [ ] Renewal failures are logged, not swallowed.
- [ ] JWT expiry remains 3600s.
