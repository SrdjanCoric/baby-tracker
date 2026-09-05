# Task 0092: Widget and Watch control remote timers

**Branch**: `feature/widget-and-watch-control-remote-timers`
**Depends on**: 0091
**Source**: `plans/allow-household-timer-control.md` (planning brief, 2026-09-01) · **User stories**: As a caregiver, I can stop a timer another household member started directly from my iOS widget or Apple Watch.

**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

After 0091, the backend accepts cross-member stops, and the app supports them — but the widget still renders remote timers as non-interactive ("in use" / hourglass branches), and while the Watch already renders household-wide timers (`isRemote`, `startedBy`) and its stop path routes through the phone's durable external command queue into the backend RPC, that path previously failed with `42501`.

This task makes both Swift surfaces fully interactive for remote timers:

- **Widget** (small/medium/large/lock-screen families): remove the remote-timer read-only branches; every active timer gets its stop control. Remove any widget-side `started_by` filtering on the stop path. Keep `isRemote`/attribution for display (who started it).
- **Watch**: remote-timer stop (and pause where the Watch offers pause for own timers) now succeeds end to end through the existing WatchConnectivity → external command queue → RPC path. Surface parity: whatever controls the Watch offers on an own timer, it offers on a remote one.
- Stops from these surfaces flow through the same record-creation path as app stops (task 0091's deterministic record ID, stopper-owned record) — the external command queue already routes into the shared stop providers, so no separate record logic may be introduced.

Excluded: Live Activity behavior (0093/0094), Wear OS (off main, out of scope).

## Implementation work

- [x] Widget Swift: remove remote-timer non-interactive branches in all widget families; ensure the stop intent carries no `started_by` restriction; keep attribution display.
- [x] Watch Swift: enable stop (and pause parity) on remote timers; verify no client-side ownership gate remains in `canPerformAction`-style checks beyond debounce.
- [x] Verify/extend the external command queue path so a remote-timer stop command from widget/Watch produces the deterministic, stopper-owned record via the shared providers.
- [x] Swift tests (`npm run test:widget:swift`): widget renders stop control for remote timers; Watch stop command issued for remote timer.
- [x] Extend the stop-provider integration suite (external-timer stop providers) with widget/Watch-sourced commands against a remote timer: one record, correct owner, starter cleared.

## Human checkpoints

- [ ] [verify] On two real devices/accounts: A starts a timer on their phone; B stops it from B's widget, then repeat from B's Watch. Expected: timer stops for both, exactly one record owned by B, A's app clears without saving. Failure: stop rejected, timer lingers on either device, or duplicate record. Reason: widget/Watch interaction with APNS refresh and WatchConnectivity cannot be exercised in CI simulators. **Pending owner confirmation during finish-task.**

## Acceptance criteria

- [x] Widget shows an operable stop control on a remote timer in every widget family; tapping it ends the timer and saves one stopper-owned record.
- [x] Watch stop of a remote timer succeeds (no `42501`), same single-record outcome.
- [x] `npm run test:widget:swift` and the stop-provider integration suite green, including new remote-timer cases.
- [x] Own-timer widget/Watch behavior unchanged (existing lifecycle/session-locking tests green).

## Implementation record (2026-09-05)

- Widget control policy now exposes Stop for every active timer across small, medium, large,
  accessory-circular, and accessory-rectangular surfaces, independent of `isRemote`. Remote starter
  attribution remains visible. Routed controls keep the timer identity, and the unused direct intent
  no longer constructs a `started_by` predicate.
- Watch active cards use the same stop and pause/resume policy for own and remote timers. A typed
  `WatchStopCommand` is built for both, while the only general action gate remains debounce.
- Remote native stops stay record-first: their durable command is consumed by the phone-side handler,
  matched to the household lock's timer identity, and sent through the existing remote provider. The
  direct native DELETE fallback remains own-timer-only so it cannot erase the lock data before the
  stopper-owned deterministic record is built.
- TDD proof: the new provider test failed with zero records before the handler learned remote locks,
  then passed with one deterministic record per Widget/Watch command, `user-1` as owner, both starter
  locks released, and the queue empty. Swift policy/command tests failed before their production seams
  existed, then passed.
- Focused pre-review proof: `npm run test:widget:swift` passed; the full external stop-provider file
  passed 58/58; the two native ordering files passed 7/7; the affected handler component file passed
  8/8; `npm run typecheck`, targeted ESLint, and `git diff --check` passed. The real-device two-account
  checkpoint remains for the owner and `finish-task`.

## Finish-task record (2026-09-05)

- README audit: no impact. README documents setup and general timer behavior but has no widget or
  Watch control usage section; no prose changed and no `write-well` pass was needed.
- Review outcome: all 16 findings in `reviews/0092-widget-and-watch-control-remote-timers-44a6e20.md`
  fixed, including the three user-approved security remediations (TR-1, TR-2, TR-11). No findings
  were skipped or accepted as security risks.
- Final automated proof: `npm run check:code` passed with 118 suites and 1,109 tests; the capped
  output is recorded in `/tmp/agent-workflows/e2f8af45fd34/1e841d975c8b/canonical.log`. Focused
  native, component/integration, Swift, TypeScript, lint, and diff checks remain green.
- The real-device two-caregiver checkpoint remains pending because the environment cannot exercise
  APNS widget refresh and WatchConnectivity on physical devices. Exact procedure: on two signed-in
  devices in one household, have caregiver A start a timer; from caregiver B's widget stop it and
  verify both devices clear it and exactly one record is saved with B as owner; repeat with B's Watch.
