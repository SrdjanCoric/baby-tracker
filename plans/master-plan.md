# Plan: SofiBaby (baby-tracker)

> Source: talk-it-through session 2026-07-04 — CRDT-based conflict resolution for multi-caregiver sync

This is the project's master plan: a durable architectural header plus an ordered list of task
pointers. Each task is one feature on its own branch, ending in a PR. Task bodies live in
`plans/tasks/`; finished tasks move to `plans/tasks/done/`.

## Workflow

- New work is added by the `to-plan` skill: a self-contained task file under
  `plans/tasks/NNNN-<slug>.md` plus a pointer below. It appends; it never creates a second plan.
- `implement-next-task` takes the first eligible pointer (or an explicit task argument), builds it
  on its branch — AFK via `tdd`, `[decision]` via `talk-it-through`, `[verify]` paused for manual
  confirmation — runs `task-review`, then opens the PR after approval and flips the pointer to `[>]`.
- A pointer has five states: `[ ]` todo · `[-]` deferred and not claimable · `[~]` in progress
  (claimed) · `[>]` done, PR open, awaiting merge · `[x]` merged to `main`. `sync-main` flips
  `[>]→[x]` and moves the task file to `tasks/done/` once the PR merges.
- Pointers carry their direct prerequisites as an `(after NNNN, …)` suffix (none = no suffix). A
  task is selectable only once every ordinal in its `(after …)` list is **`[x]` (merged)** — so a
  dependent never branches off `main` before its prerequisite is actually on `main`.
  `implement-next-task --worktree` uses this to pick the first task not blocked by in-progress work,
  or reports "no independent task" when every remaining task is blocked.
- Documentation-only changes (planning batches, briefs, task files, edits to this plan, README/docs
  updates, task closeouts) skip the PR/CI/`sync-main` flow entirely: commit directly to `main` with
  `[skip ci]` and push. PRs, CI, and `sync-main` are for code changes only.

## Architectural decisions

Durable decisions that apply across all tasks:

- **Existing sync architecture (unchanged)**: local-first — AsyncStorage per baby, then push to
  Supabase; Supabase Realtime row events for live updates between household members with device-ID
  echo filtering; persistent offline queue with retry; contexts receive remote changes as
  `REMOTE_INSERT`/`REMOTE_UPDATE`/`REMOTE_DELETE` actions. On foreground resume: flush queue before
  pulling server data.
- **Conflict resolution: hand-rolled LWW-Map CRDT** — per-field last-write-wins registers over the
  existing flat Postgres rows. No CRDT library, no PowerSync (both removed). The transport is
  untouched; only the merge decision changes.
- **Clocks: hybrid logical clocks (HLC)** — sortable string `"<ISO-8601 UTC ms>-<counter, 4-digit
zero-padded>-<deviceId>"`, e.g. `2026-07-04T12:00:00.000Z-0003-a1b2c3`. Winner = greater string
  (plain lexicographic compare). HLC ticks lazily on local mutations and on receipt of remote
  clocks only; persisted so it survives restarts. Per-field clocks are sync metadata only —
  user-facing timestamps (startTime, updatedAt, …) are unaffected.
- **Wear OS companion app (2026-08-20)**: native Kotlin/Compose Wear OS 4+ module inside the Expo
  Android build; full Apple Watch feature parity. Reads via the existing
  `get_baby_activity_snapshot` RPC; writes go direct from watch to Supabase under RLS (no
  phone-relay channel) and must carry valid HLC `field_clocks` with a watch device ID. Wearable
  Data Layer carries session handoff, phone-refresh requests, and invalidation only, never activity
  data. Authentication matches the supported Apple Watch behavior: the phone owns Supabase token
  refresh and republishes a fresh short-lived access token; the watch never receives or redeems a
  refresh token and shows a reconnect-from-phone state when its access token is stale. No offline
  write queue in v1; Tizen permanently out of scope. Decision record:
  `plans/wear-os-watch-parity.md`, superseded for token ownership by Task 0090's design.
- **Wear OS integration validation (2026-08-21)**: Tasks 0090–0097 close on automated seam tests,
  Android builds, and CI only. Do not pause those tasks for paired phone↔watch synchronization
  checks. Task 0098 owns one consolidated end-to-end matrix covering session handoff, summaries,
  every activity flow, shared timers, invalidation, refresh recovery, and the complication after
  all Wear features are present.
- **Schema shape**: each synced table gets `field_clocks JSONB NOT NULL DEFAULT '{}'` (map of
  column name → HLC string) and `deleted BOOLEAN NOT NULL DEFAULT FALSE`, plus a partial index
  `WHERE deleted = false`. Empty/missing clock entries compare as epoch — legacy rows lose to any
  clocked write; no backfill.
- **Server-side merge: a single Postgres RPC** (`merge_record`-style, table name as parameter) is
  the only write path for synced records — reads the existing row's clocks under row lock, keeps
  the winning value per field, writes the merged row. Replaces raw insert/update/upsert everywhere
  (app sync engine, edge functions, widget REST writes).
- **Client-side merge**: one pure TypeScript module in the sync layer (`src/services/sync/crdt.ts`)
  owns HLC + stamping + merge. Incoming Realtime events are merged against local state before
  dispatch. The TS merge and the SQL RPC are twin implementations of the same semantics; a shared
  JSON test-vector file is run against both, and divergence between them is the project's #1
  correctness risk.
