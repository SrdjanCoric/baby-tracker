# Decision: the seam that keeps all four timers identical

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** cluster
**Cluster:** shared timer seam
**Depends on:** [pause semantics](006-pause-semantics.md), [running timer start time edit](007-running-timer-start-time-edit.md), [stop time rewind](008-stop-time-rewind.md)
**Claim:** none

## Question

Do feeding, sleep, pumping, and tummy time share one timer lifecycle module, or do four context
implementations stay aligned by convention and tests?

## Context

The four contexts hold near-duplicate timer code. `sleep-context.tsx` runs past two thousand lines
with the pause reducer, the AsyncStorage restore, the lock reconciliation, and the Live Activity calls
all inside it, and the other three repeat the pattern with their own variations. Every behavior
decision in this map lands in four places.

Extraction is expensive and hard to reverse once the contexts depend on it, and the four types are not
identical: feeding tracks per-side state and a feed type, sleep classifies nap against night and feeds
predictions, pumping records volume per side, tummy time records only a span. A shared module has to
either absorb those differences or hand them back.

This decision runs last because the shape of the seam follows from what the contract says.

## Evidence

- `src/contexts/sleep-context.tsx` (2037 lines), `src/contexts/feeding-context.tsx` (1187),
  `src/contexts/tummyTime-context.tsx` (1145), `src/contexts/pumping-context.tsx` (976). Each holds
  roughly 300 lines running the same restore sequence in the same order.
- `src/contexts/active-timers-context.tsx`, already shared across all four.
- `src/services/timer-completion-service.ts`, `src/services/timer-stop-coordinator.ts`,
  `src/services/timer-lock-reconciliation.ts`, already extracted.
- `src/__tests__/external-timer-stop-providers.integration.test.tsx`, 2221 lines and more than forty
  tests. It renders all four real providers together and drives them through restore, stale-restore
  races, offline reconnect and reconciliation, lock conflicts, sub-minute stops, and Live Activity
  cleanup for every type. The four contexts have no unit tests of their own, so this file is their
  behavioral contract.
- The record-building code sits inside each context's lock-conflict branch and reads the local
  `activeTimer` snapshot: `pumping-context.tsx:405`, `sleep-context.tsx:778`,
  `feeding-context.tsx:516`, `tummyTime-context.tsx:521`. A caregiver who did not start the timer
  reaches only the server-only branch, which gates on `lock.startedBy === user.id` at
  `pumping-context.tsx:488`, `feeding-context.tsx:608`, `sleep-context.tsx:863`, and
  `tummyTime-context.tsx:602`, fails the condition, and does nothing.
- `timer_data` is `Record<string, unknown>` at `src/services/active-timer-service.ts:106`, so an
  opaque per-type payload boundary already exists in the data model. Sleep writes `type`,
  `morningClassification`, and `morningClassificationVersion` at `sleep-context.tsx:748`; feeding
  writes `side`, `type`, `leftAccumulatedSeconds`, `rightAccumulatedSeconds`, and
  `currentSideStartedAt` at `feeding-context.tsx:462`; pumping writes `side` at
  `pumping-context.tsx:377`; tummy time writes only the identity and pause fields at
  `tummyTime-context.tsx:494`.
- Pumping volume never lived in local timer state. It rides on the stop command:
  `useWidgetStopHandler.ts:72` passes `queuedCommand.payload?.volumeMl ?? 0`, the Watch sends
  `stopPumpingWithVolume` (`useWatchMessageHandler.ts:195`), and `BabySelector.tsx:81` passes zero
  when switching babies.
- The duration arithmetic appears twice per context, once in the restore path's conflict branch and
  once in the stop path: sleep at 784 and 1319, feeding at 524 and 807, pumping at 411 and 694, tummy
  time at 526 and 795. All eight subtract `totalPausedMs` today.

## Resolution

- **Decision:** One shared timer lifecycle module, with a per-type adapter for what actually differs.
  The extraction ships current behavior only. The module takes over what is already identical across
  the four contexts: the obsolescence guards around `stopVersionRef` and the baby-binding token, the
  pending-stop read and match, identity resolution and its backfill into local storage, the
  completion-secured short circuit with its lock release and queue fallback, `reconcileTimerLock` with
  `persistLockState`, the lock-conflict path, the server-only lock hydration branch, and the Live
  Activity restart with its `effectiveStartTime` pause arithmetic. Each type registers an adapter
  supplying only what diverges: the activity-type literal, the storage service, the `timer_data`
  codec, `buildRecord(startedAt, endedAt, data)` over that type's decoded payload, the duration rule,
  the Live Activity detail argument, and the `RESTORE_TIMER` dispatch. Record construction is
  adapter-owned and every path that writes an activity record calls it, the local stop included, so
  the duration rule has one definition per type rather than two.

  **Amended by [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md).**
  The duration rule is no longer a per-type adapter member. Every type now stores
  `endedAt - startedAt`, so the module computes the duration itself and the adapter supplies six
  members rather than seven. The two-definitions-per-type problem this decision set out to fix still
  holds for record construction, which stays adapter-owned.

  **Scope cut.** `buildRecord` took a decoded payload rather than a local snapshot so that the remote
  finalization
  [record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md)
  introduced could call the same adapter with a payload decoded off the lock row. The owner cut
  household timer control on 2026-08-05, so no device ever finalizes another's stop and that caller
  will never exist. The decoded-payload signature is now a preference rather than a requirement, and
  planning may take a local snapshot instead; what still forces one definition per type is the
  duplicate arithmetic inside each context, not a remote caller. Every other behavior decision in this
  map is separate work landing in the module afterwards. The module migrates one type at a time,
  starting with tummy time, and precedes the timer behavior work. `design-it-twice` was considered and
  skipped.
