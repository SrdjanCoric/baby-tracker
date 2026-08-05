# Decision map: unified timer contract

**Status:** active

## Destination

A single timer behavior contract that feeding, sleep, pumping, and tummy time all follow: who may
control a running timer, how its start and end times are edited, what pause means, and how the
contract is enforced across the app, widget, Watch, and Live Activity. Each cluster below is released
for planning as it completes. This map decides; it writes no code and no tasks.

## Notes

Source: caregiver feedback thread of 2026-08-04 about sleep timers, generalized by the owner to all
four timer types. Every decision here must answer for all four, not for sleep alone.

Repository facts established while charting:

- `active_timers` (migration `020`) holds one row per `(baby_id, activity_type)` with `started_by`,
  `started_at`, `timer_data JSONB`, and `REPLICA IDENTITY FULL`. Realtime already delivers the row to
  every household device. `app/(tabs)/index.tsx` line 623 derives the other caregiver's elapsed time
  locally from `lock.startedAt` and re-renders on the 60-second `useTimeRefresh` tick, so the second
  phone already has the data it needs; what it lacks is control.
- Migration `056_authorize_active_timer_controls.sql` routes control through
  `acquire_timer_lock`, `release_timer_lock`, `toggle_timer_pause`, and `cleanup_stale_timer_locks`,
  and re-grants direct `SELECT, UPDATE, DELETE` on the table to `authenticated`. The row policy from
  migration `020` is still `USING (started_by = auth.uid())` at
  `supabase/migrations/020_add_active_timers.sql:53`, and after the household timer control cut it
  stays that way: only the caregiver who started a timer may write its row. The `SELECT` policy is
  household-wide, which is why the second phone displays a timer it cannot touch.
- Pause is implemented per context as `pausedAt` plus `totalPausedMs`, and the paused span is
  subtracted from the recorded duration. See `src/contexts/sleep-context.tsx` around lines 253 to 267
  and 1400 to 1460. The caregiver in the feedback thread expected the opposite.
- `plans/allow-household-timer-control.md` is a superseded sketch. It targets migration `039` when the
  tree is at `059`, and it predates migration `056`. Do not use it as input.
- Open task `0056` constrains the same `active_timers` UPDATE path and adds migration `062`.
- Sleep classification, prediction, and statistics read start time, end time, and duration from saved
  rows: `src/utils/sleep-patterns.ts`, `src/utils/statistics.ts`, and the nap continuation setting.
- Display preferences are device-local and unsynchronized. `src/services/unit-storage.ts` keys
  `@unit_system` in `AsyncStorage` and falls back to `DEFAULT_UNIT_SYSTEM`, and
  `src/services/theme-storage.ts` stores the theme the same way. Neither is user-scoped and neither
  reaches the database, so a new display preference follows that pattern rather than raising a storage
  question. Combined with the absence of an over-the-air channel, a preference that gates behavior
  current builds always perform must default to on, or the next store build withdraws it.
- The app has no over-the-air update channel: no `expo-updates` dependency, no `updates` block in the
  app config, and no minimum-version or forced-upgrade gate anywhere in the tree. JavaScript and
  native code reach users only through a store build; the released version is 4.7.1. Any change that
  withdraws a capability current builds rely on is therefore a live regression, not a staged one.
- Four direct writers of `active_timers` bypass the migration `056` RPCs:
  `src/services/active-timer-service.ts:184` and `:303`, `targets/widget/index.swift:531`, and
  `targets/watch/index.swift:1215`. `targets/watch/index.swift:1165` already calls
  `/rest/v1/rpc/acquire_timer_lock`, proving Swift can reach an RPC over REST.
- `active_timers` is in the offline sync allowlist at `src/services/sync/sync-engine.ts:51`, and the
  engine writes allowlisted tables generically at lines 718, 729, and 739, so queued offline timer
  operations replay as direct table writes after any migration.