- **Deletes: tombstones** — `deleted` is an ordinary LWW field (no special cases in merge).
  Delete = field write `deleted: true`; un-delete is possible. Every read path filters
  `deleted = false`.
- **Milestone responses keep one logical identity across state cycling**: `(baby_id, milestone_id)`
  identifies one response. Clearing writes a tombstone while internal sync state retains the
  canonical row ID; rechecking revives that row with a newer `deleted = false` clock. Pull and
  Realtime retain this identity. Upgrade recovery reconciles an alternate pending ID to the
  canonical row while the UI continues to hide tombstones.
- **CRDT scope (9 tables)**: feedings, sleep_sessions, diapers, pumping_sessions,
  growth_measurements, tummy_time_sessions, health_entries, milestones, babies. Explicitly
  excluded: active_timers (keeps its stronger atomic lock RPC), households/members (role-based
  RPCs), push tokens / goals / settings (no concurrent-edit problem).
- **Mixed-version rollout**: no force-update gate. Old clients degrade to today's row-level
  clobber behavior, never worse (their writes carry no clocks and lose to clocked writes). The
  window closes as households update.
- **Testing bar for merge logic**: fast-check property tests (commutativity, associativity,
  idempotence, HLC monotonicity), shared TS/SQL test vectors, multi-replica convergence
  simulation. No new E2E for conflicts.
- **External timer commands are durable and idempotent**: widget, Live Activity, Watch, routed,
  and in-app stop commands are consumed only after the matching timer is available or the command is
  proven stale. A server lock released by an external stop does not invalidate the local timer data
  needed to finalize exactly one activity entry.
- **Valid sync work is never discarded after transient failure**: authenticated activity writes use
  the persistent sync queue, remain protected in local merge results until server acknowledgement,
  and stay retryable across restarts. Quarantine is reserved for structurally invalid operations.
- **In-app timer completion converges on one durable result**: every timer instance keeps a stable
  completion identity and first accepted stop time. Once completion is durable locally, the provider
  becomes stopped before remote lock or Live Activity cleanup. A cleanup retry or stale UI Stop reuses
  the existing completion and cannot create another household activity.
- **Household timer release testing uses one representative sleep smoke**: two iOS simulators and
  separate caregiver accounts exercise sleep ownership, lock rejection, unlock propagation, and
  handoff against local Supabase. Shared feeding, pumping, and tummy-time behavior is proved through
  component and real-provider tests. Fast behavioral runs are separate from clean native provisioning;
  neither path uses production credentials or production data.
- **Production database state is a human release checkpoint**: agents apply and verify migrations only
  on local Supabase. The owner performs the documented read-only production migration check before a
  store release.
- **Post-release regression discovery is evidence-first and production-read-only**: a runtime-selected
  account may be exported through an enforced read-only production session into ignored, anonymized,
  isolated local fixtures for the July 5 deployed source and current source. Every post-July changed
  capability is audited before fixes begin; each potential regression receives an individual owner
  disposition, and each confirmed bug gets its own approved task dependent on the completed audit.
- **Bug PRs prove the reported behavior narrowly; deployment proves the complete product**: every bug
  fix keeps the smallest permanent automated regression test at the lowest reliable seam and runs only
  the focused device/E2E scenario needed for that boundary. PRs retain complete non-device CI, but do
  not rerun the broad E2E suites. Comprehensive onboarding, activity, household, multi-device, and
  platform E2E remain maintained and run as the pre-deployment release gate.
- **Ambiguous morning sleep is confirmed by a caregiver**: predictions keep the configured
  day-start-minus-3h03 anchor. After a completed overnight sleep establishes a real wake, a return to
  sleep within the caregiver's inclusive continuation allowance is night continuation. A later
  pre-day-start sleep requires a nonblocking First nap or Back to sleep answer before predictions or
  training continue. The answer synchronizes as the visible Nap/Night type and remains editable.
  Legacy rows keep Task 0027 behavior without backfill or retroactive prompts, and sleeps starting at
  or after day start remain naps.
- **Earlier-morning drift is conservative and first-window-only**: suggest, but never automatically
  apply, the median earlier final wake only when at least five of the last seven recorded mornings are
  at least one hour early and their first nap follows the age-appropriate first wake window within a
  15-minute tolerance. Later wake windows and bedtime are unaffected.
- **Manual sleep overlap is permitted with informed confirmation**: warn with Cancel and Continue
  anyway, preserve both raw records when continued, and use interval union for predictions and
  statistics so overlap is neither double-counted nor allowed to shorten sleep.
- **Historical activity loading is demand-driven and range-aware**: startup remains bounded to recent
  data; Timeline, Statistics, and Sleep Patterns request the exact intervals they display and page
  through every matching server row. Range reconciliation preserves queued mutations, tombstones,
  previously loaded intervals, and user/baby storage scope while distinguishing unverified, failed,
  verified-empty, and loaded ranges.
- **Onboarding is role-based and activation-focused**: Welcome offers Start tracking, Join a family,
  and Sign in with an immediately applied language selector. New owners may remain guests, must create
  a complete baby profile before Home, and may then skip caregiver invitation and the first real
  activity. Joined and returning caregivers restore household babies and bypass the first-activity
  prompt. Generic feature, preference, permission, and pagination screens are excluded.
- **Onboarding state is versioned, named, and resumable**: persist the selected path and unfinished
  draft across restart and auth return instead of a numeric step. Legacy completed or skipped records
  remain completed, and development-only preview and replay tools never require a remote flag.