- **Rationale:** This decision was resolved on the argument that
  [record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md)
  forced a record builder callable from outside the context that started the timer, so four
  independent implementations were never available. The household timer control cut of 2026-08-05
  retired that argument along with the work, so the extraction is no longer forced by anything and is
  a maintainability case alone. What remains divergent is narrow, and
  `timer_data` being an untyped bag already draws the codec boundary. The restructuring can be proved
  behavior-neutral because `external-timer-stop-providers.integration.test.tsx` covers all four
  providers through every path it touches, so the suite passes unchanged or the move was wrong.
  Without it, every behavior decision this map still has to land lands in four places, and
  [what pause means](006-pause-semantics.md) alone reaches eight arithmetic sites of which sleep's two
  must diverge while nothing in the code records that intent. That last argument has since expired:
  [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md)
  makes all eight sites identical, so the pause change is a uniform deletion with no per-type intent to
  encode. Having no
  over-the-air channel argues for this order rather than against it, since a change proved to alter
  nothing is safer to ship than eleven changes replicated by hand across four files.
- **Alternatives rejected:** Building only the record builder that
  [record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md) forced and leaving the 300
  duplicated lines alone. It is the smallest change now and it keeps the four-fold cost on every later
  decision, with review the only thing catching a missed copy. Under the cut there is no forced record
  builder at all, so the honest version of this alternative is doing nothing, which is now a live
  option the map's handoff says to weigh. Making the behavior changes in four
  places first and consolidating afterwards, which is roughly eleven decisions times four contexts and
  makes the eventual consolidation harder as the copies drift. Keeping four independent
  implementations aligned by convention with the integration suite as enforcement, whose objection was
  that it could not satisfy remote-stop finalization; that objection went with the cut, leaving the
  drift argument alone. Collapsing the four contexts into one parameterized
  provider, which reaches far past the timer into each type's entries list, reducer, and screens.
  Running `design-it-twice`: the adapter's shape falls out of what the four copies actually differ on
  and the `timer_data` bag already fixes the codec boundary, so no second credible design survived to
  compare.
- **Consequences:** The adapter interface becomes expensive to change once four contexts depend on
  it. The restore sequence currently shares a function with the entries-list load in every context, so
  separating those is part of the first migration. Feeding's per-side arithmetic moves out of the
  conflict branch and into its `buildRecord`. The duration rule becomes one declared adapter member,
  which was where [what pause means](006-pause-semantics.md) recorded that sleep counts a resumed pause
  as elapsed while the other three subtract it. That divergence is gone under
  [showing a record whose stored length disagrees with its interval](018-disagreeing-length-display.md),
  so the duration is module-owned and no adapter declares it. The constraint that a pumping stop write
  `volumeMl` into `timer_data` in the same update that sets `stopped_at` existed because a finalizer
  firing between two separate writes would record a session with no volume; it bound
  [record ownership on remote stop](../../deferred/household-timer-control/004-remote-stop-record-ownership.md)
  rather than the extraction, and it went with the cut. The extraction leaves every `timer_data`
  payload as it is today. Every behavior decision this map still has to land lands in the module rather
  than in four contexts. Migration order is tummy time, pumping,
  feeding, sleep, which leaves the largest context and the one divergent duration rule for last;
  planning may revise it.
- **Non-goals:** The four contexts are not collapsed into one provider. Each keeps its reducer, its
  entries list, its non-timer surface, and its public start and stop API. The restructuring changes no
  behavior, so no decision in this map is implemented as part of it. The extraction adds no
  `stopped_at` handling, no remote-stop finalization, and no new `timer_data` field, since each
  arrives with the decision that introduces it. `timer_data` is not typed at the database level and
  stays `Record<string, unknown>` on the wire.
- **Required proof:** After each type migrates,
  `src/__tests__/external-timer-stop-providers.integration.test.tsx` passes with no edit to the test
  file. One unit test per adapter builds that type's record from `startedAt`, `endedAt`, and a decoded
  payload with no local `activeTimer` in scope, covering sleep's `type` and its two morning
  classification fields, feeding's per-side durations, pumping's `side`, and tummy time's bare span.
  One round-trip test per adapter over the `timer_data` each context writes today at
  `sleep-context.tsx:748`, `feeding-context.tsx:462`, `pumping-context.tsx:377`, and
  `tummyTime-context.tsx:494`. The master plan's two-account sleep smoke still runs, now proving only
  that the second account keeps seeing a timer it cannot control and keeps seeing the record the
  starter's device writes.

## Follow-on

- **Newly sharp decisions:** None
- **Still-foggy areas:** Whether the start, pause, and resume paths also move into the module, or
  whether it owns only restore and record construction. They duplicate too, but no decision in this
  map has yet needed to change them.
