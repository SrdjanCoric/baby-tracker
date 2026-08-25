# Task 0096: Wear tummy time logging

**Branch**: `feature/wear-tummy-time-logging`
**Depends on**: 0095
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I time and log tummy time from my watch.

## Implementation classification

- **Change class**: `code`
- **Validation tier**: `canonical`
- **TDD applicable**: `true`

## What to build

Tummy time with iOS-watch parity (reference `targets/watch/` tummy time flows) on the shared write
client and timer machinery. Completes activity-type parity: with this merged, every activity type
the iOS watch supports (feeding, sleep, diaper, pumping, tummy time) works on Wear. Sequenced after
0095 because it modifies the same shared Kotlin write/timer code.

Same durable rules as 0093–0095: direct writes, phone-identical row shapes, snapshot-driven
cross-device timer visibility, visible failure + retry, no backend changes.

**Apple Watch parity boundary**: provide only the start/pause/resume/stop timer and today's minutes
shown by Apple Watch. Do not add manual duration entry, notes, backdating, history, or editing.

## Implementation work

- [x] Tummy time start/pause/resume/stop timer UI and today's-minutes readout.
- [x] Tests: tummy time row/timer shape fixture-matches phone rows; summary reflects the entry.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove tummy-time timer,
row parity, and summary behavior through automated seams; Task 0098 verifies the complete activity
set end to end.

## Acceptance criteria

- [x] Automated integration proof shows tummy time from the watch produces a phone-identical row
      readable through the shared snapshot path.
- [x] Automated suites cover all five iOS-watch activity payloads; paired-device proof is deferred
      to Task 0098.
- [x] Tests green locally; CI proof belongs to the later PR workflow. No backend changes.
- [x] Manual duration entry, notes, backdating, history, and editing are absent.

## Implementation evidence

- RED/GREEN cycles covered the phone-shaped timer acquire payload, owner hydration, durable
  pause/resume data, paused-stop timestamps, phone-shaped completed rows, start/hydration/stop retry
  draft reuse, snapshot restoration, and coordinator state publication before summary refresh.
- Independent phone fixtures verify the tummy-time timer request and completed seven-field row. A
  generated completed entry is decoded through `ActivitySnapshotCodec` and projected as the shared
  Tummy time summary; a zero-duration proof confirms that stopping always emits a row and exposes no
  manual-entry fields.
- `./gradlew :wear:testDebugUnitTest :wear:assembleDebug` passed locally in 5 seconds; log:
  `/tmp/agent-workflows/e2f8af45fd34/a4c368a2ea54/wear-focused.log`.
- `node --test scripts/wear-os-plugin.test.mjs` passed 2 tests; log:
  `/tmp/agent-workflows/e2f8af45fd34/a4c368a2ea54/wear-plugin.log`.
- The stable diff contains no `supabase/` changes.
- skipped (minor): TR-4 — Wear tummy-time resume omits `effectiveStartTime` — user limited this remediation pass to majors and TR-6.
- skipped (minor): TR-5 — Hydration overwrites the DB-derived paused elapsed value — user limited this remediation pass to majors and TR-6.
- skipped (minor): TR-7 — Tummy-time coordinator duplicates the sibling timer state machines — user limited this remediation pass to majors and TR-6.
- skipped (minor): TR-8 — Tummy-time section duplicates the today-minutes summary — user limited this remediation pass to majors and TR-6.

## Completion record

- Built Wear OS tummy-time start, pause, resume, and stop controls with today's-minutes summary,
  phone-shaped writes, owner hydration, retry-safe completion, and shared snapshot projection.
- Relevant implementation and proof live under
  `plugins/with-wear-os/android/wear/src/main/java/com/sofibaby/app/wear/` and
  `plugins/with-wear-os/android/wear/src/test/java/com/sofibaby/app/wear/`.
- README disposition: updated **Wear OS Native Integration** to document tummy-time timer controls
  and database persistence alongside the existing feeding and sleep behavior. The affected prose
  passed two `write-well` audit passes. Pass 1 found no findings; pass 2 found no new findings.
  The audit checked necessity, em dashes, filler, rhythm, scaffolding, staging, antithesis,
  inflation, redundancy, concreteness, voice, and read-aloud flow.
- Review outcome: TR-1, TR-2, TR-3, and TR-6 fixed. TR-4, TR-5, TR-7, and TR-8 were skipped as
  minor or nit findings at the user's request to fix majors and TR-6. TR-9 remains
  `deferred-out-of-scope` as a pre-existing security concern, and TR-10 remains
  `deferred-out-of-scope` as a pre-existing cross-flow question. No security risk was accepted.
- Automated proof: `npm run check:code` passed on 2026-08-25 with exit 0 after the ignored generated
  Wear test report was removed. It passed lint, strict type checking, 162 Vitest files with 2,831
  tests, local-date checks, 118 Jest suites with 1,093 tests, the CI contract suite, Swift widget
  checks, and the production-gating check. Log:
  `/tmp/agent-workflows/e2f8af45fd34/a4c368a2ea54/canonical.log`.
- The stable diff contains no `supabase/` changes. The task has no `[verify]` checkpoint; paired
  phone/watch synchronization remains assigned to Task 0098, so no manual verification was
  required.
