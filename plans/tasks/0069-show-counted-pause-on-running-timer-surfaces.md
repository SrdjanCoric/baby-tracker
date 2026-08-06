# Task 0069: Show what stopping would record on every running-timer surface

**Branch**: `feature/show-counted-pause-on-running-timer-surfaces`
**Depends on**: 0068
**Source**: `plans/decision-maps/unified-timer-contract/clusters/pause-semantics.md` and its two members,
`decisions/resolved/006-pause-semantics.md` and
`decisions/resolved/018-disagreeing-length-display.md` (both resolved) · **User stories**: As a
caregiver, I want a running timer to freeze while it is paused and to carry the paused span once I
resume, so that the number on screen is the number the app will save if I stop right then.

**Execution classification**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

The counted-pause rule Task 0068 applied to the written record, applied to every surface that displays
a running timer, so the live readout equals what stopping at that instant would record.

### The rule

- While a pause is open, a running timer's elapsed readout **stops growing** and reads
  `pausedAt - startedAt`.
- After a resume, the readout counts the paused span: elapsed reads `now - startedAt`.
- The start is **never shifted forward** by `totalPausedMs`. The `effectiveStartTime` idiom that adds
  `totalPausedMs` to the start disappears from every surface.

This is the same arithmetic in every place, applied to all four timer types.

### Surfaces to change

Each of these subtracts `totalPausedMs`, shifts the start by it, or both, today:

- **`buildOngoingSleepEntry` in `src/utils/ongoing-sleep.ts`** — it currently shifts the entry's start
  by `totalPausedMs` plus the open pause, deliberately, so the interval carried only unpaused time.
  The entry must now start at the real start, and while a pause is open it must **end at `pausedAt`**
  rather than at now. Its doc comment states the old reasoning and has to be rewritten with the new
  one. This entry feeds the Statistics sleep screens' Day view blocks and total and the Timeline
  daily summary for sleep.
- **`DashboardCard` and `CompactActivityRow`** — both take `timerStartTime`, `timerPausedAt`, and
  `timerTotalPausedMs` and tick an elapsed value from them for all four types. `timerTotalPausedMs`
  stops affecting the readout. Decide whether the prop is still carried or removed; if removed, drop
  it from the four call sites on the dashboard and from the components' memo comparators. A timer
  owned by another caregiver follows the same rule: its dashboard readout freezes at the shared
  `pausedAt` while paused and resumes from the real start, without changing permissions or controls.
- **The four activity screens** — `app/feeding/index.tsx`, `app/sleep/index.tsx`,
  `app/pumping/index.tsx`, and `app/tummyTime/index.tsx` each compute a displayed elapsed value and,
  for sleep, pumping, and tummy time, an elapsed-minutes figure that drives a duration alert. Both
  figures follow the new rule, so an alert fires on total elapsed rather than on active-only time.
- **`src/contexts/widget-context.tsx`** — the payload pushed to the widget and the Watch computes an
  `effectiveStart` shifted by `totalPausedMs` for each of the four types and, while paused, an
  `accumulatedSeconds` with the same subtraction. `effectiveStart` becomes the real start, and the
  paused `accumulatedSeconds` becomes `pausedAt - startedAt`.
- **Live Activity elapsed arguments** — the four contexts pass an active-elapsed figure to
  `pauseTimerLiveActivity` and `resumeTimerLiveActivity`. Both now pass total elapsed under the rule
  above, so a resumed sleep's Live Activity continues from full elapsed time, which is the behavior the
  feedback thread asked for.
- **The lifecycle module's Live Activity restart** — Task 0066 moved the restart's `effectiveStartTime`
  arithmetic, `startedAt + totalPausedMs` applied only when `totalPausedMs > 0`, into
  `src/services/timer-lifecycle.ts`. The shift is removed, so a restored timer's Live Activity resumes
  from the real start.

### What does not change

- Native widget and Watch controls, layout, labels, and pause bookkeeping do not change. Review
  remediation updates only their resume timeline: both preserve the real start, continue sending
  `pauseDurationMs` and `accumulatedSeconds`, and ignore legacy shifted `effectiveStartTime` values
  when refreshing from the server. The app keeps accumulating `totalPausedMs` on the running timer
  and simply stops displaying anything derived from it.
- No control, layout, label, or copy changes on any surface.
- `SleepPredictionCard` keeps its intentional sleeping-state-only presentation with no elapsed
  duration. There is no duration readout on that card to align with the counted-pause rule.
