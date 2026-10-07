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

- [x] The sink drops or dedups per the table; proved in `src/utils/observability-sink.test.ts`.
- [x] Dropped issues leave at most one breadcrumb per issue name per minute, with a suppression
  count; proved in the same file.
- [x] Bump `app.json` and add a release note.

## Acceptance criteria

- [x] The sink test proves every row of the table.
- [x] `npm run test:unit` passes with no new failures.

## Implementation classification

- Change class: mixed (code and release metadata).
- Validation tier: canonical; focused pre-review checks here, final canonical check in finish-task.
- TDD applicable: true.

## Implementation evidence

- Implemented on `hotfix/4.9.22-quiet-sink-offline` from local `hotfix/4.9`
  at `cec86ce`; the base has no remote tracking branch.
- Diagnosis: the existing sink lacked device connectivity state and allowed five events per
  minute for network failures. Its dropped events left no breadcrumb. Repeated offline channel
  errors reproduced five sends where zero were required.
- Observed RED → GREEN for policy (7 failures → pass), breadcrumbs (2 failures → pass),
  and NetInfo-to-sink integration (3 failures → pass). Latest focused run: 88 passing tests.
- Coverage: the sink test matrix proves every decision-table row, independent issue names,
  offline-to-online allowance, reconnect dedup, dedup across time windows and sink registration,
  and breadcrumbs for offline, deduplicated, and general-rate-limited issues.
- Boundaries: raw NetInfo boolean/null fields mirror
  `node_modules/@react-native-community/netinfo/src/internal/types.ts`; integration tests feed
  initial readings and listener transitions through observability startup into the real sink. PostgREST's
  error shape comes from `node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts`;
  a real PostgrestClient with a rejecting fetch produces the error used by the sink test.
- Derived facts: the sink uses a strict transport-failure classifier; user-facing error handling
  keeps its broad message patterns. Observability startup owns NetInfo monitoring independently
  of SyncEngine, including when Sentry is disabled. Readings propagate through the context-tag
  API as `network_online`:
  either field explicitly false means offline; unresolved fields remain unknown.
  General rate limits remain unchanged for other issues.
- Release metadata: `app.json` is 4.9.22; release notes follow the existing nine-language format.
- Validation: `npm run test:unit` passed (162 files, 2,875 tests, 4.54 s); `npm run typecheck`
  passed; targeted ESLint passed; `git diff --check` passed. Final canonical validation
  belongs to finish-task.
- Decisions deferred: none. Questions/clarifications: none. Unrequested additions: none.
- Out-of-scope work: none discovered. Pre-existing task 0102 planning edits remain untouched
  and excluded from this task's commit.