- **Caregiver invitations are email-bound before sharing**: owners create single-use, seven-day
  invitations for a normalized caregiver email and manually share the readable code. Redemption
  requires the matching verified account and explicit confirmation. Existing memberships remain
  intact, and the legacy join RPC signature accepts new invitations for older recipient clients. The
  migration starts in legacy-compatible mode; the release owner enables email enforcement after the
  new app version is deployed. Verified HTTPS links and website deployment are deferred.
- **Nap statistics are averaged over napping days**: a nap metric expressed per day divides by the
  days in the selected range holding at least one nap, not by days with any sleep and not by calendar
  days. Night-only and empty days are excluded from both the numerator and the divisor. Because the
  sleep summary screen then carries more than one divisor, any such card states its own divisor in
  the form `per napping day · 5 of 7`. Existing metrics keep their current divisors: `Avg Total
Sleep`, `Avg Night Sleep`, and `Avg Naps/Day` divide by days with any sleep, and `Avg Nap Duration`
  divides by nap count.
- **One shared timer lifecycle module with a per-type adapter**: feeding, sleep, pumping, and tummy
  time run one implementation of the timer restore sequence — obsolescence guards, pending-stop read
  and match, identity resolution and backfill, the completion-secured short circuit, lock
  reconciliation and its persisted state, the lock-conflict path, server-only lock hydration, and the
  Live Activity restart with its `effectiveStartTime` pause arithmetic. Each type registers an adapter
  supplying only the activity-type literal, the storage service, the `timer_data` codec,
  `buildRecord(startedAt, endedAt, payload)`, the Live Activity detail argument and type literal, and
  the `RESTORE_TIMER` dispatch. The duration rule is module-owned, not an adapter member. Record
  construction is adapter-owned and every path that writes an activity record calls it, the local stop
  included, so each type has one record definition rather than two. The contexts keep their reducers,
  entries lists, non-timer surfaces, and public start, stop, pause, and resume APIs; the start, pause,
  and resume paths stay outside the module. `timer_data` stays `Record<string, unknown>` on the wire.
  The extraction changes no behavior and is proved by
  `src/__tests__/external-timer-stop-providers.integration.test.tsx` passing with no edit.
- **A resumed pause counts and an open pause bills nothing**: on feeding, sleep, pumping, and tummy
  time alike, a paused span the caregiver returned from counts as elapsed time, so every record
  written from a timer satisfies `durationSeconds === endedAt - startedAt`, and every running-timer
  readout shows what stopping at that instant would record — frozen at `pausedAt` while a pause is
  open, counting the span after a resume, with the start never shifted forward. Stopping a paused
  timer ends the record at `pausedAt` on every surface that can issue a stop, which is what makes
  counting safe. No schema change, no stored pause span, no backfill: records written before the rule
  keep their disagreement permanently. The widget and the Watch keep sending `pauseDurationMs` and
  `accumulatedSeconds` and neither native target changes; `toggle_timer_pause` keeps its signature,
  its meaning, and its owner-only guard. The cost taken deliberately is that tummy time and pumping
  summed minutes now carry resumed pause spans while their record counts do not move.
- **Nap slots are chronological and earn their row twice over**: a nap slot is the nth nap started
  within a sleep-day, counted forward from the start of the day, so a skipped nap shifts every later
  nap of that day up a slot. Each slot's averages divide by that slot's own occurrence count, never
  by napping days and never by the range length, and each row states that count. A slot renders only
  when it occurred at least 3 times **and** on at least 30% of the napping days in the range, both
  bounds inclusive; when no slot clears both tests the panel does not render at all. Nothing caps the
  number of slots.
- **A running timer's start belongs to its starter and never leaves the cleanup horizon**: only the
  caregiver who started a timer may move its `started_at`, in place on the activity screen, to a value
  between twelve hours ago and now, floored further at the previous saved same-type activity's end. The
  bound matches `cleanup_stale_timer_locks`, so a rewound start can never make a live lock eligible for
  deletion, and it governs "Started earlier" identically. The range is shown as the picker's own bounds
  on both platforms rather than clamped after the fact. The write is a direct `UPDATE` on
  `active_timers.started_at` under a database trigger that fires only when that column changes, because
  offline replay writes allowlisted tables generically and would bypass an RPC. The row policy stays
  `USING (started_by = auth.uid())`, the dashboard card keeps its read-only gate, and no policy widens.
- **Hand-entered activities are clock times with a derived length**: both the manual add and the saved-
  record edit paths take a start time and an end time for every type that has a duration — sleep,
  breastfeeding, pumping, and tummy time — with duration a read-only readout and no minutes field or
  quick-duration chips. A bottle feed and a solids entry stay moment records. Every bound is shown as
  the picker's own range and restates a validator already shipped rather than introducing a number: no
  future value, no floor in time, an end at least a minute after its start, and the per-type caps of
  24h sleep, 2h feeding, 1h pumping, and 2h tummy time. The stored `durationSeconds` is rewritten as
  `end - start` only when a caregiver actually moved a time, so a note-only save never silently changes
  a legacy record's length. Saved records keep the master plan's warn-and-allow overlap policy while the
  running-timer clamp above does not follow the record, so the app holds two overlap rules on purpose.
