# Task 0094: Live Activity push-to-start for household members

**Branch**: `feature/live-activity-push-to-start-for-household`
**Depends on**: 0093
**Implementation classification**: mixed · validation-tier: canonical · tddApplicable: true
**Source**: `plans/allow-household-timer-control.md` (planning brief, 2026-09-01) · **User stories**: As a caregiver, when another household member starts a timer, my own iPhone shows a live lock-screen/Dynamic Island timer I can watch and act on.

## What to build

Fast-follow to 0093. Mirror a running timer as a Live Activity on the other household members' iPhones using ActivityKit push-to-start (iOS 17.2+):

- Each device registers its Live Activity push-to-start token (`pushToStartTokenUpdates` per activity attributes type) and syncs it to the backend.
- On `active_timers` INSERT, the edge function (extended in 0093) sends an APNS `liveactivity` push with `event: start` and full timer attributes (baby, activity type, `startedAt`, starter name, `timerInstanceId`) to every household member device **except the starter's** (starter already has a local Live Activity).
- A remotely-started Live Activity reports its own update/end push token; the device syncs it back so the 0093 DELETE branch can end it too — no matter who stops or from which surface.
- On timer stop, all mirrored activities end (push), and foreground realtime remains the fallback.
- Dedup: if the member's app is foregrounded and already rendering the timer, avoid double-starting activities; if a local activity for that `timerInstanceId` exists, skip.
- iOS < 17.2: silently no mirrored activity; app/widget/Watch coverage (0091/0092) unaffected.

## Implementation work

- [x] Swift/app: register and sync push-to-start token; handle remote start; observe and sync the spawned activity's update token; dedupe by `timerInstanceId`.
- [x] Backend: store push-to-start tokens per user device (extend 0093 storage); RLS owner-scoped.
- [x] Edge function: INSERT branch fans out `event: start` pushes to household devices except starter; DELETE branch ends all known activities for the timer instance (starter's + mirrored).
- [x] Tests: edge-function fan-out composition (recipients, payload attributes, starter excluded); token lifecycle; client dedupe unit tests.

## Human checkpoints

- [ ] [verify] Two real devices (both iOS 17.2+): A starts a timer; B's locked phone shows the Live Activity within seconds; B stops from the Live Activity/app; both devices' activities end and one record exists. Failure: no activity appears on B, duplicate activities, or activities that outlive the timer. Reason: push-to-start is real-device-only; APNS delivery cannot run in CI.

## Acceptance criteria

- [ ] A's timer start surfaces a Live Activity on B's iPhone without B opening the app (manual verification passed).
- [ ] Stopping from any surface ends every mirrored Live Activity.
- [ ] No duplicate activities when B's app is foregrounded during the start.
- [x] Edge-function and token-lifecycle tests green; 0093 end-push behavior unchanged.
- [ ] [verify] Release gate for 0091 through 0094: run `npm run e2e:household-timers` on the combined `main` and confirm every 0091 E2E acceptance item (B stops A's timer, one record owned by B, A clears without saving, simultaneous stop still one record, B pause/resume reflected on both devices). Nothing ships to production before this passes (owner decision 2026-09-05).

## Implementation notes (2026-09-05)

- Classification remains `mixed`, `validation-tier: canonical`, `tddApplicable: true`.
- Migration 067 adds owner-scoped, per-installation start-token storage and an authenticated
  registration RPC. Rotation replaces the same device row; registration is capped at eight devices
  per account, serialized on the user row. Account deletion cascades; sign-out removes registered
  start and update/end tokens. Migration 066's update/end storage and registration RPC are unchanged.
- The managed Swift observer persists the installation identity and latest start token, retains the
  App Group key used by Watch, and emits changes through the existing authenticated sync lifecycle.
  iOS versions below 17.2 return no start token. Remote activity attributes carry recipient `userId`
  separately from `starterName`, so existing per-activity token registration works for mirrors.
- Verified INSERT webhooks fan out independently of widget-token availability. Recipients are other
  household members (the starter account is excluded); payloads preserve the timer identity, map
  `tummy_time` to `tummyTime`, and encode Swift's Date reference epoch. Delivery uses at most eight
  workers with a ten-second budget; expired start tokens are removed without dropping tokens after
  transient delivery errors. DELETE continues addressing all registered activities by baby/instance.
- Native discovery collapses activities with the same type, baby, instance, and recipient, preferring
  an already observed activity; local starts reuse an existing match. Foreground/network refreshes
  and realtime DELETE events reconcile registered activities against current locks, ending mirrors
  even if APNS delivery was missed. Registration that loses a stop race still uses 0093's false-return
  cleanup. Disposing sync prevents registration after an in-flight lock check.
- Apple documentation checked for the start payload (`event`, `attributes-type`, `attributes`,
  `content-state`, `alert`), token rotation, and background wake/update-token discovery:
  [Starting and updating Live Activities](https://developer.apple.com/documentation/ActivityKit/starting-and-updating-live-activities-with-activitykit-push-notifications?changes=_5_7&language=objc),
  [pushToStartToken](https://developer.apple.com/documentation/activitykit/activity/pushtostarttoken).
  The token-based payload retains iOS 17.2 compatibility; it does not use broadcast channels.

## Pre-review evidence

- RED → GREEN observed for start fan-out/payload composition, verified INSERT wiring without widget
  tokens, native token persistence and duplicate selection, start-token rotation/retry and missed-end
  reconciliation, native transport/sign-out cleanup, SQL ownership/rotation/device limits, and
  disposal during an in-flight timer check. Additional passing coverage exercises transient APNS
  failures, expired tokens, legacy timers, and realtime-triggered reconciliation.
- Focused Vitest: **28 tests passed** across the start/end push, webhook, token synchronizer, and token
  service files. Existing end-push tests are unchanged.
- Focused Jest: **61 tests passed** in `active-timers-realtime.component.test.tsx` and unchanged
  `external-timer-stop-providers.integration.test.tsx` (5.6 seconds).
- `npm run test:widget:swift`: passed, including production Widget/Watch typechecks and native token
  tests. Direct iPhoneOS Swift typecheck of the controller, attributes, and token store also passed
  using the installed React Native emitter headers through a temporary header map.
- `npm run typecheck`, targeted ESLint, and `git diff --check`: passed.
- Local migration 067 applied and `scripts/sql/live-activity-push-token-tests.sql` passed. The local
  database had stale extra INSERT/UPDATE grants on the 066 table; its committed permissions were
  restored only inside the rolled-back test transaction. No shared database was accessed.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/7d63e66a2c3f` (`unit.log`, `component.log`, `swift.log`,
  `bridge-typecheck.log`, `typecheck.log`, `lint.log`, `sql-green.log`, plus RED evidence).
- The two-device APNS check and combined-main household E2E release gate remain unchecked for
  `finish-task`/0094 closeout. No production migration, deployment, or device-delivery claim is made.
