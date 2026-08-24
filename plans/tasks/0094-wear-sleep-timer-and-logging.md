# Task 0094: Wear sleep timer and logging

**Branch**: `feature/wear-sleep-timer-and-logging`
**Depends on**: 0093
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I track my baby's sleep from my watch.

## Implementation classification

- **Change class**: `code`
- **Validation tier**: `canonical`
- **TDD applicable**: `true`

## What to build

Sleep tracking with iOS-watch parity on top of the shared timer machinery from 0093: start/stop a
sleep timer from the watch with the fields the iOS watch supports (reference `targets/watch/` sleep
flows), rows identical in shape to phone-written sleep sessions, cross-device visibility via
snapshot. Sequenced after 0093 because both modify the shared Kotlin write client and timer
machinery.

Same durable rules as 0093: DB-persisted timer instances, no second instance for an
already-active type, visible failure + retry, no backend changes.

**Apple Watch parity boundary**: show the current awake/wake-window readout and the phone-confirmation
notice when applicable; provide only automatic sleep start plus pause/resume/stop. Do not add manual
sleep entry, nap/night choice, overlap handling, morning-classification answers, history, or editing.

## Implementation work

- [x] Sleep timer UI with automatic type, pause/resume/stop, current awake/wake-window readout, and
      phone-confirmation notice, on the shared timer machinery.
- [x] Snapshot-driven display of a phone-started sleep timer.
- [x] Tests: sleep row/timer shape fixture-matches phone rows; already-active rule; summary
      reflects completed sleep.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove the shared timer,
snapshot, and row-parity behavior through automated seams; Task 0098 owns the end-to-end device
pass.

## Acceptance criteria

- [x] Automated integration proof shows the watch sleep lifecycle produces phone-identical rows.
- [x] Snapshot tests prove a phone-started sleep timer renders on the watch.
- [ ] Tests green in CI; no backend changes.
- [x] Manual sleep entry, classification controls, overlap handling, history, and editing are absent.

## Implementation evidence

- RED/GREEN cycles covered phone-started snapshot restoration, already-active locks, automatic
  start shape and state, phone-shaped completion and lock release, pause/resume persistence,
  stop retry reuse, owner hydration, stale-session reset, awake/next-nap display, phone
  confirmation, and the no-anchor wake-window display.
- `./gradlew :wear:testDebugUnitTest :wear:assembleDebug` passed locally in 3 seconds; log:
  `/tmp/agent-workflows/e2f8af45fd34/1aa0ca028842/wear-focused.log`.
- `node --test scripts/wear-os-plugin.test.mjs` passed 2 tests; log:
  `/tmp/agent-workflows/e2f8af45fd34/1aa0ca028842/wear-plugin.log`.
- The stable diff contains no `supabase/` changes. CI proof remains for the review/finish workflow.

## Review decisions

- skipped (minor): TR-7 — Wear sleep resume writes timer_data without `effectiveStartTime` — Lower priority than the three minor correctness/data-loss findings selected for remediation.
- skipped (minor): TR-10 — The sub-minute discard branch for sleep completion has no test — Lower priority than the three minor correctness/data-loss findings selected for remediation.
- skipped (minor): TR-11 — The new sleep awake-readout ticker runs every 60s unconditionally — Lower priority than the three minor correctness/data-loss findings selected for remediation.
- skipped (minor): TR-12 — The phone timer-shape fixture omits two fields the phone always writes — Lower priority than the three minor correctness/data-loss findings selected for remediation.
- skipped (minor): TR-13 — README is not updated for Wear OS sleep timers — Lower priority than the three minor correctness/data-loss findings selected for remediation.
- skipped (minor): TR-14 — `pausedAt` uses a non-millisecond timestamp formatter — Lower priority than the three minor correctness/data-loss findings selected for remediation.

## Completion record

- Built automatic Wear OS sleep start, pause, resume, and stop controls on the shared persisted
  timer machinery, including owner hydration, cross-device snapshot display, completed-row writes,
  awake and wake-window readouts, and the phone-confirmation notice.
- Preserved phone-owned morning classification through hydration, pause, resume, and completion;
  confirmed morning decisions control the completed sleep type. Watch classification loads the
  selected baby's persisted day boundaries and falls back to 06:00/19:00 when they are unavailable.
- Key implementation paths: `plugins/with-wear-os/android/wear/src/main/java/com/sofibaby/app/wear/`
  and `plugins/with-wear-os/android/wear/src/test/java/com/sofibaby/app/wear/`.
- README: updated **Wear OS Native Integration** with sleep controls and readouts. The `write-well`
  audit completed in 2 passes; pass 1 removed stacked timer-control phrasing, and pass 2 found no
  new issues.
- Review outcome: fixed TR-1, TR-2, TR-3, TR-4, TR-5, TR-6, TR-8, and TR-9. Skipped TR-7,
  TR-10, TR-11, TR-12, TR-13, and TR-14 as lower priority than the selected correctness and
  data-loss findings. No security risk was accepted. The finish-task README audit subsequently
  addressed the documentation gap described by TR-13.
- Automated proof: `npm run check:code` passed on 2026-08-24. Log:
  `/tmp/agent-workflows/e2f8af45fd34/1aa0ca028842/canonical.log`.
- Backend boundary: the task diff contains no `supabase/` changes.
- Manual verification: none required here. The task validation boundary assigns paired-device and
  phone-to-watch synchronization checks to Task 0098.