- **Widget and Watch refresh one coherent selected-baby activity summary**: an authenticated,
  read-only, versioned server snapshot returns only the current fields those native surfaces display —
  baby identity, active timers, latest relevant facts, current-day aggregates, applicable goals and
  wake-window state — never histories or multiple babies. A successful refresh replaces the complete
  per-baby base; the only merge a client may perform into a server response is preserving
  locally-known timers the server cannot know about — an accountless or offline-started timer
  (no server row), or a just-written timer in the write-then-refresh race guarded by an app-stamped
  freshness value (`localAsOf`) newer than the response's `serverAsOf`. Server-owned removals still
  apply to those timers once the server knows about them. Two explicitly App-Group-authored local
  presentation fields are also preserved from the prior cache: the device's `timeFormat` and the
  app-calculated `sleepPrediction`; the response supplies either field only when no local value
  exists. All other non-timer fields (totals, last times, wake windows) keep coming wholesale from
  the response. Widget fetches on its
  existing timer-change push, action, and scheduled timeline opportunities without short polling.
  Watch keeps its 30-second selected-baby timer probe only while a timer appears active and fetches the
  complete summary only when that fingerprint changes or another explicit full-refresh trigger occurs.
  Failures preserve the prior coherent base, Watch optimism stays a separate correlated overlay, and
  the additive rollout keeps old binaries and unversioned caches readable. Immediate delivery to a
  suspended Watch, raw activity history, all-baby snapshots, and new push triggers for every manual
  activity edit remain out of scope.

---

## Tasks

