# Task 0093: Wear feeding timer and logging

**Branch**: `feature/wear-feeding-timer-and-logging`
**Depends on**: 0092
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I run a feed timer from my watch; a feed started on the phone shows on my watch and the reverse.

**Change class**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

Feeding with full iOS-watch parity: start/pause/stop a feed timer from the watch, log completed
feeds with the same fields the iOS watch supports (reference `targets/watch/` feeding flows —
bottle vs breast, sides, amounts as applicable), and cross-device timer visibility. This task
builds the shared timer machinery reused by sleep (0094), pumping (0095), and tummy time (0096).

**Apple Watch parity boundary**: breastfeeding is a left/right timer with suggested side,
pause/resume, side switching, and stop. Bottle feeding is a one-shot formula or breast-milk log with
the same volume range and controls as Apple Watch. Do not add solids, notes, manual timestamps,
history, or saved-record editing.

Durable decisions this task must respect (from the brief):

- Timers are database-persisted timer-instance rows, not device-local stopwatches. Cross-device
  visibility comes from the snapshot poll (`active timers` in the payload) — the same mechanism for
  phone-started and watch-started timers. No Data Layer timer messages.
- A running timer survives watch app restart/reboot because state is in the database; reopening
  re-fetches active timers via snapshot.
- Starting a timer of a type that is already active follows the phone app's rule: surface the
  existing active timer, do not create a second instance.
- Same failure policy as all writes: visible error + retry, no queue.

## Implementation work

- [x] Shared timer machinery on the 0092 write client: create/pause/resume/complete timer-instance
      rows matching the phone's timer row shape, reusable per activity type.
- [x] Breastfeeding timer UI: suggested left/right start, pause/resume, side switch, and stop.
- [x] Bottle log UI: formula or breast milk with Apple-parity volume controls; no other untimed feed
      type.
- [x] Snapshot-driven active-timer display: phone-started feed timer appears on watch with correct
      elapsed time; watch-started timer appears on phone.
- [x] Tests: timer row shape fixture-matches phone rows; already-active-type rule; restart
      resumes running timer from snapshot; completed feed row shape parity.

## Implementation decisions

- The existing public activity snapshot remains the restoration and display contract. Owner-only
  `active_timers` hydration supplies the activity ID, side accumulators, and pause details needed to
  complete a Wear- or phone-started timer after Watch process restart without widening the snapshot.
- The shared, activity-typed timer transport owns authorized `acquire_timer_lock`, owner hydration,
  `toggle_timer_pause` or owner-scoped PATCH mutations, and merge-then-release completion. Feeding
  supplies its timer-data builders/codecs on top; a non-feeding sleep contract test proves the seam
  routes without feeding constants. The existing open/wake/retry/post-write snapshot refresh is the
  polling seam; no background poll, offline queue, or Data Layer activity payload was added.
- Breast completion follows the phone adapter's wall-span and side-accumulator semantics, including
  resumed pauses and the sub-minute discard rule. Bottle logs expose only formula and breast milk,
  default to 120 ml, clamp to 0–500 ml, and support 10 ml buttons plus actual Wear rotary input in
  5 ml steps.

## Implementation evidence

- RED/GREEN cycles cover authenticated timer acquisition row parity, the one-active-feeding rule,
  snapshot restart and remote visibility, owner hydration, pause/resume/side switching, breast and
  bottle row fixtures, actual rotary adjustment, generic sleep timer transport routing,
  resumed-pause completion, sub-minute discard, visible retry with immutable completion/bottle
  drafts, and unauthorized-session handling.
- The phone feeding adapter test decodes the exact Wear start fixture and restores its timer identity,
  proving that a Watch-created lock enters the existing phone timer lifecycle without a phone change.
- Focused pre-review proof passed the complete Wear unit suite, phone timer-adapter contract, Wear
  debug assembly, plugin generation checks, template/generated-module parity, focused lint,
  repository TypeScript typecheck, and `git diff --check`. Logs are retained in the task workflow
  directory.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove timer persistence,
snapshot restoration, row parity, and elapsed-time logic through automated seams; Task 0098 owns
the bidirectional phone↔watch timer pass.

## Acceptance criteria

- [x] Feed timer full lifecycle from watch produces the same rows a phone-run timer produces.
- [x] Automated snapshot tests cover phone-started and watch-started timer visibility in both
      directions; manual paired-device proof is deferred to Task 0098.
- [x] Watch app restart during a running timer resumes display correctly.
- [ ] Feeding logs carry parity fields; tests green in CI; no backend changes.
- [x] Solids, notes, manual timestamps, history, and saved-record editing are absent.