- Live Activities are push-capable but per-user. `LiveActivityController.swift:70` requests with
  `pushType: .token`, the `start-live-activity` edge function takes a `pushToStartToken` from its
  caller, and `end-live-activity` takes only a `pushToken` the calling device holds locally
  (`targets/widget/index.swift:544`). Migration `027_add_widget_push_tokens.sql` scopes every policy
  on `widget_push_tokens` to the owning user, and the Live Activity token is not in the database at
  all, so no caregiver can start or end a Live Activity on another's phone.
- Existing architectural decisions in `plans/master-plan.md` that bind this work: external timer
  commands are durable and idempotent; in-app timer completion converges on one durable result with a
  stable completion identity; household timer release is proved through one representative two-account
  sleep smoke plus component and real-provider tests; migrations are applied to local Supabase only.

Skills later sessions need: `talk-it-through` for every discussion decision, and `design-it-twice` if
the shared seam decision stays contested.

Layout: an open or active decision lives in `decisions/`, and a resolved one moves to
`decisions/resolved/` the moment it resolves, so listing either directory answers what is still
undecided and what is settled. A third directory, `deferred/`, holds work the owner has cut; it
is out of the frontier and out of the handoff, and the `Cut` section below says what is in there
and why. The directory keeps its name because the records inside it are intact and readable if the
question is ever reopened. There are no `reference/` and no per-cluster subdirectories; a resolved record's `Plannable`
and `Cluster` headers already carry that, and the `Handoff` section is the index of what can be acted
on.

Three records still in the map are marked `Plannable: none` and are never an argument to `to-plan`.
Decision `003` is an audit that informs other decisions. Decisions `008` and `017` are discussions
that resolved as a no, so they change nothing and produce no tasks; `008` survives because it sets the
scope of `009` and because a later session that reaches for a stop-time control has to reopen it
rather than assume it, and `017` survives because it is the only record of why no backfill exists and
which alternative is ready if that answer changes. Read `003` before any decision that touches pause
or time editing, for its census of which surface reads the stored duration and which measures the
interval. Its other finding, that sleep runs on two clocks, held until
[showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
made the two the same clock on all four types for every new record.

[`prototypes/clock-time-entry-mock.html`](prototypes/clock-time-entry-mock.html), published at
<https://claude.ai/code/artifact/2dc8a9f5-8f13-42b8-bf0a-c09191277dfc>, draws the manual logging and
saved-record edit forms as they are today and as the owner settled them: start time and end time, with
duration derived. It is the form input to
[entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md) and should be
read before that decision is resolved or planned.

The two nap statistics decisions, `012` and `014`, are the only members of this map that touch
statistics rather than timers. They share one mock,
[`prototypes/nap-stats-mock.html`](prototypes/nap-stats-mock.html), published at
<https://claude.ai/code/artifact/92e0f3c6-a3d2-44e2-87e3-6430d1585af2>, which draws the current
Summary screen with both additions marked. Read the mock before planning either one.

## Decisions so far

- [turning the Live Activity off](decisions/resolved/011-live-activity-visibility-toggle.md): one
  global setting gates every call that starts a Live Activity; size and placement stay Apple's.
- [derived-data blast radius](decisions/resolved/003-sleep-derivation-blast-radius.md): sleep runs on
  two clocks, and only paused records disagree; every live sleep surface measures
  `endedAt - startedAt` while the stored `durationSeconds` is the only place the pause is subtracted,
  and feeding, pumping, and tummy time invert that split.
- [average daily nap total](decisions/resolved/012-daily-nap-total-average.md): a new `Avg Nap Time`
  card divides total daytime nap seconds by the days in the range that hold at least one nap, and
  carries that divisor as its subtitle.
- [what pause means](decisions/resolved/006-pause-semantics.md): stopping a paused timer ends the record at
  `pausedAt` on all four timers, and a resumed pause counts as elapsed time for sleep, so a saved
  sleep's `durationSeconds` finally equals its interval with no schema change and no consumer
  repointed. Its split, which kept feeding, pumping, and tummy time subtracting a resumed pause, is
  superseded by
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md).
- [per-nap-slot statistics](decisions/resolved/014-per-nap-slot-statistics.md): a new `Nap Schedule`
  panel gives each nap of the day its own row with average duration and average start time, numbered
  forward from the start of the sleep-day, shown only when the slot occurred at least 3 times and on
  at least 30% of the napping days.