- [x] 0001 · Remove dead sync code (ConflictResolver + PowerSync) → tasks/done/0001-remove-dead-sync-code.md
- [x] 0002 · CRDT core: HLC + LWW-Map merge module (after 0001) → tasks/done/0002-crdt-core-module.md
- [x] 0003 · Server-side merge: migration + merge RPC (after 0002) → tasks/done/0003-crdt-server-merge.md
- [x] 0004 · Wire the sync engine to the CRDT merge (after 0002, 0003) → tasks/done/0004-crdt-sync-wiring.md
- [x] 0005 · Tombstone deletes + read-path audit (after 0004) → tasks/done/0005-crdt-tombstone-deletes.md
- [x] 0006 · Make external timer stops durable → tasks/done/0006-make-external-timer-stops-durable.md
- [x] 0007 · Make authenticated activity sync lossless (after 0006) → tasks/done/0007-make-sync-queue-lossless.md
- [x] 0008 · Target Watch actions to the requested baby (after 0006) → tasks/done/0008-target-watch-actions-to-the-requested-baby.md
- [x] 0009 · Fix stale preference-driven UI and exports → tasks/done/0009-fix-stale-preference-driven-ui.md
- [x] 0010 · Enforce a warning-free production quality gate (after 0006, 0007, 0008, 0009) → tasks/done/0010-enforce-warning-free-production-quality-gate.md
- [x] 0011 · Make activity queue acknowledgement durable → tasks/done/0011-make-activity-queue-acknowledgement-durable.md
- [x] 0012 · Keep Watch baby selection storage-consistent → tasks/done/0012-keep-watch-baby-selection-storage-consistent.md
- [x] 0013 · Test external timer stops through real providers → tasks/done/0013-test-external-timer-stops-through-real-providers.md
- [x] 0014 · Make in-app timer completion idempotent → tasks/done/0014-make-in-app-timer-completion-idempotent.md
- [x] 0015 · Show dashboard timer-stop progress (after 0014) → tasks/done/0015-show-dashboard-timer-stop-progress.md
- [x] 0016 · Deduplicate activity acknowledgements (after 0014) → tasks/done/0016-deduplicate-activity-acknowledgements.md
- [x] 0017 · Build a maintainable two-account iOS sleep-timer smoke suite (after 0014, 0015, 0016) → tasks/done/0017-build-two-account-ios-household-timer-suite.md
- [x] 0018 · Authorize active-timer controls (after 0017) → tasks/done/0018-authorize-active-timer-controls.md
- [x] 0019 · Preserve offline-started timers (after 0017, 0018) → tasks/done/0019-preserve-offline-started-timers.md
- [x] 0020 · Queue multiple external timer commands (after 0014, 0017) → tasks/done/0020-queue-multiple-external-timer-commands.md
- [x] 0021 · Serialize activity pulls and local mutations (after 0017) → tasks/done/0021-serialize-activity-pulls-and-local-mutations.md
- [x] 0022 · Run complete non-device checks in pull-request CI (after 0017) → tasks/done/0022-run-complete-pr-ci.md
- [x] 0023 · Make the iOS E2E release gate reliable (after 0017, 0022) → tasks/done/0023-make-ios-e2e-workflow-reliable.md
- [x] 0024 · Correct release versioning and traceability (after 0022, 0023) → tasks/done/0024-correct-release-versioning-and-traceability.md
- [x] 0025 · Remediate dependency vulnerabilities (after 0022) → tasks/done/0025-remediate-dependency-vulnerabilities.md
- [x] 0027 · Resolve fragmented morning sleep for predictions → tasks/done/0027-resolve-fragmented-morning-sleep.md
- [x] 0026 · Repair the production iOS date-picker module provider (after 0017) → tasks/done/0026-repair-ios-date-picker-module-provider.md
- [x] 0030 · Revive cleared milestone responses (after 0005, 0007, 0021) → tasks/done/0030-revive-cleared-milestone-responses.md
- [x] 0028 · Detect age-aware earlier morning drift (after 0027) → tasks/done/0028-detect-age-aware-morning-drift.md
- [x] 0029 · Warn and safely calculate overlapping manual sleep (after 0028) → tasks/done/0029-warn-and-union-overlapping-manual-sleep.md
- [x] 0031 · Load historical activity ranges on demand in Timeline (after 0007, 0021) → tasks/done/0031-load-historical-activity-ranges-in-timeline.md
- [x] 0032 · Load requested ranges before calculating statistics (after 0031) → tasks/done/0032-load-requested-statistics-ranges.md
- [x] 0033 · Prevent duplicate bedtime predictions after evening night sleep → tasks/done/0033-prevent-duplicate-bedtime-predictions.md
- [x] 0034 · Require complete profiles for new babies → tasks/done/0034-require-complete-new-baby-profiles.md
- [x] 0035 · Create email-bound caregiver invitations → tasks/done/0035-share-verified-caregiver-invitation-links.md
- [x] 0036 · Build the resumable new-owner onboarding path (after 0034) → tasks/done/0036-build-resumable-new-owner-onboarding.md
- [x] 0037 · Add optional account creation and caregiver invitation (after 0035, 0036) → tasks/done/0037-add-onboarding-caregiver-invitation.md
- [x] 0038 · Add code-first invited-caregiver onboarding (after 0037) → tasks/done/0038-add-code-first-caregiver-join-onboarding.md
- [x] 0039 · Restore returning users before opening Home (after 0038) → tasks/done/0039-restore-returning-users-before-home.md
- [x] 0040 · Add development onboarding tools (after 0039) → tasks/done/0040-add-development-onboarding-tools.md
- [x] 0041 · Cut over to role-based onboarding (after 0040) → tasks/done/0041-cut-over-to-role-based-onboarding.md
- [x] 0042 · Confirm ambiguous morning sleep (after 0028) → tasks/done/0042-confirm-ambiguous-morning-sleep.md
- [x] 0043 · Respect the selected time format when starting timers earlier → tasks/done/0043-respect-timer-start-time-format.md
- [x] 0044 · Match onboarding to the current app UI (after 0041) → tasks/done/0044-match-onboarding-current-app-ui.md
- [x] 0045 · Prove onboarding recovery after network failure (after 0044) → tasks/done/0045-prove-onboarding-network-recovery.md
- [x] 0047 · Discover and confirm all post-July 5 regressions before fixes → tasks/done/0047-discover-post-july-regressions.md
- [x] 0048 · Attribute feeding stop, Timeline, and Live Activity regressions (after 0047) → tasks/done/0048-attribute-feeding-stop-regressions.md
- [-] 0049 · Attribute Watch timer and history regressions (deferred by owner; after 0047) → tasks/0049-attribute-watch-regressions.md
- [x] 0050 · Fix incomplete-day and fragmented-night sleep summaries (after 0047) → tasks/done/0050-fix-sleep-summary-averages.md
- [x] 0051 · Sweep adjacent app regressions introduced after July 5 (after 0047, 0048, 0050) → tasks/done/0051-sweep-post-release-app-regressions.md
- [-] 0052 · Sweep adjacent native and sync regressions introduced after July 5 (audit ran 2026-08-01; output withheld from the repository by owner decision; after 0051) → tasks/0052-sweep-post-release-native-sync-regressions.md
- [x] 0053 · Include the full selected range in exports and reports (after 0051) → tasks/done/0053-resolve-export-report-ranges.md
- [-] 0054 · Restrict the wake-window reminder RPC to the service role (deferred by owner 2026-08-04) → tasks/0054-restrict-wake-window-reminder-rpc.md
- [-] 0055 · Prevent self-assignment of household and owner role (deferred by owner 2026-08-04; after 0054) → tasks/0055-prevent-household-and-owner-self-assignment.md
- [-] 0057 · Bind Live Activity identity to the timer, not the activity type (deferred by owner 2026-08-04) → tasks/0057-bind-live-activity-to-timer-identity.md
- [-] 0058 · Recover a queued activity write that the server denies (deferred by owner 2026-08-04) → tasks/0058-recover-denied-queued-activity-writes.md
- [-] 0059 · Cover WatchConnectivity delivery failures (deferred by owner 2026-08-04) → tasks/0059-cover-watchconnectivity-delivery-failures.md
- [-] 0060 · Resolve the Portuguese (Portugal) solid-food label (deferred by owner 2026-08-04) → tasks/0060-resolve-pt-pt-solid-food-label.md
- [x] 0061 · Localize the Apple Watch app and the iOS widget → tasks/done/0061-localize-watch-and-widget.md
- [x] 0062 · Fix the Timeline daily sleep total → tasks/done/0062-fix-timeline-daily-sleep-total.md
- [x] 0063 · Guarantee an exit from an activity screen opened by the widget → tasks/done/0063-guarantee-exit-from-widget-opened-activity-screens.md
- [x] 0064 · Add the Avg Nap Time card → tasks/done/0064-add-avg-nap-time-card.md
- [x] 0065 · Add the Nap Schedule panel (after 0064) → tasks/done/0065-add-nap-schedule-panel.md
- [x] 0066 · Extract the shared timer lifecycle module and migrate tummy time → tasks/done/0066-extract-shared-timer-lifecycle-tummy-time.md
- [x] 0067 · Migrate pumping, feeding, and sleep onto the shared timer lifecycle (after 0066) → tasks/done/0067-migrate-remaining-timers-to-shared-lifecycle.md
- [x] 0068 · Count a resumed pause and end a stopped paused timer at `pausedAt` (after 0067) → tasks/done/0068-count-resumed-pause-in-recorded-activity.md
- [x] 0069 · Show what stopping would record on every running-timer surface (after 0068) → tasks/done/0069-show-counted-pause-on-running-timer-surfaces.md
- [x] 0070 · Guard `active_timers.started_at` against out-of-horizon writes → tasks/done/0070-guard-active-timer-start-bounds.md
- [x] 0071 · Edit a running timer's start time in place (after 0069, 0070) → tasks/done/0071-edit-running-timer-start-time.md
- [x] 0072 · Log and edit a sleep by clock time (after 0068) → tasks/done/0072-log-and-edit-sleep-by-clock-time.md
- [x] 0073 · Log and edit a feeding by clock time (after 0072) → tasks/done/0073-log-and-edit-feeding-by-clock-time.md
- [x] 0074 · Edit a running timer's start time without an account → tasks/done/0074-edit-running-timer-start-without-account.md
- [x] 0075 · Log and edit pumping and tummy time by clock time (after 0072, 0074) → tasks/done/0075-log-and-edit-pumping-and-tummy-time-by-clock-time.md
- [x] 0076 · Warn on an overlapping feeding, pumping session, or tummy time (after 0073, 0075) → tasks/done/0076-warn-on-overlapping-non-sleep-records.md
- [x] 0077 · Refresh the iOS Widget from a coherent activity summary → tasks/done/0077-refresh-widget-from-native-activity-summary.md
- [x] 0078 · Refresh Apple Watch summaries after timer changes (after 0077) → tasks/done/0078-refresh-watch-summaries-after-timer-changes.md
- [x] 0079 · Cap automatic rating prompts to three per rolling year and add a Rate App entry point → tasks/done/0079-improve-rating-prompts-and-rate-app-entry.md
- [x] 0081 · Show widget data without an account or sign-in → tasks/done/0081-show-widget-data-without-account.md
- [x] 0082 · Preserve locally-known timers across widget server refreshes (after 0081) → tasks/done/0082-preserve-local-timers-across-widget-refreshes.md
- [x] 0083 · Widget renews its Supabase credential via a shared App Group session (after 0082) → tasks/done/0083-renew-widget-credentials-via-shared-session.md
- [x] 0084 · Watch renews its Supabase credential from the shared session (after 0083) → tasks/done/0084-renew-watch-credentials-from-shared-session.md
- [x] 0085 · Preserve locally-known timers across Watch summary refreshes (after 0082, 0084) → tasks/done/0085-preserve-local-timers-across-watch-refreshes.md
- [x] 0086 · Cut redundant client sync traffic → tasks/done/0086-cut-redundant-client-sync-traffic.md
- [ ] 0087 · Fully terminate deleted accounts → tasks/0087-fully-terminate-deleted-accounts.md
- [ ] 0088 · Release the App Group flock across suspension (0xDEAD10CC) → tasks/0088-release-app-group-flock-across-suspension.md
- [x] 0089 · Wear OS app scaffold and build integration → tasks/done/0089-wear-os-app-scaffold.md
- [x] 0090 · Wear session handoff with phone-owned refresh (after 0089) → tasks/done/0090-wear-session-handoff-and-refresh.md
- [x] 0091 · Wear today summary read path (after 0090) → tasks/done/0091-wear-today-summary-read-path.md
- [ ] 0092 · Wear diaper quick log (after 0091) → tasks/0092-wear-diaper-quick-log.md
- [ ] 0093 · Wear feeding timer and logging (after 0092) → tasks/0093-wear-feeding-timer-and-logging.md
- [ ] 0094 · Wear sleep timer and logging (after 0093) → tasks/0094-wear-sleep-timer-and-logging.md
- [ ] 0095 · Wear pumping logging (after 0094) → tasks/0095-wear-pumping-logging.md
- [ ] 0096 · Wear tummy time logging (after 0095) → tasks/0096-wear-tummy-time-logging.md
- [ ] 0097 · Wear launcher complication (after 0089) → tasks/0097-wear-launcher-complication.md
- [ ] 0098 · Wear hardware verification and store listing floor (after 0093, 0094, 0095, 0096, 0097) → tasks/0098-wear-hardware-verification-and-listing.md

