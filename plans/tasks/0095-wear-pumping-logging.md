# Task 0095: Wear pumping logging

**Branch**: `feature/wear-pumping-logging`
**Depends on**: 0094
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I log pumping sessions from my watch.

## Implementation classification

- **Change class**: `code`
- **Validation tier**: `canonical`
- **TDD applicable**: `true`

## What to build

Pumping with iOS-watch parity (reference `targets/watch/` pumping flows: timer and/or direct log,
sides, amounts as the iOS watch supports them) on the shared write client and timer machinery.
Sequenced after 0094 because it modifies the same shared Kotlin write/timer code.

Same durable rules as 0093/0094: direct writes, phone-identical row shapes, snapshot-driven
cross-device visibility where timers apply, visible failure + retry, no backend changes.

**Apple Watch parity boundary**: provide the left, right, and both pumping timer starts, timer
pause/resume, and stop-with-volume flow shown in `targets/watch/`, plus its last-time/today-volume
summary. Do not add an untimed pumping form, notes, manual timestamps, history, or editing.

## Implementation work

- [x] Pumping UI with left/right/both timer start, pause/resume, stop-with-volume, and Apple-parity
      summary fields.
- [x] Tests: pumping row shape fixture-matches phone rows; summary reflects the entry.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove pumping payload,
timer, and summary behavior through automated seams; Task 0098 verifies end-to-end visibility.

## Acceptance criteria

- [x] Automated integration proof shows pumping from the watch produces a phone-identical row that
      is readable through the shared snapshot path.
- [ ] Tests green in CI; no backend changes.
- [x] Untimed manual pumping, notes, manual timestamps, history, and editing are absent.

## Implementation evidence

- RED/GREEN cycles covered all three pumping start sides, phone-shaped timer acquire and completed
  row payloads, owner hydration, durable pause/resume state, paused-stop timestamps, 0–500 ml
  selection with 5 ml crown and 10 ml button steps, visible stop retry with draft reuse, runtime and
  Compose action wiring, and post-write shared-summary refresh.
- The phone-row fixture is decoded independently from the generated Wear request. A completed
  90 ml right-side session now derives its snapshot values from the generated `p_record`, then
  decodes through `ActivitySnapshotCodec` and projects as the shared last-time/today-volume Pumping
  summary.
- `./gradlew :wear:testDebugUnitTest :wear:assembleDebug` passed locally in 3 seconds; log:
  `/tmp/agent-workflows/e2f8af45fd34/a0fd2ce14ae4/wear-focused.log`.
- `node --test scripts/wear-os-plugin.test.mjs` passed 2 tests; log:
  `/tmp/agent-workflows/e2f8af45fd34/a0fd2ce14ae4/wear-plugin.log`.
- The stable diff contains no `supabase/` changes.

## Review decisions

- skipped (minor): TR-3 — Pumping resume omits `effectiveStartTime` from `timer_data` — User chose
  to defer the remaining minor/nit polish to avoid expanding Task 0095 beyond the completed pumping
  flow.
- skipped (minor): TR-4 — Pumping `pausedAt` does not use the module's millisecond timestamp format
  — User chose to defer the remaining minor/nit polish to avoid expanding Task 0095 beyond the
  completed pumping flow.
- skipped (minor): TR-6 — The sub-minute zero-volume discard branch lacks a focused test — User
  chose to defer the remaining minor/nit polish to avoid expanding Task 0095 beyond the completed
  pumping flow.
- skipped (minor): TR-7 — Wear plugin assertions match internal Kotlin source text — User chose to
  defer the remaining minor/nit polish to avoid expanding Task 0095 beyond the completed pumping
  flow.
- skipped (minor): TR-11 — Zero-delta pumping rotary events are reported as consumed — User chose
  to defer the remaining minor/nit polish to avoid expanding Task 0095 beyond the completed pumping
  flow.
- skipped (minor): TR-12 — Wear pumping omits the Apple Watch switch-side control — User chose to
  defer the remaining minor/nit polish to avoid expanding Task 0095 beyond the completed pumping
  flow.

## Completion record

- Built Wear OS pumping timers for the left, right, and both sides with pause, resume,
  stop-with-volume, owner hydration, retry-safe completion, and shared snapshot summaries.
- Phone-compatible writes omit duration fields for sub-minute volume-only sessions, and a
  successful start publishes its controllable timer state before the snapshot refresh begins.
- Relevant implementation and proof live under
  `plugins/with-wear-os/android/wear/src/main/java/com/sofibaby/app/wear/` and
  `plugins/with-wear-os/android/wear/src/test/java/com/sofibaby/app/wear/`.
- README disposition: updated **Wear OS Native Integration** with pumping timer controls, sides,
  and stop-time volume entry. The affected prose passed two `write-well` audit passes; pass 1 split
  an overloaded timer-control sentence, and pass 2 found no new issues.
- Review outcome: fixed TR-1, TR-2, TR-5, TR-8, TR-9, and TR-10. Skipped TR-3, TR-4, TR-6, TR-7,
  TR-11, and TR-12 at the user's request to finish without expanding the completed pumping flow.
  TR-13 remains deferred out of scope because it predates this task. No security risk was accepted.
- Automated proof: `npm run check:code` passed on 2026-08-24 after generated Wear test reports were
  cleaned from the ignored Android build directory. Log:
  `/tmp/agent-workflows/e2f8af45fd34/a0fd2ce14ae4/canonical.log`.
- Backend boundary: the task diff contains no `supabase/` changes.
- Manual verification: none required. The validation boundary assigns paired phone/watch
  synchronization to Task 0098.