- [running timer start time edit](decisions/resolved/007-running-timer-start-time-edit.md): the
  activity screen's start-time label becomes tappable for the caregiver who started the timer and
  accepts a value between twelve hours ago and now, floored at the previous same-type activity's end
  and shown as the picker's own bounds, written straight to `active_timers.started_at` under a trigger
  that fires only when that column changes, with "Started earlier" kept and tightened to the same
  range. Its household half, the non-starter edit and the dashboard card turning navigational, went
  with the cut below.
- [setting the real end time when stopping](decisions/resolved/008-stop-time-rewind.md): no. Stopping
  records the moment the stop was issued, or `pausedAt` when the timer is paused, on every surface
  that can stop one, and the arithmetic the caregiver complained about is removed at the entry forms
  instead, which widens
  [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md) to cover
  manual logging as well as editing.
- [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md):
  both hand-entry paths take a start and an end under one rule set, bounded by picker ranges that
  restate the validators already shipped, with saved records keeping the master plan's warn-and-allow
  overlap policy, sleep type and morning classification recomputed from the edited start, and the
  stored length rewritten only when a caregiver actually moves a time.
- [backfilling historical paused sleeps](decisions/resolved/017-paused-sleep-backfill.md): no. Sleeps
  written before the pause rule changed are left as they are, in the data and on screen, and the only
  correction is the one a caregiver makes by deliberately editing a record's times.
- [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md):
  a resumed pause now counts on all four timers, so feeding, pumping, and tummy time stop subtracting
  it and every new record satisfies `durationSeconds === endedAt - startedAt`, which leaves the form
  nothing to explain and leaves tummy time and pumping totals carrying resumed pause spans, a cost the
  owner took over splitting records.
- [interval overlap detection for feeding, pumping, and tummy time](decisions/resolved/019-interval-overlap-non-sleep.md):
  the duplicate check is wired into those three types' manual and edit screens, which run none today,
  and two records that both carry a real interval are compared for overlap the way sleep is, while a
  bottle, a solids entry, or any record without an end falls back to the existing start-proximity
  threshold; no type is ever compared against another.
- [the seam that keeps all four timers identical](decisions/resolved/010-shared-timer-seam.md): one
  shared timer lifecycle module owns the restore sequence and record construction, each type registers
  an adapter for the activity-type literal, storage service, `timer_data` codec, `buildRecord`, Live
  Activity detail, and restore dispatch, and it lands before the behavior work as a restructuring
  proved by the existing cross-type suite passing unchanged. The duration rule was a seventh adapter
  member until
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
  made it uniform and module-owned.

## Not yet specified

- How much E2E coverage this expansion needs beyond the existing two-account sleep smoke.
- Whether the previous-activity clamp that
  [running timer start time edit](decisions/resolved/007-running-timer-start-time-edit.md) set should
  ever look at a different activity type. A feed and tummy time can legitimately overlap while two
  naps cannot, and the decision deliberately clamps against the same type only.
- Whether the dashboard card eventually edits a start time inline rather than routing into the
  activity screen. Deferred by
  [running timer start time edit](decisions/resolved/007-running-timer-start-time-edit.md) rather than
  excluded.
- Naming across the nap metrics. `Avg Nap Time` sits one line from the existing `Avg Nap Duration`
  and they mean different things: total per day against the length of one nap. Whether the new label,
  the old one, or both should change is a wording question no one has phrased as a decision yet.
- Whether the `Nap Schedule` panel needs an upper bound on slot count. A newborn napping six times a
  day would render six rows if each cleared both appearance tests.
- Whether the start, pause, and resume paths also move into the shared timer lifecycle module, or
  whether it owns only restore and record construction as
  [the seam that keeps all four timers identical](decisions/resolved/010-shared-timer-seam.md)
  settled. Those paths duplicate too, but no decision in this map has yet needed to change them.