## Workflow status

Tasks 0001 through 0045 and Tasks 0047, 0048, and 0050 are closed. Task 0049 is deferred by the release owner and must not be claimed without an explicit owner decision. On 2026-08-01 the owner removed 0049 from Task 0051's prerequisites, because 0051 audits TypeScript/React Native product surfaces while Watch native synchronization already falls inside Task 0052's scope. Task 0052 never listed 0049 as a prerequisite; its implementation work no longer consumes 0049 evidence and instead audits Watch boundaries directly, recording the missing attribution trace as a stated limitation. No remaining task depends on 0049. Tasks 0051 and 0052 complete the adjacent application, native, and sync sweeps. Repository-guideline evidence is recorded in completed task files and in `plans/repository-guidelines-assessment.md`.

On 2026-08-04 the owner deferred Tasks 0054 through 0060 so that Task 0063 takes priority. Task 0063 fixes a trap the owner hit in real usage: opening an activity screen from the iOS widget on a cold launch leaves the caregiver unable to return to the app, which makes the app unusable until it is force-quit. Those deferred tasks keep their existing dependency suffixes and are not claimable without an explicit owner decision; none of them is a prerequisite of 0063. Task 0063 is therefore the only claimable pointer. A separate widget defect found the same day — the configuration intent's activity parameter resolving to nil, so the widget always renders Feeding regardless of the Edit Widget selection — is still under diagnosis and is deliberately outside Task 0063's scope.

