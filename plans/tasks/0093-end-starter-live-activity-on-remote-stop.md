# Task 0093: End starter's Live Activity on remote stop

**Branch**: `feature/end-starter-live-activity-on-remote-stop`
**Depends on**: 0091
**Source**: `plans/allow-household-timer-control.md` (planning brief, 2026-09-01) · **User stories**: As the caregiver who started a timer, when someone else stops it, my lock-screen/Dynamic Island Live Activity ends promptly even if my app is backgrounded.

## What to build

When B stops A's timer while A's app is foregrounded, realtime handles cleanup (0091). But A's Live Activity is device-local: backgrounded, it keeps ticking indefinitely. This task ends it reliably via ActivityKit remote push:

- A's device, on starting a Live Activity for a timer, obtains the per-activity ActivityKit push token and syncs it to the backend (alongside the existing widget push-token storage — exact table shape decided in-task: extend `user_push_tokens` or a sibling table keyed by `timerInstanceId`).
- The existing `send-widget-push` edge function (already triggered on `active_timers` INSERT/DELETE) gains a Live Activity branch: on DELETE, send an APNS `liveactivity` push with `event: end` to the stored token for that timer instance, ending A's Live Activity.
- Token rows are cleaned up when the activity ends (either path).
- Decision context: best-effort silent-push wake was rejected in planning (no delivery guarantee, stale ticking timer). Push-to-start mirroring on other members' devices is task 0094, not this one — but do not preclude it (the edge-function push branch and token storage should accommodate ending activities that were started remotely later).

Verify the current APNS Live Activity payload requirements (`apns-push-type: liveactivity`, topic suffix `.push-type.liveactivity`, `event` values) against Apple docs during implementation — planning asserted these from model knowledge.

## Implementation work

- [ ] Swift/app: obtain and observe the Live Activity push token on activity start; sync token + `timerInstanceId` to backend; remove on end.
- [ ] Backend: token storage (migration if a new table/columns are needed) with RLS restricting rows to the owning user.
- [ ] Edge function: on `active_timers` DELETE, look up the Live Activity token for that timer instance and send the ActivityKit end push; keep existing widget silent-push behavior intact.
- [ ] Unit/integration tests for the edge-function branch (token found → end push composed; no token → no-op) and token lifecycle.

## Human checkpoints

- [ ] [confirm-db] Apply the token-storage migration (if any) to the shared Supabase project.
- [ ] [verify] Two real devices: A starts a timer (Live Activity visible), backgrounds the app and locks the phone; B stops the timer from their app. Expected: A's Live Activity ends within seconds without opening the app. Failure: Live Activity keeps ticking until A foregrounds. Reason: ActivityKit pushes are not deliverable to simulators and APNS delivery cannot run in CI.

## Acceptance criteria

- [ ] Remote stop ends the backgrounded starter's Live Activity via push (manual two-device verification passed).
- [ ] Fallback intact: with push undelivered, foregrounding the app still clears timer state and dismisses the activity (0091 restore check).
- [ ] Edge-function tests green; widget silent-push behavior unchanged.
- [ ] Token rows cleaned up after timer end (no orphan accumulation).