- What should happen to a sleep left paused until `cleanup_stale_timer_locks` removes the lock at
  twelve hours. The lock disappears and no record is written, which is today's behavior, and
  [what pause means](decisions/resolved/006-pause-semantics.md) now implies an answer that no code
  applies.
- Whether the tummy time and pumping overcount is acceptable in use. Under
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
  a resumed pause lands in totals parents measure against a goal. The owner chose to ship it and watch
  it, and splitting records is the answer that decision already costed if it is not.
- Whether a caregiver ever needs to see or restore a record's paused span. Nothing stores it:
  `totalPausedMs` lives on the running timer and never reaches a saved record. For records written
  after the counted-pause rule there is no span to restore, so this now concerns the legacy set only.
- Whether a session shorter than a minute, such as a brief tummy time, deserves a way to be recorded.
  It cannot be logged today either, since all four manual validators impose a one-minute minimum.
- Whether the duplicate dialog should say what it found. "Overlaps an existing entry" and "logged 8
  minutes ago" are different claims, and `DuplicateConfirmationDialog.ts` currently splits its copy by
  activity type rather than by match reason.
- Whether diaper and growth should ever run the duplicate check that
  [interval overlap detection for feeding, pumping, and tummy time](decisions/resolved/019-interval-overlap-non-sleep.md)
  left unwired. Both are moment records outside this map's timer contract, so the question belongs to
  whoever next touches them rather than here.
- Whether the Timeline should surface its edit path more prominently, now that editing a saved record
  is the only way to correct a mistimed stop. The route exists and is unchanged, so this is a
  discoverability question nobody has phrased yet.
- The caregiver reported that the second phone's elapsed time does not update at all. The code path
  says it should, on a 60-second tick from `lock.startedAt`. Whether this is coarse granularity, a
  dropped Realtime subscription, or a genuine defect needs reproduction on two devices before the
  question can be phrased. This is a display question and survives the cut below, since the second
  phone still shows another caregiver's timer and the cut is precisely that it never controls it.

## Cut

- **Household timer control**, cut by the owner on 2026-08-05, before any of it was planned. The
  product no longer has multiple editors: one caregiver never controls a timer another caregiver
  started, on any surface. The second phone still displays that timer, because the `SELECT` policy on
  `active_timers` is household-wide and Realtime already delivers the row, and it still cannot touch
  it.

  Everything about household control now lives in
  [`deferred/household-timer-control/`](deferred/household-timer-control/household-timer-control.md):
  the cluster file and its seven decisions, four resolved and three open. They are out of the
  frontier, out of the handoff, and no task file depends on them. That archive's own header lists the
  members and records what each of the four citing decisions lost.

  What the cut takes with it: the authorization widening and its shared `is_household_member`
  predicate, the `stopped_at` marker and household finalization of a stop, control parity across the
  widget, Watch, and dashboard card, and the three unanswered questions about offline replay,
  unfinalized stops, and a remotely changed Live Activity. `013` was part-answered on the day it was
  cut and records those answers rather than losing them. The fog entries about client-gate skew,
  the widget's household configuration surfaces, editing in-progress detail on a lock you do not own,
  a timeout on the stopping state, the offline start-edit conflict, and the unverified `INSERT` grant
  went with it, since each exists only because of this work.

  The four decisions that stayed and cited it have each been amended in place, so no handoff item
  carries a scope the cut removed:
  [what pause means](decisions/resolved/006-pause-semantics.md) drops one proof item and keeps
  `toggle_timer_pause` owner-only;
  [running timer start time edit](decisions/resolved/007-running-timer-start-time-edit.md) gains a
  **Scope cut** paragraph making the edit the starter's alone, leaving the dashboard card's gate
  untouched and needing no policy change;
  [the seam that keeps all four timers identical](decisions/resolved/010-shared-timer-seam.md) loses
  its forcing argument and becomes a maintainability case;
  [setting the real end time when stopping](decisions/resolved/008-stop-time-rewind.md) cited the
  cluster for context only and is unaffected.

  What stays buildable: the timer time editing cluster, pause semantics, the shared timer seam, the
  Live Activity toggle, and both nap statistics handles.