- Nothing about what is written to a record — Task 0068 owns that and this task must not alter it.
- Nothing about the edit screens or the manual logging forms, which belong to the timer time editing
  cluster.

## Implementation work

- [x] Rewrite `buildOngoingSleepEntry` so the entry starts at the timer's real start, ends at
      `pausedAt` while a pause is open and at now otherwise, and derives `durationSeconds` from that
      interval; replace its doc comment's superseded rationale.
- [x] Update the sleep surfaces that consume the ongoing entry so the Day view block, the Day view
      total, and the Timeline daily summary all report the frozen value during a pause and the counted
      value after a resume.
- [x] Apply the rule to the `DashboardCard` and `CompactActivityRow` tickers for all four types, and
      resolve the now-unused `timerTotalPausedMs` prop consistently across the components, the
      dashboard call sites, and the memo comparators. Apply the same display rule to dashboard timers
      owned by another caregiver.
- [x] Apply the rule to the displayed elapsed value on all four activity screens, and to the
      elapsed-minutes figure driving the sleep, pumping, and tummy time duration alerts.
- [x] Apply the rule to the widget payload in `widget-context`: real start for `effectiveStart`, and
      `pausedAt - startedAt` for the paused `accumulatedSeconds`, for each of the four types.
- [x] Preserve the real start when the native widget or Watch resumes a timer, send that start as the
      resume `effectiveStartTime`, and use the server's `started_at` on native network refresh.
- [x] Pass total elapsed to `pauseTimerLiveActivity` and `resumeTimerLiveActivity` from all four
      contexts, and remove the `totalPausedMs` shift from the lifecycle module's Live Activity restart.
- [x] Per type, add coverage that a running timer's readout stops growing while a pause is open and
      resumes counting the paused span after a resume, at the lowest reliable seam for each surface:
      unit tests for the ongoing sleep entry, component tests for the two ticker components and the
      four screens, payload tests for `widget-context`, and call-argument assertions for the Live
      Activity pause, resume, and restart paths.
- [x] Add coverage that a running timer's displayed elapsed equals the `durationSeconds` the record
      would carry if stopped at that instant, both during a pause and after a resume, so the live view
      and Task 0068's write path cannot drift apart.

## Implementation evidence

- RED: focused tests failed on the old pause subtraction in the ongoing sleep entry, both dashboard
  tickers, all four activity screens, all four widget payload entries, all four Live Activity
  pause/resume paths, the lifecycle restart anchor, and remotely owned dashboard timers.
- GREEN: 20 focused unit tests pass across ongoing sleep, Timeline arithmetic, and timer lifecycle;
  205 tests pass across the 12 affected component and real-provider suites.
- The real-provider integration seam proves, per type, that paused and resumed displayed elapsed
  equals the `durationSeconds` written by a stop at that instant.
- Focused pre-review validation: targeted ESLint and repository TypeScript checking pass. Logs are
  under `/tmp/agent-workflows/e2f8af45fd34/cf684b98cfac/`.
- Scope audit: native changes are limited to preserving/reading the real start on widget and Watch
  resume; no native control, layout, label, copy, edit/manual form, or record-writing path changed;
  `SleepPredictionCard` retains its intentional no-duration presentation.

## Acceptance criteria

- [x] For each of the four types, the dashboard card, the compact activity row, and the activity screen
      stop advancing while the timer is paused and read `pausedAt - startedAt`.
- [x] For each of the four types, after a resume those surfaces read `now - startedAt`, including the
      resumed pause span.
- [x] A dashboard timer owned by another caregiver freezes at its shared `pausedAt` while paused and
      resumes from its real start, without changing its ownership or control state.
- [x] The Statistics Day view block and total and the Timeline daily summary report a running paused
      sleep frozen at `pausedAt` and a resumed one counting the paused span.
- [x] The widget payload carries the real start for every running timer and, while paused,
      `accumulatedSeconds` equal to `pausedAt - startedAt`.
- [x] The Live Activity pause, resume, and restart paths receive total elapsed, with no
      `totalPausedMs` shift left anywhere.
- [x] A running timer's displayed elapsed equals the `durationSeconds` a stop at that instant would
      record, for every type, both paused and resumed.
- [x] Native widget and Watch resume paths preserve the real start without changing controls, layout,
      labels, pause bookkeeping, or record-writing behavior.
