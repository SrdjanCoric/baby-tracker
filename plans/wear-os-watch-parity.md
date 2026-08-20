# Wear OS Watch App (Apple Watch Parity)

## Planning status
Ready for planning

All scope, architecture, auth, and device-floor decisions are settled; the remaining checkpoints (auth-handoff detailed design, drift-guard mechanism) are implementation-time choices that do not change scope or task boundaries.

## Problem and destination
Samsung watch owners cannot use the app from their wrist; only Apple Watch is supported. Destination: a Wear OS companion app with the same functionality the Apple Watch app provides — logging all activity types, running timers, and viewing the day's summary — so a Samsung-wearing caregiver has feature parity with an Apple-wearing one.

## Current state
Verified by read-only repository reconnaissance (2026-08-20):

- Phone app is Expo/React Native (`react-native` 0.81.5, `expo-router`); Android build already configured (`app.json` → `android.package: com.sofibaby.app`, google-services present). No Wear OS or watch-side Android code exists — greenfield.
- Apple Watch app is native SwiftUI, ~5.8K LOC under `targets/watch/` (built via `@bacons/apple-targets`): `index.swift` (~3,127 LOC — UI, timers, logging, `PhoneConnector` WCSession delegate), `WatchActivitySummary.swift` (~956 LOC — data models for feeding, sleep, diaper, pumping, growth, tummy time, timers), `WatchSupabaseSession.swift` + adapters (session capsule, keychain, HTTP).
- Watch reads by calling the Supabase RPC `get_baby_activity_snapshot` directly over HTTPS (`supabase/migrations/061_get_baby_activity_snapshot.sql`, ~847 LOC) — full snapshot per poll.
- Watch writes/actions are relayed to the phone over WCSession (`transferUserInfo` queuing); known debts: delivery can lag minutes, no persistence of pending actions, no offline queue.
- iOS auth handoff: phone writes a session capsule to a shared Keychain via App Group (`plugins/with-shared-supabase-session/`); watch reads it. Watch does not refresh tokens itself — stale capsule causes silent 401s. This mechanism has no Android equivalent.
- `supabase/migrations/064_activity_sync_cursors.sql` exists but is unused by the watch (indexes for potential future incremental sync only).

## Target behavior
A Wear OS 4+ watch paired with an Android phone running the app can:

- Log all five activity types: feeding, sleep, diaper, pumping, tummy time.
- Start, pause, and stop feed/sleep timers; a timer started on any device (phone or another caregiver's device) appears on the watch, and vice versa, via the shared database.
- View the current day's activity summary.
- Launch the watch app from a launcher shortcut (parity stand-in for the iOS complication, which is launcher-only).

Sign-in happens on the Android phone app; the watch receives the session and operates independently afterwards (network via Bluetooth proxy, WiFi, or LTE as the OS provides). With no network at all, writes fail visibly with a retry affordance — nothing is silently dropped or queued.

## Actors and permissions
- **Caregiver (watch wearer)** — acts under their own Supabase session; same RLS-scoped access to the household's baby data as their phone session.
- **Android phone app** — trusted source of the session handed to the watch; required for sign-in/pairing. No standalone watch login.
- Trust boundary: session material crossing the phone↔watch Wearable Data Layer channel and resting on the watch. Security-sensitive; see Security and data checkpoints.

## Scenarios
### Happy path
Caregiver opens watch app → snapshot RPC populates today summary and any active timers → taps to log a diaper or start a feed timer → watch inserts directly to Supabase → phone (and other caregivers) see the entry on their next refresh.

### Repeat use and idempotency
Rapid duplicate taps must not double-log: write actions disable/debounce until the request resolves. Timer start when a timer of that type is already active follows the same rule the phone app enforces (surface the active timer rather than creating a second instance).

### Failure and retry
No network (no phone proxy, no WiFi, no LTE): write fails immediately with a visible "no connection" state and manual retry. No background queue in v1. Expired/invalid session: watch attempts its own token refresh; if refresh fails, watch shows a "reconnect from phone" state instead of silently erroring.

### Cancellation, resume, and cleanup
A running timer survives watch app restarts and watch reboots because timer state lives in the database, not in device memory; reopening the app re-fetches active timers via snapshot. Cancelling a timer from the phone is reflected on the watch at next poll.

### Relevant edge cases
- Watch on WiFi/LTE with phone absent or off: full functionality (reads and writes) continues.
- User signs out or switches account on phone: phone pushes invalidation over Data Layer; watch clears its stored session.
- Multiple babies in household: watch scopes to the same selected baby the iOS watch uses (baby identity delivered with the session/identity payload).
- Tizen-era Samsung watches (pre-2021): unsupported; store listing restricted to Wear OS 4+.

## Decisions
### Scope: full Apple Watch parity
- **Decision**: All five activity types, timers, today summary, launcher shortcut — matching `targets/watch/` functionality.
- **Reason**: User decision; Samsung users should not get a reduced experience.
- **Important alternatives**: MVP subset (timers + diaper + summary) — rejected by user despite lower cost; tile-only read-only app — rejected, users want logging.
- **Consequences**: Effort is the same order as the original Swift watch build (~5.8K LOC); parity verification spans ~40 activity fields.

### Write path: direct to Supabase from the watch
- **Decision**: Watch performs its own inserts/updates over HTTPS with its own session token. No phone-relay channel.
- **Reason**: Wear OS proxies network through the phone transparently (and WiFi/LTE work phone-free); direct writes avoid the iOS relay debts (minutes-late delivery, lost unpersisted actions, phone must wake). The database is already the multi-caregiver sync point, so cross-device timer visibility comes free via snapshot polls.
- **Important alternatives**: Relay-through-phone (mirror iOS WCSession pattern) — rejected: inherits documented lag/loss debt and adds a phone-wake dependency. Hybrid (direct logs, relayed timers) — rejected: two channels to build and test.
- **Consequences**: Activity write logic (validation, timer-instance handling) is duplicated in Kotlin; drift guard needed (see checkpoint). Data Layer is used only for session handoff and optional refresh nudges, not for data.

### Simplicity constraints (accepted by user)
- **Decision**: No offline write queue in v1; no incremental sync (snapshot RPC as-is); single data path; launcher shortcut instead of a richer Tile.
- **Reason**: User wants minimal implementation complexity for a small Samsung user base; parity in features, not in machinery.
- **Important alternatives**: Offline queue — deferred until users report need; incremental sync via migration 064 cursors — unused even on iOS, out of scope.
- **Consequences**: Behavior on no-network is visible failure + retry; snapshot cost per poll matches the existing iOS profile.

### Auth: Data Layer handoff + watch-side refresh
- **Decision**: Android phone app pushes the Supabase session to the watch via Wearable Data Layer; watch stores it encrypted (EncryptedSharedPreferences or equivalent) and refreshes its own token thereafter.
- **Reason**: Keychain/App Group has no Android equivalent. Watch-side refresh deliberately improves on the iOS design, whose phone-owned capsule goes stale and 401s silently.
- **Important alternatives**: Phone-owned token freshness (iOS pattern) — rejected: known silent-failure debt. Standalone watch login — rejected: watch text entry is hostile; phone requirement matches iOS.
- **Consequences**: One security-sensitive module (token transport, storage at rest, refresh, invalidation on sign-out) requiring a design pass and security review at implementation time.

### Device floor: Wear OS 4+, phone app required
- **Decision**: Support Galaxy Watch 4 and newer (Wear OS 4+, 2021+). Android phone app with the watch bridge is required for sign-in.
- **Reason**: Older Samsung watches run Tizen — a dead platform needing a separate codebase.
- **Important alternatives**: Tizen support — rejected permanently.
- **Consequences**: Store listing must state the floor and the phone-app requirement.

### Stack: native Kotlin/Compose for Wear
- **Decision**: Greenfield Compose (Wear) app; Kotlin data classes mirror the Swift models; a native Data Layer bridge module lives inside the Expo Android app.
- **Reason**: React Native does not run on Wear OS; Compose is the only supported path. SwiftUI code has zero reuse — the reusable asset is the backend contract and the already-solved UX.
- **Important alternatives**: None recorded (no viable cross-platform option).
- **Consequences**: Build tooling for the Wear module must integrate with the Expo Android build (precedent: `@bacons/apple-targets` pattern on iOS, `plugins/` config-plugin pattern for native integration).

## Domain language
- **Snapshot**: the full-day activity payload returned by `get_baby_activity_snapshot` (activities, active timers, goals) — the watch's only read contract.
- **Session capsule / envelope**: the serialized Supabase session handed from phone to watch (iOS: `WatchSessionEnvelopeV1`; Android equivalent to be defined in the auth design).
- **Active timer**: a database-persisted timer instance visible to all household devices, not a device-local stopwatch.

## State and external dependencies
- **Backend**: unchanged. Reads via existing RPC (migration 061); writes via the same Supabase REST/RLS paths the phone uses. No new migrations expected unless implementation opts for server-side write validation RPCs (a task-time choice, not required).
- **Watch-persisted state**: encrypted session + selected-baby identity only. Activity/timer state lives in the database.
- **Compatibility**: watch data models must track phone/DB schema; a field added to activities must be reflected in the Kotlin models (and Swift models — pre-existing duplication). Snapshot RPC changes must remain backward-compatible with both watch platforms.
- **External failure policy**: Supabase unreachable → visible error + manual retry; token refresh failure → "reconnect from phone" state.

## Interfaces and seams
- **`get_baby_activity_snapshot` RPC** — shared read contract for both watch platforms; the invariant seam. Changes require dual-platform checks.
- **Supabase REST writes under RLS** — write seam; watch must produce rows indistinguishable from phone-written rows, including valid `field_clocks` HLC entries with a watch device ID per the master plan's LWW-Map CRDT decision (rows with empty clocks lose to any clocked write).
- **Wearable Data Layer channel** — session handoff + sign-out invalidation + optional refresh nudge only. Never activity data.
- **Native bridge module in the Expo Android app** — exposes session-push to the RN layer; the Android sibling of `plugins/with-shared-supabase-session/`.
- **Kotlin data models** — mirror of `WatchActivitySummary.swift` (~40 fields); drift guard mechanism is an open checkpoint.

## Testing decisions
- **Observable behaviors**: each activity type logs and appears in the database with phone-equivalent rows; timers round-trip across devices via snapshot; auth handoff, refresh, and sign-out invalidation work; no-network writes fail visibly.
- **Primary seams**: Kotlin model serialization against fixture snapshot JSON (captured from the real RPC); write-payload construction unit tests; Data Layer bridge tested at the module boundary.
- **Existing precedent**: phone-side `widget-data-service.test.ts` for payload-serialization testing; the iOS watch itself has no automated tests (manual e2e scripts) — do not copy that gap.
- **Highest-level proof**: instrumented/emulator run — Wear OS emulator paired to Android emulator: sign in on phone, session lands on watch, log each activity type, verify DB rows and cross-device timer visibility.
- **Manual proof**: physical Galaxy Watch pairing pass (Data Layer and Bluetooth-proxy behavior differ on hardware), including phone-absent WiFi operation. Emulators cannot fully reproduce Samsung pairing.

## Security and data checkpoints
- **Session handoff module** (transport over Data Layer, encrypted storage at rest, watch-side refresh, invalidation on sign-out/account-switch): requires a dedicated design pass and security review before/at implementation. User has been told this is the one piece that must be done properly regardless of scope.
- No destructive data operations; watch writes are ordinary RLS-scoped inserts/updates.

## Out of scope
- Offline write queue (revisit on user demand).
- Tizen / pre-2021 Samsung watches.
- Incremental sync using migration 064 cursors.
- LTE-specific features or standalone watch login.
- Rich Wear Tile / complications beyond a launcher shortcut.
- Retrofitting iOS watch debts (offline queue, watch-side refresh on iOS) — noted as context, not tasks.

## Research evidence
No external research required — platform behavior relied upon (Compose-only UI on Wear, transparent network proxying, Data Layer for phone↔watch messaging, Wear OS 4 device floor) is standard, stable, documented platform behavior; verify specifics against current Android docs during the auth design pass.

## Unresolved checkpoints
- **Auth handoff detailed design** — exact envelope format, Data Layer mechanism (DataClient vs MessageClient), storage primitive, refresh flow. Implementation-time; needs security review. Blocking for the auth task, not for slicing.
- **Model drift guard** — checklist in CLAUDE/plan vs. generated models from a shared schema. Cheap decision at task time; affects long-term maintenance, not v1 behavior.
- **Store listing / expectation setting** — wording for device floor and phone requirement. Product copy, non-blocking.

## Planning constraints
- Natural slice order: (1) Wear module scaffold + build integration with Expo Android; (2) auth handoff (security-reviewed) — everything else depends on a session on the watch; (3) read path: snapshot fetch + today summary UI; (4) write path per activity type (sliceable per type); (5) timers (read+write, cross-device proof); (6) launcher shortcut + polish; (7) hardware pairing pass.
- Each activity-type write slice is independently verifiable against the database.
- Backend untouched — no migration ordering constraints.
- Follows repo planning process: batch via `to-plan` into `plans/master-plan.md` + `plans/tasks/`, documentation PR before implementation branches.

## Source coverage
- This planning conversation (2026-08-20): scope, write-path, auth, simplicity, and device-floor decisions with user.
- Read-only repository reconnaissance digest (subagent, 2026-08-20): `targets/watch/`, `plugins/with-shared-supabase-session/`, `supabase/migrations/061`, `064`, `package.json`, `app.json`.