## Out of scope

- **Shortening the Live Activity or freeing the status bar clock.** Apple controls Dynamic Island and
  Live Activity presentation size. `ActivityKit` gives the app no width or placement control, so this
  cannot be built at all. Recorded in
  [turning the Live Activity off](decisions/resolved/011-live-activity-visibility-toggle.md).

## Handoff

Plannable now:

- [turning the Live Activity off](decisions/resolved/011-live-activity-visibility-toggle.md),
  standalone. The record does not name the preference's storage scope or default because the
  repository already fixes both: device-local `AsyncStorage` with a `DEFAULT_` constant, and on.

  ```text
  /skill:to-plan plans/decision-maps/unified-timer-contract/decisions/resolved/011-live-activity-visibility-toggle.md
  ```

- [pause semantics](clusters/pause-semantics.md), cluster of 2 decisions. It gained
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
  from the timer time editing cluster, which extends the counted-pause rule to feeding, pumping, and
  tummy time and supersedes the per-type split in
  [what pause means](decisions/resolved/006-pause-semantics.md). Read both, and read the superseded
  paragraphs in the older record rather than around them. One item of the older record's Required
  proof, a stop issued while paused on one device and finalized by another, went with the household
  timer control cut and is already struck in that record; the rest stands on its own.

  The edit-screen proof items in
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
  need the rebuilt form from
  [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md),
  so they belong to whichever of this cluster and timer time editing is planned second. The write-path
  change itself needs nothing from that form.

  ```text
  /skill:to-plan plans/decision-maps/unified-timer-contract/clusters/pause-semantics.md
  ```

- [shared timer seam](clusters/shared-timer-seam.md), cluster of 1 decision. Plan this before the
  timer behavior handles, meaning pause semantics and timer time editing, so both change the restore
  and record paths once instead of four times. It lands the shared lifecycle module as a
  restructuring that changes no behavior, and it does not reduce the start, pause, and resume paths,
  which stay outside the module. The statistics and Live Activity handles do not depend on it and can
  be planned in any order.

  Two of the three arguments that sized it have expired. It was sized partly to absorb the
  record-construction change the household work would have forced, and that work is cut rather than
  merely set aside, so no caller will ever need a record builder reachable from outside the context
  that started the timer. It was sized partly because the
  pause change reached eight arithmetic sites where sleep's two had to diverge.
  [Showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
  made those eight identical and took the duration rule out of the adapter, leaving six members. What
  still argues for it is the duplication itself: eight screens under timer time editing, six under
  interval overlap detection, and roughly 300 repeated restore lines per context. That is a
  maintainability case rather than a forcing one, so weigh it before planning.

  ```text
  /skill:to-plan plans/decision-maps/unified-timer-contract/clusters/shared-timer-seam.md
  ```

- [timer time editing](clusters/timer-time-editing.md), cluster of 2 decisions. It became complete when
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md)
  resolved into the write path and left for pause semantics, so the form is exactly what
  [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md)
  specifies with nothing added. Plan pause semantics first or alongside it: the invariant that a
  record's stored length equals its interval is what lets this form derive a length and write it back
  without qualification.

  [Running timer start time edit](decisions/resolved/007-running-timer-start-time-edit.md) was
  resolved while household timer control was live and is now reduced to the starter's own timer, with
  the dashboard card's read-only gate left as it is and no row policy change. Its **Scope cut**
  paragraph and its reduced Required proof carry that; the cluster file repeats it. The server trigger
  it adds on `active_timers.started_at` guards the same column as open task `0056`, which is unplanned
  and claims a migration number past the tree's head of `059`, so sequence or merge the two
  deliberately.

  ```text
  /skill:to-plan plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md
  ```

