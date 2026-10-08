# Task 0114: Celebrate each long sleep or tummy time once, at its highest tier, only when it just happened

**Branch**: `feature/fix-achievement-celebrations`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-08 (owner report: sleep celebrations fire in unexpected ways, a
lower tier shows after a longer sleep, and sometimes two celebrations show) · **User stories**: a
parent whose baby sleeps 10 hours sees "First 10-Hour Sleep!" once and never a 6-hour or 8-hour
celebration for that same sleep; a parent who logs or imports an old sleep sees no celebration.

## What to build

Achievement detection (sleep 6h/8h/10h, tummy time 5/10/15/20 min, first solid food) changes in
two ways. Everything else about celebrations stays as it is.

**1. Highest tier wins.** When new activity triggers detection, the app celebrates at most one
achievement per activity kind: the highest tier not yet earned that a recent qualifying entry
reaches. Every lower tier not yet earned is stored as earned at the same moment, with no
celebration, so it never fires later. Higher tiers the entry does not reach stay unearned.

**2. "Recent" means the activity ended in the last 24 hours.** An entry's activity time is its
end time; when it has no end time, its start time plus its duration; for a solid feeding with no
end time, its start time. The time the entry was saved to the app (its creation time) no longer
counts. An entry whose activity time is more than 24 hours before now is not recent.

Sleep decision table (tummy time works the same way with its own tiers and no night-only rule):

| Recent night sleeps | Unearned tiers at or below the longest recent duration | Result |
| --- | --- | --- |
| None (no night sleep, or none with a duration above zero) | — | No celebration |
| Present | None | No celebration |
| Present | One or more | Celebrate the highest; store the rest as earned silently |
| Night sleep ended over 24h ago, saved just now (manual entry or import) | — | No celebration; reached tiers stored as earned silently |
| Nap (not a night sleep) of any length | — | Ignored (unchanged) |
| Running sleep (no end time, no duration) | — | Ignored (unchanged) |

Examples, nothing earned yet: a 10.5h night sleep celebrates 10h and stores 6h and 8h. With 6h
already earned, a 9h night sleep celebrates 8h. With 10h earned but 6h not, a 7h night sleep
celebrates 6h. Logging a nap after any of these celebrates nothing.

First solid food: celebrated only when a solid feeding's activity time is recent (rule 2).

## Decided

- Celebrate only the highest reached tier, store lower ones silently — owner chose this on
  2026-10-08; showing three celebrations for one sleep is noise.
- Recency uses when the activity happened, not when it was saved — import (and manual back-entry)
  saves old records with a creation time of now.
- The 24-hour recency window and the tier thresholds stay as they are.
- The one-time catch-up on app start (which marks every tier already reached by any past entry as
  earned, with no celebration) keeps its current behavior.

## Clarifications

- 2026-10-08, review TR-1: the owner requested fixing the review finding. Historical activities
  imported or back-entered mid-session earn their reached tiers silently before recent entries
  are evaluated, matching startup catch-up. Recent entries can still celebrate higher unearned
  tiers when historical and recent entries arrive together.

## Implementation classification

- Change class: `code`; validation tier: `canonical`; TDD applicable: `true`.

## Non-goals

- Detection is still triggered by the number of entries changing: deleting an entry can still run
  detection, and editing an entry to make it longer still never does. Not fixed here.
- The earned list is still loaded once per baby; a second phone signed in to the same account can
  still repeat a celebration the first phone showed. Not fixed here.
- No new tiers, no copy or animation changes, no change to how achievements sync to the server.

## Context

Owner report: after a long night the app showed a 6-hour celebration, then later an 8-hour one,
sometimes two in a row. Cause: detection walks tiers from smallest to largest and returns the first
unearned one, so a 10h sleep earns only 6h; the next time the sleep count changes (for example a
nap), the same old sleep earns 8h, then 10h. Tummy time has the same pattern. Separately, recency
is checked against the creation time, and the Huckleberry and Nara import sets every imported
row's creation time to now, so an import can celebrate a months-old sleep and then chain through
the first bug. Manual back-entry of an old sleep reproduces the second bug without an import.

## Implementation work

- [x] Sleep and tummy-time detection pick the highest unearned tier a recent entry reaches and
      report the lower unearned tiers so they can be stored silently, per the decision table and
      examples — proven in `src/services/achievement-detection.test.ts`
- [x] Sleep, tummy-time, and solid-food recency use the activity time from rule 2; an old entry
      saved just now is not recent — proven in `src/services/achievement-detection.test.ts`
- [x] When a celebration fires, the lower tiers are stored as earned at the same time, and a later
      entry (for example a nap) does not celebrate them — proven in
      `src/contexts/achievement-context.component.test.tsx`

## Human checkpoints

