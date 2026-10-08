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
| Night sleep ended over 24h ago, saved just now (manual entry or import) | — | Ignored: no celebration |
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

- [ ] Sleep and tummy-time detection pick the highest unearned tier a recent entry reaches and
      report the lower unearned tiers so they can be stored silently, per the decision table and
      examples — proven in `src/services/achievement-detection.test.ts`
- [ ] Sleep, tummy-time, and solid-food recency use the activity time from rule 2; an old entry
      saved just now is not recent — proven in `src/services/achievement-detection.test.ts`
- [ ] When a celebration fires, the lower tiers are stored as earned at the same time, and a later
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

- [ ] The decision-table rows and examples in `What to build` pass in
      `src/services/achievement-detection.test.ts`.
- [ ] A 10.5h recent night sleep on a baby with nothing earned produces one 10h celebration, and a
      following nap produces none, in `src/contexts/achievement-context.component.test.tsx`.
- [ ] A night sleep that ended over 24 hours ago but was saved just now produces no celebration.
- [ ] Focused tests, typecheck, and lint pass.
- [ ] The [verify] simulator checkpoint passes.