Tasks 0063 and 0064 merged on 2026-08-05. Tasks 0049 and 0052 through 0060 remain deferred and are
not claimable without an explicit owner decision.

Task 0065 was added on 2026-08-05 from the resolved decision
`plans/decision-maps/unified-timer-contract/decisions/resolved/014-per-nap-slot-statistics.md`, which
depends on the decision behind Task 0064. It depends on 0064 because both tasks extend the
`SleepSummary` contract and `calculateSleepSummary` in `src/utils/sleep-patterns.ts`, both add a
section to `SummaryView`, and both add keys to the `sleepPatterns` namespace across the same nine
locale files. Task 0064 has merged, so Task 0065 is claimable.

Tasks 0066 and 0067 were added on 2026-08-05 from the shared timer seam cluster,
`plans/decision-maps/unified-timer-contract/clusters/shared-timer-seam.md`, and its single member
decision `decisions/resolved/010-shared-timer-seam.md`. Both forcing arguments behind that decision
have expired — the household timer control cut retired the remote record builder, and decision `018`
made the eight duration sites identical — so the extraction is a maintainability case the owner chose
to plan anyway. The ordinal `0066` was previously used by a Live Activity toggle task removed in PR
#212 and is reused here by the owner's decision. Task 0066 builds the module and migrates tummy time
in one pass; Task 0067 migrates pumping, feeding, and sleep in that order and carries the two-account
sleep smoke as a manual `[verify]` checkpoint. Plan the shared seam before the pause-semantics and
timer-time-editing clusters, so those land in the module once instead of in four contexts.

Tasks 0068 and 0069 were added on 2026-08-05 from the pause-semantics cluster,
`plans/decision-maps/unified-timer-contract/clusters/pause-semantics.md`, and its two member
decisions `decisions/resolved/006-pause-semantics.md` and
`decisions/resolved/018-disagreeing-length-display.md`, the second of which supersedes the first's
per-type split. Task 0068 changes what gets written — the counted-pause duration and the stop-at-
`pausedAt` truncation, which are one rule and cannot be split — and Task 0069 brings every running
readout in line with it. Both depend on the shared timer seam so the duration rule, the record
construction, and the Live Activity restart arithmetic each change in one module rather than in four
contexts; 0068 therefore waits on 0067. The timer-time-editing cluster is still unplanned, so the
edit-screen proof items in decision `018` belong to that cluster and are deliberately absent from both
tasks, as that cluster's Scope directs.

Tasks 0070, 0071, 0072, 0073, and 0075 were added on 2026-08-05 from the timer-time-editing cluster,
`plans/decision-maps/unified-timer-contract/clusters/timer-time-editing.md`, and its two member
decisions `decisions/resolved/007-running-timer-start-time-edit.md` and
`decisions/resolved/009-clock-time-log-editing.md`. The cluster splits cleanly in two, and the two
halves are independent of each other: Tasks 0070 and 0071 change a running timer's anchor on
`app/*/index.tsx` and in the database, while Tasks 0072, 0073, and 0075 change the eight hand-entry
screens under `app/*/manual.tsx` and `app/edit/`. Their two bound rule sets differ deliberately — the
running-timer clamp puts overlap out of reach, and saved records warn and allow — so they share no
artifact and neither depends on the other.

Task 0070 is the server guard alone and is claimable immediately: it takes migration `060` against a
tree whose head is `059`. The owner removed Task 0056 on 2026-08-05 in its favor, because the trigger
0070 adds rejects exactly the future-`started_at` write 0056 was written for, and 0056's own finding
recorded that row-level security already blocks `started_by` reassignment. Nothing depended on 0056 and
its file is deleted. Task 0071 then adds the client edit and waits on 0070 so the picker never offers a
value the database rejects, and on 0069 so the Live Activity anchor arithmetic changes in the shared
module once rather than being written and then rewritten.

Tasks 0072, 0073, and 0075 depend on 0068 for the invariant `durationSeconds === endedAt - startedAt`,
which is what lets the form derive a length and write it back without qualification, and they carry the
edit-screen proof items from `decisions/resolved/018-disagreeing-length-display.md` that the pause-
semantics batch deliberately left to this cluster. Task 0072 does sleep and extracts the shared
start/end form section — no shared date/time pill component exists today, each of the eight screens
inlines its own — and carries the sleep-only work of the edit-screen overlap check and the morning
predicate reading the edited start. Tasks 0073 and 0075 reuse that section and can run in parallel.
Task 0075 covers pumping and tummy time together by the owner's decision, since once the shared section
exists both are the same mechanical change with no type-specific behavior. The duplicate and overlap
check for feeding, pumping, and tummy time stays out of all three tasks: it is
`decisions/resolved/019-interval-overlap-non-sleep.md`, planned after this cluster so it is wired into
these screens' final shape once. Two caps the decision record does not name are carried from the
shipped validators: 2h for feeding and 2h for tummy time.