- [ ] [verify] On an iOS simulator with local Supabase, on a new baby (birth date about 3 months
      ago): (a) manually log a night sleep of 10h30m that ended 1 hour ago; (b) log a 30-minute
      nap; (c) close and reopen the app; (d) log a tummy time of 16 minutes that ended now. Then,
      on a second new baby: (e) manually log a 7-hour night sleep that ended 3 days ago.
      · Expected: (a) shows "First 10-Hour Sleep!" exactly once; (b) and (c) show no celebration;
      (d) shows only "First 15-Min Tummy Time!"; (e) shows no celebration. · Failure: any 6-hour
      or 8-hour sleep celebration, any 5- or 10-minute tummy celebration, a second celebration, or
      any celebration in (e). · Reason: no end-to-end flow covers celebrations, and the modal and
      toast must be seen in the running app.

## Acceptance criteria

- [x] The decision-table rows and examples in `What to build` pass in
      `src/services/achievement-detection.test.ts`.
- [x] A 10.5h recent night sleep on a baby with nothing earned produces one 10h celebration, and a
      following nap produces none, in `src/contexts/achievement-context.component.test.tsx`.
- [x] A night sleep that ended over 24 hours ago but was saved just now produces no celebration.
- [x] Focused tests, typecheck, and lint pass.
- [ ] The [verify] simulator checkpoint passes.


## Implementation evidence

- Branch: `feature/fix-achievement-celebrations`; change class `code`, validation tier
  `canonical`, TDD applicable `true`. Focused pre-review checks only; final canonical proof and
  the simulator checkpoint belong to `finish-task`.
- Detection reports the highest unearned reached tier and its unearned lower IDs. The provider
  marks all reported IDs earned immediately; achievement storage saves them in one local write
  with one timestamp and retains the existing per-ID server insert path.
- RED/GREEN: tier matrix initially failed 12 tests (including 10h sleep returning 6h), then
  passed 20; activity-time matrix failed 6 (old activity with new creation time), then passed
  33; provider persistence failed 2 (lower IDs missing), then passed all 4.
- Passing checks: `npm run test:unit -- src/services/achievement-detection.test.ts
  src/services/achievement-storage.test.ts` (37 tests); `npm run test:component -- --runInBand
  --runTestsByPath src/contexts/achievement-context.component.test.tsx` (4 tests);
  `npm run typecheck`; `npm run lint`; `git diff --check`.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/20a37a1d27b3/` (`detection-tier-red.log`,
  `detection-tier-green.log`, `recency-red.log`, `recency-green.log`, `provider-red.log`,
  `provider-green.log`, `unit.log`, `component.log`, `typecheck.log`, `lint.log`).
- Coverage: detection tests cover every decision-table row, partial earned sets, threshold
  boundaries, entry order, end-time precedence, start-plus-duration fallback, solid start-time
  fallback, and historical catch-up. Real-provider tests cover 10.5h sleep → dismiss → nap →
  restart, 16-minute tummy time → 20-minute tummy time, old back-entered activities, and silent
  startup catch-up. Storage tests prove one batch write, one timestamp for new IDs, preservation
  of existing IDs, and per-ID authenticated sync.
- Derived facts: storage saves read and replace the complete local achievement array
  (`achievement-storage.ts`), so simultaneous individual saves cannot reliably store lower tiers;
  the new celebration path batches them. Optional silent IDs preserve the existing development
  trigger and solid-feeding result shapes (`achievement-context.tsx`, `achievement-detection.ts`).
- Boundaries: stored activity shapes and timestamps mirror `SleepStorageService.addSleep`,
  `TummyTimeStorageService.addTummyTime`, and `FeedingStorageService.addFeeding`. Component tests
  use these actual producers through real detection, provider state, and achievement storage;
  AsyncStorage and remote sync are isolated test boundaries. Unit tests mirror those same types.
- Questions/clarifications: None. Additions beyond the task: None. Deferred decisions: None.
- Out-of-scope observation: existing startup catch-up launches separate achievement saves
  concurrently, which can overwrite local earned IDs. Its in-memory catch-up behavior is covered;
  changing startup persistence is deliberately deferred. Count-only triggers and cross-device
  repeat celebrations remain the stated non-goals.
- The simulator modal/toast checkpoint remains unchecked for the manual finish-task proof.


## Review remediation

- TR-1 fixed: historical sleep, tummy-time, and solid-food records silently contribute earned IDs
  on count changes. Their IDs and any newly celebrated tier persist in one batch, preventing lost
  writes when multiple activity kinds arrive together.
- RED: two targeted provider regression tests failed because old entries left earned IDs empty.
  GREEN: all three targeted tests passed, including the mixed historical/recent batch guard.
  Logs: `tr-1-red.log` and `tr-1-green.log` in the task log directory above.
- Planning feedback: TR-1: the decision table row for "Night sleep ended over 24h ago, saved just now"
  says "Ignored". It should have said "No celebration; tiers it reaches are stored as earned
  silently", so mid-session imports behave the same as the startup catch-up.
