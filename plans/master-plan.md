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
- A pointer has four states: `[ ]` todo · `[~]` in progress (claimed) · `[>]` done, PR open,
  awaiting merge · `[x]` merged to `main`. `sync-main` flips `[>]→[x]` and moves the task file to
  `tasks/done/` once the PR merges.
- Pointers carry their direct prerequisites as an `(after NNNN, …)` suffix (none = no suffix). A
  task is selectable only once every ordinal in its `(after …)` list is **`[x]` (merged)** — so a
  dependent never branches off `main` before its prerequisite is actually on `main`.
  `implement-next-task --worktree` uses this to pick the first task not blocked by in-progress work,
  or reports "no independent task" when every remaining task is blocked.

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
- **Morning sleep is resolved independently of persisted sleep type**: predictions keep the configured
  day-start-minus-3h03 anchor, treat only the first sleep starting between that anchor and day start as
  night continuation regardless of stored type or duration, preserve raw history, and never let a
  sleep starting at or after day start replace morning wake.
- **Earlier-morning drift is conservative and first-window-only**: suggest, but never automatically
  apply, the median earlier final wake only when at least five of the last seven recorded mornings are
  at least one hour early and their first nap follows the age-appropriate first wake window within a
  15-minute tolerance. Later wake windows and bedtime are unaffected.
- **Manual sleep overlap is permitted with informed confirmation**: warn with Cancel and Continue
  anyway, preserve both raw records when continued, and use interval union for predictions and
  statistics so overlap is neither double-counted nor allowed to shorten sleep.

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
- [ ] 0028 · Detect age-aware earlier morning drift (after 0027) → tasks/0028-detect-age-aware-morning-drift.md
- [ ] 0029 · Warn and safely calculate overlapping manual sleep (after 0028) → tasks/0029-warn-and-union-overlapping-manual-sleep.md
- [>] 0026 · Repair the production iOS date-picker module provider (after 0017) → tasks/0026-repair-ios-date-picker-module-provider.md

## Workflow status

Tasks 0001 through 0025 are merged. Their earlier Software Repository Guidelines assessment is recorded in `plans/repository-guidelines-assessment.md`. Task 0026 is unstarted and deprioritized. The 2026-07-26 production diagnosis added tasks 0027 through 0029 for fragmented morning-sleep resolution, age-aware earlier-morning drift, and safe non-blocking manual overlap; the user prioritized task 0027 ahead of task 0026.
