# Task 0092: Widget and Watch control remote timers

**Branch**: `feature/widget-and-watch-control-remote-timers`
**Depends on**: 0091
**Source**: `plans/allow-household-timer-control.md` (planning brief, 2026-09-01) · **User stories**: As a caregiver, I can stop a timer another household member started directly from my iOS widget or Apple Watch.

## What to build

After 0091, the backend accepts cross-member stops, and the app supports them — but the widget still renders remote timers as non-interactive ("in use" / hourglass branches), and while the Watch already renders household-wide timers (`isRemote`, `startedBy`) and its stop path routes through the phone's durable external command queue into the backend RPC, that path previously failed with `42501`.

This task makes both Swift surfaces fully interactive for remote timers:

- **Widget** (small/medium/large/lock-screen families): remove the remote-timer read-only branches; every active timer gets its stop control. Remove any widget-side `started_by` filtering on the stop path. Keep `isRemote`/attribution for display (who started it).
- **Watch**: remote-timer stop (and pause where the Watch offers pause for own timers) now succeeds end to end through the existing WatchConnectivity → external command queue → RPC path. Surface parity: whatever controls the Watch offers on an own timer, it offers on a remote one.
- Stops from these surfaces flow through the same record-creation path as app stops (task 0091's deterministic record ID, stopper-owned record) — the external command queue already routes into the shared stop providers, so no separate record logic may be introduced.

Excluded: Live Activity behavior (0093/0094), Wear OS (off main, out of scope).

## Implementation work

- [ ] Widget Swift: remove remote-timer non-interactive branches in all widget families; ensure the stop intent carries no `started_by` restriction; keep attribution display.
- [ ] Watch Swift: enable stop (and pause parity) on remote timers; verify no client-side ownership gate remains in `canPerformAction`-style checks beyond debounce.
- [ ] Verify/extend the external command queue path so a remote-timer stop command from widget/Watch produces the deterministic, stopper-owned record via the shared providers.
- [ ] Swift tests (`npm run test:widget:swift`): widget renders stop control for remote timers; Watch stop command issued for remote timer.
- [ ] Extend the stop-provider integration suite (external-timer stop providers) with widget/Watch-sourced commands against a remote timer: one record, correct owner, starter cleared.

## Human checkpoints

- [ ] [verify] On two real devices/accounts: A starts a timer on their phone; B stops it from B's widget, then repeat from B's Watch. Expected: timer stops for both, exactly one record owned by B, A's app clears without saving. Failure: stop rejected, timer lingers on either device, or duplicate record. Reason: widget/Watch interaction with APNS refresh and WatchConnectivity cannot be exercised in CI simulators.

## Acceptance criteria

- [ ] Widget shows an operable stop control on a remote timer in every widget family; tapping it ends the timer and saves one stopper-owned record.
- [ ] Watch stop of a remote timer succeeds (no `42501`), same single-record outcome.
- [ ] `npm run test:widget:swift` and the stop-provider integration suite green, including new remote-timer cases.
- [ ] Own-timer widget/Watch behavior unchanged (existing lifecycle/session-locking tests green).
