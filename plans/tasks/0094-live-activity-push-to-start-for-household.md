# Task 0094: Live Activity push-to-start for household members

**Branch**: `feature/live-activity-push-to-start-for-household`
**Depends on**: 0093
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

- [ ] Swift/app: register and sync push-to-start token; handle remote start; observe and sync the spawned activity's update token; dedupe by `timerInstanceId`.
- [ ] Backend: store push-to-start tokens per user device (extend 0093 storage); RLS owner-scoped.
- [ ] Edge function: INSERT branch fans out `event: start` pushes to household devices except starter; DELETE branch ends all known activities for the timer instance (starter's + mirrored).
- [ ] Tests: edge-function fan-out composition (recipients, payload attributes, starter excluded); token lifecycle; client dedupe unit tests.

## Human checkpoints

- [ ] [verify] Two real devices (both iOS 17.2+): A starts a timer; B's locked phone shows the Live Activity within seconds; B stops from the Live Activity/app; both devices' activities end and one record exists. Failure: no activity appears on B, duplicate activities, or activities that outlive the timer. Reason: push-to-start is real-device-only; APNS delivery cannot run in CI.

## Acceptance criteria

- [ ] A's timer start surfaces a Live Activity on B's iPhone without B opening the app (manual verification passed).
- [ ] Stopping from any surface ends every mirrored Live Activity.
- [ ] No duplicate activities when B's app is foregrounded during the start.
- [ ] Edge-function and token-lifecycle tests green; 0093 end-push behavior unchanged.
