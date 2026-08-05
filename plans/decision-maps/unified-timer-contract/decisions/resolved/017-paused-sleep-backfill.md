# Decision: backfilling historical paused sleeps

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** none
**Cluster:** none
**Depends on:** [what pause means](006-pause-semantics.md)
**Claim:** none

## Question

Should sleep records written before the pause rule changed be corrected so their stored
`durationSeconds` equals their interval, and if so, by what mechanism?

## Context

[What pause means](006-pause-semantics.md) makes a new sleep record satisfy
`durationSeconds === endedAt - startedAt`, which is what every live sleep surface already assumes. It
deliberately leaves existing records alone.

A sleep paused under the old code therefore keeps a `durationSeconds` smaller than its interval, and
keeps reporting two different numbers: the interval on the Day view block, the week view, the summary,
the daily bars, the Timeline daily summary, and the prediction model, and the shorter stored duration
on the Timeline row label, the CSV export, the PDF report, the night-sleep achievement, and the edit
screen's prefill. This is the behavior those records have today, so nothing regresses, but the
inconsistency outlives the change that fixed it for new sleeps.

The correction is knowable without guesswork. For any sleep where `durationSeconds` is less than
`endedAt - startedAt`, the difference is the paused span, and the new rule says that span counts, so
the corrected value is the interval.

The open questions are whether the correction is worth making and where it would run. A migration
touches user data the app has already reported on. A client-side repair reaches only devices that
open the app. Doing nothing leaves a permanent seam in the history at the release boundary.

## Evidence

- The two consumer families and every call site are enumerated in
  [derived-data blast radius](003-sleep-derivation-blast-radius.md).
- No migration in the tree adds a check constraint on `duration_seconds`, and the validators in
  `src/validators/sleep.ts` check only that the end follows the start and that the duration falls
  between 0 and 86400 seconds, so a corrected value needs no validator change.
- Feeding, pumping, and tummy time keep subtracting a resumed pause, so their historical records stay
  correct under the new rule and are not in scope.
- Existing project decision: migrations are applied to local Supabase only.
- Nothing outside the app reads `duration_seconds`. No edge function, no migration, and no SQL
  statement touches the column. The night-sleep achievement runs in
  `src/services/achievement-detection.ts`, the CSV export in `src/utils/csv-generator.ts` line 165,
  and the PDF report in `src/utils/report-aggregator.ts`, all on the client. The stale value therefore
  never reaches a scheduled job, a push notification, or a server-side calculation.
- `sleep_sessions` stores `started_at`, `ended_at`, and `duration_seconds` as separate columns since
  `001_initial_schema.sql`, so a sleep's interval is available wherever its stored length is, on the
  client and in the database alike.
- Three places map a database row into a `StoredSleepEntry`: `transformSleepFromRemote` at
  `src/contexts/sleep-context.tsx` line 2029, `transformSleepFromDb` in
  `src/services/activity-sync-service.ts`, reached at line 987, and the local path in
  `src/services/sleep-storage.ts`.
- No migration in the tree backfills user rows. `059_morning_sleep_classification.sql` added two
  nullable columns and left every existing row NULL, and `052_crdt_field_clocks_and_merge.sql` states
  the position in its own comments: legacy rows lose to clocked writes, no backfill.
- `052_crdt_field_clocks_and_merge.sql` makes `sleep_sessions` a per-field last-write-wins CRDT and
  names `merge_record` the only sanctioned write path for synced records. A plain SQL `UPDATE` rewrites
  the column without bumping its clock, leaving that field at the epoch sentinel, so a later clocked
  write from a device holding the stale value beats the correction. The tie-break does not help
  either, because on an exact clock tie the greater canonical value wins, and canonical order is
  lexicographic JSON text rather than numeric.
- Pause and resume shipped in commit `1c43a55` on 2026-02-15, which is an ancestor of the newest
  release tag, so the affected window is bounded at roughly six months of records.
- `updateSleep` at `src/contexts/sleep-context.tsx` line 1529 takes a sparse `UpdateSleepInput` and
  writes only the fields its caller passes, rather than spreading the in-memory record, so a value
  derived at read time could not leak back into a write by accident.

## Resolution

- **Decision:** No. Sleep records written before the pause rule changed are left exactly as they are,
  in the data and on screen. No migration, no client-side repair pass, and no read-time normalization.
  [What pause means](006-pause-semantics.md) applies to records written after it ships and to nothing
  else.

  [Entering and editing activities by clock time](009-clock-time-log-editing.md) already delivers the
  only correction path. A caregiver who deliberately moves a saved sleep's start or end converges that
  one record on its interval, because they have just stated what the interval is. Nothing else touches
  an old record, and no surface is repointed away from the stored `duration_seconds`.

