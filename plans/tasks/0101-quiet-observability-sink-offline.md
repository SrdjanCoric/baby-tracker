# Task 0101: Quiet the observability sink offline

**Branch**: `hotfix/4.9.22-quiet-sink-offline`
**Depends on**: none
**Base**: `hotfix/4.9` (the 4.9 integration line; its tip is the latest shipped hotfix). Not `main`.
**Source**: Sentry REACT-NATIVE-2 (358 events, 8 users), REACT-NATIVE-D and REACT-NATIVE-E (network
failures during timer restore), 2026-09-10 → 2026-09-18, 4.9.15 and 4.9.16 · **User stories**: the
Sentry quota is spent on real defects, not on a phone being offline.

## What to build

The observability sink added in 4.9.15 reports every realtime channel error and every failed timer
network call as a Sentry message. Offline, the realtime socket closes and reconnects continuously,
so one device produces hundreds of identical `realtime.channel_error` events. Timer restore and lock
loading report `Network request failed` the same way.

After this task, the sink applies the table below before sending anything:

| Issue | Device online | Result |
| --- | --- | --- |
| `realtime.channel_error` | no | Drop; breadcrumb only |
| `realtime.channel_error` | yes | Send at most once per app session |
| Any issue whose error is a network failure | no | Drop; breadcrumb only |
| Any issue whose error is a network failure | yes | Send at most once per issue name per session |
| Any other issue | any | Unchanged |
| Online state unknown | — | Treat as online |

## Decided

- Dedup is per issue name per app session, in memory. No persisted counters, no server-side rate
  limit rules — those are a separate Sentry-configuration decision.
- Reproduce first with `diagnose`: the feedback loop is the sink's unit test driving repeated
  channel errors with the network state toggled; the signal is the count of messages handed to the
  reporter.

## Clarifications

## Non-goals

- Changing the realtime reconnect behavior itself.
- Sentry-side inbound filters or quota settings.

## Context

Sentry issue: https://sofibaby.sentry.io/issues/REACT-NATIVE-2 · REACT-NATIVE-D · REACT-NATIVE-E.
All events are `handled: yes`, level warning or error, tagged `realtime_connected: false` or
carrying `TypeError: Network request failed`.

## Implementation work

- [ ] The sink drops or dedups per the table; proved in `src/utils/observability-sink.test.ts`.
- [ ] Dropped issues still leave a breadcrumb; proved in the same file.
- [ ] Bump `app.json` and add a release note.

## Acceptance criteria

- [ ] The sink test proves every row of the table.
- [ ] `npm run test:unit` passes with no new failures.