Task 0074 was added on 2026-08-07 after the owner found, in a simulator session on Task 0073's branch,
that a caregiver with no account cannot edit a running timer's start time: the Task 0071 control renders
identically and does nothing on tap, because `canEditTimerStart` short-circuits on a missing user id
before it reaches its local-ownership branch. The owner placed it immediately after Task 0073, so the
two unstarted tasks below it were renumbered the same day: the pumping and tummy-time clock-time task
became 0075, and the overlap-warning task became 0076. Every reference in this plan, in the task files,
in the timer-time-editing cluster, and in the merged Tasks 0071 and 0072 was repointed at the same time,
so a statement dated 2026-08-05 that reads "Tasks 0070 through 0074" in an untouched copy elsewhere means
what this plan now calls 0070 through 0073 plus 0075. Task 0075 depends on 0074 because both edit
`src/contexts/pumping-context.tsx` and `src/contexts/tummyTime-context.tsx`. Task 0074 carries two
durable decisions the owner settled the same day. An account-less caregiver is **not** an offline
caregiver: today both land on `TimerLockReconciliationState` `"offline"`, one because lock acquisition
was skipped for want of an account and the other because a signed-in acquisition threw, and 0074 splits
them so an account-less edit writes locally and never queues while a signed-in offline edit still queues
and reconciles. And the
running-timer start-edit control **drops the caregiver name entirely**, reversing Task 0071's decision to
name the starter there: only the starter may edit, so the name tells them nothing, and with no account it
resolved to "Someone" — the app attributing a timer to a stranger on a single-user device. The
`common.someone` key and its five other call sites, which describe a genuinely unknown _other_ caregiver,
are unaffected.

Task 0052 ran on 2026-08-01 and is marked `[-]`: the audit was performed and its findings were dispositioned, but the owner decided its matrix must never be committed, because this repository is public and the matrix describes authorization weaknesses that are live in production. The document and its two probes stay on the owner's machine, excluded through `.git/info/exclude`. Do not re-run 0052 and do not commit its output. Its findings are carried forward as Tasks 0054, 0055, 0057, and 0059; Task 0058 covers a `merge_record` sync failure the owner reported the same day. Task 0055 depends on its predecessor only because both add migrations and would otherwise collide on the next migration ordinal. Task 0056, the remaining finding, was removed on 2026-08-05 and is superseded by Task 0070.

Tasks 0077 and 0078 were added on 2026-08-08 after a physical production observation proved that an
iOS Widget push can remove a remotely stopped sleep timer while retaining the previous completed
sleep's awake anchor; Apple Watch exhibits the same timer-only reconciliation defect. Task 0077 adds
the additive selected-baby summary contract and migrates Widget as the first complete consumer. Task
0078 depends on it and migrates Watch while preserving the lightweight timer probe. These focused
tasks do not depend on or reopen deferred Tasks 0049, 0052, or 0059, and no task authorizes production
access or mutation.

Task 0079 was added on 2026-08-09 after the owner reviewed how the app asks for App Store and Play
Store ratings. It replaces a lifetime cap of three prompts with a rolling 365-day window, because
neither platform reports whether a review request actually produced a dialog: when the operating
system has already spent the user's quota the call is a silent no-op, yet the app still records a
prompt, so under a lifetime cap those wasted slots were permanent. The owner settled three durable
decisions the same day. The prompt count is **not** reset per app version — only by the rolling
window. The manual Rate App entry point added to Settings is **quota-neutral and applies no
suppression**, deliberately, because app volume is low and rating count needs to rise, so a manual
tap must never reduce future automatic opportunities; it also opens the store write-review deep link
directly rather than calling the in-app review API, which does nothing once the quota is spent. And
server-side logging of prompt attempts was considered and rejected, because it could only record
attempts rather than confirmed impressions, would miss account-less users under row-level security,
and could not be backfilled — there is consequently no way to query how often prompts have been
shown, by design. The owner chose a single task over a split despite the physical-device
verification it carries. The task also corrects the hardcoded version string in the Settings About
section, which read `4.0.0` against an app config declaring `4.8.1`; the release rolling it out is
`4.8.2`.

Task 0086 was added on 2026-08-12 after a production incident: at 200 users the backend hit ~190K
API requests per day and a Supabase disk-I/O budget warning. Gateway logs and `pg_stat` data traced
most traffic to redundant client behavior — a realtime `babies` UPDATE (fired by database triggers
on feeding inserts and qualifying sleep mutations) destabilizes the `selectedBaby` reference and
stampedes the eight activity contexts into full-table refetches on every household device, timer
restore adds four per-type `active_timers` probes that 406, phone wake fires the foreground refresh
twice, and every catch-up pull re-downloads full 1000-row pages with no incremental filter. The
owner chose a single task over a split despite four distinct sub-fixes. A same-day review pass
hardened the design: composite `(updated_at, id)` cursors instead of timestamp-only, `updated_at`
columns added to the four activity tables that lack them, a refresh coordinator that never
suppresses the post-offline catch-up and whose wake cycle counts as satisfied only when every
registered provider loader succeeds, a fully paginated one-time cursor bootstrap (a single-page
bootstrap would permanently skip edits and tombstones on rows sharing the migration backfill
timestamp), and `achievements` excluded from the cursor design for lack of `updated_at` and
tombstones. The same incident produced migration 063 (bounding
`get_due_wake_window_reminders()`'s full-table `sleep_sessions` scans, which ran twice every five
minutes from pg_cron), applied to production as a SQL-editor hotfix the same day; committing it is
part of Task 0086. The Watch's 30-second `active_timers` poll was examined and deliberately left
unchanged by owner decision.