- **Rationale:** The defect is a display disagreement of a few minutes on records nobody is looking
  at. The owner judged the installed base small enough that no one will notice the seam, and that
  judgment decides this question. Every alternative below was weighed against it and lost.

  The disagreement is also self-limiting. It reaches only sleeps that were actually paused and
  resumed, only for the span of the pause, and only until a caregiver edits that record's times. Pause
  shipped in February, so the affected window closes at roughly six months of records once the new
  rule lands.

  Nothing outside the app reads `duration_seconds`, so the stale value stays confined to what six
  client-side readers display.

  The answer also matches the tree's own standing posture. No migration here has ever backfilled user
  rows, and the CRDT migration states the position outright: legacy rows lose to clocked writes, no
  backfill.

- **Alternatives rejected:**
  - *Normalize sleep length on read.* Derive `durationSeconds` as `endedAt - startedAt` at the three
    mapping boundaries, leaving the feeding, pumping, and tummy time mappers alone because their
    stored duration is authoritative under [what pause means](006-pause-semantics.md). This was the
    strongest alternative and is the one to reach for first if this decision is ever reopened. It
    writes no data, needs no migration, never touches the CRDT, reverts in one commit, and covers
    records written before the new rule, records that older installed builds keep writing until each
    user upgrades, and records on devices that never sync, all under a single rule. Its cost is three
    call sites plus `duration_seconds` becoming advisory for sleep, so a future SQL query or edge
    function would have to derive the length from the timestamps rather than trust the column.
    Rejected on the owner's judgment about who is looking, not because the mechanism is unsound.
  - *A client-side repair pass through the CRDT write path.* Scan on app open for sleeps whose stored
    duration is smaller than their interval and rewrite them through `merge_record` with a fresh
    clock. It is idempotent, because the predicate stops matching once a record is fixed, and it wins
    every later merge, because a real clock beats the epoch sentinel. Rejected because it destroys the
    paused span, which survives today only as the difference between the interval and the stored
    duration; because it never reaches a dormant device; and because it has to keep running for as
    long as an older build is still installed, which makes it something other than the one-time repair
    it appears to be.
  - *A SQL migration backfill.* One `UPDATE` over `sleep_sessions` setting the duration to the
    interval wherever it is smaller. It is the simplest to write and the hardest to trust. The
    statement bypasses `field_clocks` and leaves the column at the epoch sentinel, so a later clocked
    write from a device holding the stale value silently reverts it, and the canonical tie-break
    compares JSON text rather than numbers. This project also applies migrations to local Supabase
    only, so reaching production would be a manual act on live user data.
  - *Read normalization plus a repair on any write.* Take the read change and additionally persist the
    derived value whenever a sleep row is written for any reason. Rejected because it reopens a clause
    [entering and editing activities by clock time](009-clock-time-log-editing.md) settled
    deliberately: a save that touched only a note, a side, a volume, or a type leaves the stored length
    exactly as it was. Lengthening a record on a save the caregiver made to fix a typo is the behavior
    that decision refused, and the subtracted span cannot be recovered afterwards.

- **Consequences:**
  - A sleep paused under the old code keeps reporting two numbers: the interval on the Day view block,
    the week view, the summary, the daily bars, the Timeline daily summary, and the prediction model,
    and the shorter stored value on the Timeline row label, the CSV export, the PDF report, the
    night-sleep achievement, the widget's last-sleep readout at
    `src/contexts/widget-context.tsx` line 133, and the sleep totals at `src/utils/statistics.ts`
    lines 137 to 144. That is what those records show today, so nothing regresses.
  - The two-clock split named in
    [derived-data blast radius](003-sleep-derivation-blast-radius.md) closes for new sleeps and stays
    open for old ones. That audit's standing bar, every surface reporting the same number, is met
    going forward only.
  - This decision produces no tasks, which is why it is `Plannable: none`. It survives as a record for
    the same reason [setting the real end time when stopping](008-stop-time-rewind.md) does, because
    it is the only place that says why no backfill exists and which alternative is ready if the answer
    changes.
  - Because nothing was written, reversing this later costs three call sites and no data recovery.
  - `duration_seconds` is now advisory for sleep and authoritative for the other three types, and no
    code enforces that split. A future reader that assumes the column is trustworthy for sleep will be
    wrong on records written before the new rule.

- **Non-goals:** No migration, no repair pass, no read-time derivation, and no change to any of the
  six stored-duration readers. No schema change and no stored paused span. No change to what
  [entering and editing activities by clock time](009-clock-time-log-editing.md) writes on save or
  when. No change to feeding, pumping, or tummy time history, which stays correct under
  [what pause means](006-pause-semantics.md) because those types keep subtracting a resumed pause.

- **Required proof:** This decision creates no work, so it carries no proof obligation of its own.
  [Entering and editing activities by clock time](009-clock-time-log-editing.md) already requires the
  two tests that cover it. A sleep whose stored `durationSeconds` is smaller than its own interval
  opens in the edit form showing its real start and end rather than `start + duration`, and a save
  that touches only a note leaves `durationSeconds` and `endedAt` unchanged. Those two tests keep an
  old record from being corrupted in either direction, and nothing further is needed here.

## Follow-on

- **Newly sharp decisions:** None
- **Still-foggy areas:** None