- [interval overlap detection for feeding, pumping, and tummy time](decisions/resolved/019-interval-overlap-non-sleep.md),
  standalone. Plan it after the timer time editing cluster, which rebuilds the same six screens, so
  the check is wired into their final shape once. It stands alone otherwise: the manual screens
  already derive an end from the duration they take today, so a breast feed and a tummy time carry an
  interval before that cluster lands.

  ```text
  /skill:to-plan plans/decision-maps/unified-timer-contract/decisions/resolved/019-interval-overlap-non-sleep.md
  ```

Forming:

- None. Every cluster is complete.

Planned:

- [average daily nap total](decisions/resolved/012-daily-nap-total-average.md) became Task 0064,
  `plans/tasks/0064-add-avg-nap-time-card.md`, on 2026-08-05. One task, no prerequisites: the
  `Avg Nap Time` card, its napping-day divisor in `calculateSleepSummary`, its
  `per napping day · 5 of 7` subtitle, and the nine locale strings. The divisor rule is now an
  architectural decision in `plans/master-plan.md`, so
  [per-nap-slot statistics](decisions/resolved/014-per-nap-slot-statistics.md) can cite it rather
  than restate it. The label collision between `Avg Nap Time` and the existing `Avg Nap Duration`
  stayed out of the task and remains fog in this map.
- [per-nap-slot statistics](decisions/resolved/014-per-nap-slot-statistics.md) became Task 0065,
  `plans/tasks/0065-add-nap-schedule-panel.md`, on 2026-08-05. One task, after Task 0064: the
  `Nap Schedule` panel below `Averages`, the per-slot accumulation inside the existing per-day loop in
  `calculateSleepSummary`, the two-part appearance test, the three-column row `AverageRow` does not
  provide, and the nine locale strings. It depends on 0064 for a shared-artifact reason rather than a
  logical one — both extend the `SleepSummary` contract and `calculateSleepSummary`, both add a
  section to `SummaryView`, and both add keys to the same `sleepPatterns` namespace across the same
  nine locale files. The chronological-slot rule and the appearance test are now an architectural
  decision in `plans/master-plan.md`. The slot-count upper bound stayed out of the task and remains
  fog in this map.

Retirable task-free records:

- [setting the real end time when stopping](decisions/resolved/008-stop-time-rewind.md) is retirable.
  Every decision that cites it is resolved:
  [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md),
  [the seam that keeps all four timers identical](decisions/resolved/010-shared-timer-seam.md), and
  [backfilling historical paused sleeps](decisions/resolved/017-paused-sleep-backfill.md).
  Retiring it would mean losing the record of why no surface takes a stop time, so keeping it is a
  reasonable call.
- [backfilling historical paused sleeps](decisions/resolved/017-paused-sleep-backfill.md) is
  retirable. All three decisions that cite it are resolved:
  [what pause means](decisions/resolved/006-pause-semantics.md),
  [setting the real end time when stopping](decisions/resolved/008-stop-time-rewind.md), and
  [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md).
  Retiring it would lose the reasoning behind a deliberate no, including the read-normalization
  alternative it names as the first thing to reach for if the answer ever changes, so keeping it is
  the safer call.
- [derived-data blast radius](decisions/resolved/003-sleep-derivation-blast-radius.md) became
  retirable this session. Its last open citation,
  [showing a record whose stored length disagrees with its interval](decisions/resolved/018-disagreeing-length-display.md),
  resolved, joining
  [what pause means](decisions/resolved/006-pause-semantics.md),
  [setting the real end time when stopping](decisions/resolved/008-stop-time-rewind.md),
  [entering and editing activities by clock time](decisions/resolved/009-clock-time-log-editing.md),
  and [backfilling historical paused sleeps](decisions/resolved/017-paused-sleep-backfill.md).
  Its two clock-splitting facts have been overtaken: every new record of all four types now satisfies
  `durationSeconds === endedAt - startedAt`, so the audit describes the legacy set alone. Its census of
  which surface reads which value is still the reference every one of those decisions leans on, and
  the fresher census sits in the newest citing record, so retiring it costs little. Keeping it costs
  little either.
