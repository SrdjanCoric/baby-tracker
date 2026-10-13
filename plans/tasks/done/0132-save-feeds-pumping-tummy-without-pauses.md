# Task 0132: Save breast feeds, pumping and tummy time without resumed pauses

**Branch**: `feature/exclude-pauses-from-non-sleep-records`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: user request and conversation 2026-10-12 · **User stories**: a mother nurses 1 minute right, pauses 3 minutes for a diaper, nurses 5 minutes left and stops; the saved feed is 6 minutes with right 1 and left 5, and the app suggests right next time.

## What to build

When a breast feeding, pumping or tummy time timer is stopped, the saved entry's duration is the time between start and end minus every pause the caregiver resumed from. The entry also stores that pause total in a new `pausedSeconds` field (`paused_seconds` column on the feedings, pumping sessions and tummy time sessions tables). Sleep keeps today's rule: a resumed pause counts, and sleep entries get no pause field.

| Timer state at stop | Saved end | Saved duration | Saved pausedSeconds |
| --- | --- | --- | --- |
| Running, never paused | stop time | end − start | 0 |
| Running, paused earlier and resumed | stop time | end − start − resumed pauses | resumed pauses |
| Paused right now | the pause moment | pause moment − start − earlier resumed pauses | earlier resumed pauses (the open pause is not billed and not stored) |
| Manual entry | as entered | as entered | 0 |
| Entry saved before this change | unchanged | unchanged | absent, read as 0 |

A breast feed's left and right seconds are the time spent on each side while the timer was running. A resumed pause is added to neither side (today it is added to the side the feed finished on). The side suggestion therefore compares nursing time only.

The pause total survives sync: it is written to the server, read back from the server, exported and imported with the entry, and present on realtime updates. Everything that shows or sums a saved duration (timeline rows, daily summaries, statistics, CSV, PDF report, widget tiles) shows the new value without change.

## Decided

- Sleep is the only timer where a resumed pause counts. — Owner decision 2026-10-12; a sleeping baby is still asleep while the parent is away from the phone, a nursing baby is not.
- The pause total is stored on the entry, never recomputed from the timer. — The edit screens (later tasks) must show it after the timer is gone.
- Stopping while paused still ends the entry at the pause moment. — Unchanged rule; an open pause bills nothing.
- Old entries keep their stored duration and are not backfilled. — No way to know whether a gap was a pause.
- Migration adds one nullable integer column to three tables, no backfill, no default. — Smallest change; absent reads as 0.

## Clarifications

- 2026-10-13 — Asked whether “CSV export and import” adds a SofiBaby CSV reader or
  refers to the existing import pipeline. Owner confirmed that Huckleberry and Nara remain
  the supported imports and must not break. No new import format: preserve `pausedSeconds`
  through entry import batching, export it in CSV, and run both supported readers' regression tests.
- 2026-10-13 — Owner approved fixing the delayed widget resume mismatch within this task:
  feeding, pumping and tummy time must use the accepted resume timestamp and accumulated pause
  total consistently in memory and storage. Sleep remains unchanged.

## Implementation classification

- Change class: mixed (production/test code, SQL migration, and usage documentation).
- Validation tier: canonical; focused tests and affected-area checks run before review, with final `npm run check:code` owned by `finish-task`.
- TDD applicable: true.

## Implementation evidence — 2026-10-13

- Implementation and focused pre-review validation are complete on
  `feature/exclude-pauses-from-non-sleep-records`. The master-plan pointer remains `[~]` for the
  manual review loop; no PR or final completion record has been created.
- Non-sleep adapters subtract resumed pause milliseconds and save whole pause seconds.
  Feeding side totals exclude pauses. Sleep's adapter and its test file are unchanged.
- Local storage, queued creates, database-read transforms, guest promotion, realtime transforms,
  entry import batching, and CSV retain the field. Legacy local reads normalize absent pauses to
  zero without rewriting stored rows. Manual creates save zero.
- Migration `072_non_sleep_paused_seconds.sql` adds three nullable integer columns, without
  defaults or backfill. On owner request, compatibility was then verified in an isolated PostgreSQL
  17 container using repository table DDL, CRDT RPCs, and the migration 064 cursor schema. Existing
  records retain their durations; old inserts omit the nullable field successfully; both legacy
  RPC signatures preserve pause metadata when editing a new record. The v4.9.23 app readers were
  executed against actual migrated fixture rows: all three preserve active duration and ignore
  the new field. The container was stopped and removed. No hosted migration was applied; the
  hosted `[confirm-db]` checkpoint remains open. Reproduce SQL compatibility with
  `npm run test:sql:setup && npm run test:sql`.
- Observed RED → GREEN: adapter pause exclusion (15 failures), local provider persistence
  (missing pause field), sync reads/writes (6 failures), realtime (2 failures), and CSV (3 failures).
  Restoring the old counted-pause duration with a temporary mutation also failed all three
  non-sleep consumer tests and the widget-total test; the mutation was removed.
- Focused validation passed: 488 unit tests across 14 suites, including both supported import
  readers and import persistence; 96 component/integration tests across four suites after the
  approved delayed-resume fix; TypeScript;
  affected-file ESLint; `git diff --check`. A narrower ordinary-resume test passed again after
  reducing formatting churn. The delayed-resume cycle observed two failures at the intended
  assertion (300,000 pause milliseconds instead of 180,000), then four passing cases for running
  and paused stops, both before and after restart. The provider test also proves nursing side
  seconds and persisted pause totals. Final `npm run check:code` remains owned by `finish-task`.
- Derived facts: resume callbacks already calculate accepted timestamps/pause totals and persist
  them; normal entry imports map camelCase fields to snake_case generically; consumers use the
  stored duration. Sources: non-sleep contexts' resume callbacks, `activity-sync-service.ts`
  `createImportedActivityBatch`, and the consumer integration tests.
- Boundaries: timer payloads mirror existing context/codec producers; database read fixtures are
  produced from queued create data and run through the fetch/storage path; realtime uses the
  existing database row/event shape; CSV uses the current exporter schema with an added pause
  column. Producer-backed tests cover queue/fetch and import paths. Delayed-resume tests call the
  real providers with the existing widget timestamp/duration arguments; restart lock fixtures use
  the timers actually persisted by those providers. Targeted SQL compatibility was verified as
  noted above; this does not claim full-chain, hosted, or live realtime-delivery verification.
- Additions not named in the original task: the owner-approved delayed-resume reducer correction,
  recorded in Clarifications. Import scope was clarified above. No new format, flag,
  environment variable, heuristic, dependency, or fallback was added.

### Resolved decision: delayed widget resume

The existing non-sleep `RESUME_TIMER` reducers ignore the accepted resume timestamp and widget
pause duration: they recompute the total from `Date.now()`, while the callback persists the correct
accepted values. `useWidgetPauseHandler.ts` passes recorded widget values to these callbacks.
With the new subtraction rule, a delayed command can therefore save a shorter entry in the current
session than after a restart. The ordinary chronological provider journey passes; the existing
historical-timestamp fixture exposed the mismatch, and direct source inspection confirmed it.

The owner approved the fix after a concrete explanation. The three non-sleep reducers now take
the accumulated pause total calculated by the existing resume callback; feeding also takes its
accepted resume timestamp for the current side. Memory and storage therefore agree, including
delayed widget delivery. Sleep code and its dedicated tests remain unchanged. No unanswered
questions, deferred obstacles, or confirmed out-of-scope work remain.

## Review remediation decisions — 2026-10-13

- Owner approved all minor/nit findings #4–#10.
- Feeding and pumping discard sessions below one active minute, including remote stops.
  Pumping retains its existing local volume-only exception. Tummy-time stops and conflicted restores retain short sessions.
  Adapter policy controls feeding/pumping minimums through the shared timer-duration helper.
- Use interim pause subtraction in all three edit screens, displays, validation and picker bounds.
  Preserve stored pausedSeconds; Tasks 0135–0137 remain responsible for the full editing experience.
- Owner approved first-saved completion timing for non-sleep timers. Later completion builders are
  acknowledged without overwriting the saved entry; ordinary edits continue through merge_record.
  This prevents conflicting overwrites but cannot reconstruct an offline pause unknown to the
  first builder. The losing phone adopts the stored server entry and its field clocks from the completion response, updates local displays, and remains converged on the next pull.
- Widget snapshots retain paused display state and accumulated seconds, without publishing
  pausedAt. The unused native pause intent and its resume-duration helper are removed. Providers
  still accept completed pause spans from queued app commands.
- Migration 073 accumulates resumed non-sleep pauses and banks nursing-side seconds under a row
  lock. Server-calculated totals take precedence over full copied remote-control payloads on pause
  and resume. A lastResumedAt timestamp prevents applying the same completed widget pause twice;
  it survives local persistence, server reconciliation and restart. Feeding also adopts the server
  side counters and side start. Sleep accounting remains unchanged.
- Migration 074 preserves the first non-sleep completion, including side seconds, while retaining
  authorization, atomic lock cleanup, replay acknowledgement and ordinary edits.
- Migration 072 adds nonnegative constraints while retaining nullable columns, no default and no
  backfill. PostgreSQL 17 compatibility is checked with both legacy merge_record signatures.
- Automated device E2E adds no reliable coverage of deliberately delayed commands or competing
  database writers here. Real provider integration, native snapshot tests and PostgreSQL behavior
  cover those boundaries deterministically. Hosted migration and native surface checks remain
  release checkpoints.
- A fresh task-review is recommended because completion conflict resolution now preserves the
  first saved record. Final canonical validation remains owned by finish-task.

### Review remediation proof

- All ten frozen findings are fixed, including the owner's full copied remote-pause payload
  correction to 073. Real provider tests cover zero-duration hints, missed pause commands,
  out-of-order resumes, repeated delivery, server-banked nursing sides, active-duration minimums,
  remote stops, conflicted restore and persisted resume timestamps.
- Focused assembled checks pass: 310 unit tests in 12 suites; the six affected component suites
  (one legacy fixture was brought above the feeding/pumping active minimum and its two cases
  rerun); TypeScript; affected-file ESLint; widget and Watch Swift production typechecks and
  native tests. No dedicated sleep test file changed.
- Isolated PostgreSQL 17 checks pass for pause accounting, authenticated refreshed snapshot
  timestamps, full copied control payloads, first completion preservation, ordinary edits,
  replacement locks, replay/rollback, nullable/no-default columns and both legacy RPC signatures.
  Overlapping household completion transactions also preserve the first timing for all three
  tables; the second writer waits for the first transaction. Reproduce the completion and pause
  SQL vectors with `npm run test:sql:setup && npm run test:sql`.
- Reproduce focused checks with `npx vitest run src/services/timer-lifecycle.test.ts
  src/services/timer-adapters src/services/sync/sync-engine-crdt.test.ts
  src/utils/timer-duration.test.ts`, `npx jest --runInBand --runTestsByPath
  src/__tests__/external-timer-stop-providers.integration.test.tsx`, `npm run typecheck`,
  and `npm run test:widget:swift`.
- No hosted migration, push or PR was performed. Final check:code is still owned by finish-task.

### Second review remediation proof

- Migration 073 preserves the first non-sleep pause boundary on duplicate commands and uses
  database time for new pauses and feeding side banking. Migration 074 returns an existing
  non-sleep completion with an explicit preservation marker and its canonical row; sleep keeps
  the prior response shape.
- The losing completion adopts the server row in local storage and its CRDT shadow, then emits
  the provider update. A regression with newer local clocks proves later pulls retain the winner.
- Adapter policy and the shared active-duration helper govern local feeding/pumping stops,
  remote stops and conflicted restores using accepted completion times. Tummy time retains short
  sessions; pumping retains its local volume-only exception. Observed lock callbacks carry decoded
  adapter payloads. Adapter and edit duration calculations share one utility.
- Focused checks pass: 339 unit tests across 13 files and 133 component/integration tests across
  six suites; `npm run typecheck`; affected-file ESLint; `git diff --check`.
- `npm run test:sql:setup && npm run test:sql` passes on the local Supabase stack, including
  pause boundaries, nullable pause columns, legacy RPC compatibility, canonical completion
  responses, sleep response compatibility and household completion concurrency. The SQL runner
  now includes both non-sleep pause files.
- A fresh task-review is recommended for the completion response and adoption path. Canonical
  validation remains owned by finish-task; hosted migration confirmation remains open.

### Unapplied migration consolidation — 2026-10-13

- Owner confirmed that only migration 072 has reached production and authorized amending the
  unapplied migrations. Migration 072 remains unchanged; migration 073 includes server clock and
  duplicate-pause fixes; migration 074 includes first-completion preservation and its canonical
  response. Each affected database function has one migration file.
- The snapshot-function migration is removed along with the unused Swift pause intent,
  resume-duration helper and transported pausedAt field. Paused widgets still display their
  frozen accumulated seconds. Existing app pause links and queued-command handling remain.

- Cleanup verification passes: `npm run test:sql:setup && npm run test:sql`,
  `npm run test:widget:swift`, widget snapshot/data unit tests (23), the widget provider
  component suite (10), `npm run typecheck`, affected-file ESLint and `git diff --check`.

## Non-goals

- The running readout, Home card, Live Activity, widget or Watch (Task 0134).
- Edit screens and manual logging (Tasks 0135, 0136, 0137).
- Pumping minutes per side (Task 0133).
- Sleep in any way.

## Context

The shared timer lifecycle computes every saved duration in one function that today ignores the pause total it is handed. Each type's adapter builds the saved entry from the timer payload; the feeding adapter is the one adding resumed pauses to a side. The pause total already lives on the running timer and in the server lock's timer data; nothing saves it on an entry. Existing tests across adapters, providers and consumers assert the opposite rule for the three types and must flip. The usage doc `docs/usage/timers.md` has one line stating the pause rule; it must now state both rules.

## Implementation work

- [x] The feeding, pumping and tummy time adapters save the table above; the sleep adapter is unchanged — proven in `src/services/timer-adapters/feeding-timer-adapter.test.ts`, `src/services/timer-adapters/pumping-timer-adapter.test.ts`, `src/services/timer-adapters/tummy-time-timer-adapter.test.ts`, `src/services/timer-adapters/sleep-timer-adapter.test.ts`
- [x] A breast feed's sides exclude the pause, and the mother's example suggests right next — proven in `src/utils/feeding-sessions.test.ts`
- [x] Every provider's saved entry follows the table, including the paused-now row — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [x] Consumers of saved durations show the new value — proven in `src/__tests__/recorded-timer-duration-consumers.integration.test.tsx`
- [x] `pausedSeconds` round-trips through server sync, realtime, CSV export and import, and old rows read as 0 — proven in `src/services/activity-sync-lossless.test.ts` and `src/utils/csv-generator.test.ts`
- [x] Migration `072` adds `paused_seconds` to the three tables.
- [x] `docs/usage/timers.md` states the sleep rule and the other rule, each marked with its test.

## Human checkpoints

- [x] [confirm-db] Migrations 072–074 are applied to the hosted project (verified 2026-10-13 by reading the live function definitions). Migration 073 is restored to its applied content.
- [x] [confirm-db] Migration 075 is applied to the hosted project (verified 2026-10-13). It carries the repeated-pause fix (keep the first pause boundary and frozen display) that was edited into 073 after 073 was applied. Same function signature and return type, so released apps are unaffected.

## Acceptance criteria

- [x] Every row of the table has a passing test for each of the three types.
- [x] No sleep test changes.
- [ ] `npm run check:code` passes.

## Pre-review coverage map

- Duration/pause table: the three non-sleep adapter suites cover never-paused, resumed pauses,
  multiple resumed spans and paused payloads. Real provider tests cover running stops, open-pause
  end selection and queued widget/Watch/routed stops. Lossless sync tests cover manual zero pauses
  and legacy rows with absent or null pauses, without rewriting legacy local data.
- Nursing side totals and suggestion: `feeding-sessions.test.ts` proves the 1-right / 3-pause /
  5-left example; adapter cases cover left, right and both. The delayed-resume provider matrix
  proves side seconds count from the accepted resume instant.
- Saved-duration consumers: `recorded-timer-duration-consumers.integration.test.tsx` covers all
  three activity types through statistics, applicable daily summaries, timeline display, CSV and
  PDF report output. `widget-context.component.test.tsx` proves the tummy-time widget total.
- Sync/import: `activity-sync-lossless.test.ts` proves queue→server-shaped pull→storage,
  entry-import batching and guest promotion; provider tests prove realtime INSERT/UPDATE.
  `csv-generator.test.ts` proves separate pause totals; Huckleberry and Nara reader and import
  persistence suites pass unchanged.
- Migration: nullable/no-default/no-backfill contract checked; PostgreSQL 17 compatibility tests
  and v4.9.23 reader execution pass. The hosted application checkpoint is still open.
- Sleep: dedicated sleep adapter code/tests and sleep-only consumer cases are unchanged and pass.
- Final `npm run check:code`: pending `finish-task`, after the manual review loop.

## Third review remediation decisions — 2026-10-13

- Mixed-version completion limitation: released apps ignore the winning-row response and can retain losing timing locally. Migration 074 keeps the first completion; updated clients adopt it when processing a preserved response. Upgrading does not automatically repair an already acknowledged losing completion. This limitation is documented in `docs/usage/timers.md`; server field clocks are not rewritten because that would change ordinary-edit conflict resolution.
- A cumulative pause total contains no pause spans. After any completed pause, non-sleep start editing permits earlier starts only; moving later would risk subtracting pauses outside the edited session. Unpaused timers without completed pauses retain their existing bounds.

- Whole-second rounding retains `durationSeconds + pausedSeconds = floor(wallMilliseconds / 1000)`. Fractional pause milliseconds may therefore contribute less than one extra active second; the pumping adapter pins this existing policy.

- Delayed remote-command limitation: database-time pause/resume boundaries measure receipt time. Delayed Watch delivery can lose a pause and bill it as active time. This is documented in `docs/usage/timers.md`, retaining the previously selected database-time policy rather than silently switching to client event time.
- Clock skew (2026-10-13): owner chose documentation only. Local app writes keep phone times and remote controls keep database time. A follow-up migration that clamps the server pause boundary was rejected: it still yields a zero-length entry in the harmful case, so it saves no data. The limitation is documented in `docs/usage/timers.md`. Migration 073 is applied to the hosted project.

### Third review focused proof

- RF-1–RF-19 are resolved. RF-9 is resolved by documentation (see the clock-skew decision above). RF-7 and RF-8 use the review's explicit documentation alternatives; the underlying mixed-version and delayed-command limitations remain visible.
- Focused union passed 382 unit tests in 16 suites. Component/integration validation passed 264 cases across 12 suites using the assembled run plus focused correction of the sleep-conflict expectation and the stale catch-up engine mock.
- `npm run test:sql` passed, including preserved completion timing with distinct competing writers and duplicate-pause display preservation. Disabling completion preservation makes the concurrency check fail; removing pause terms fails validator/picker regressions; removing reconciliation serialization fails the gated storage/shadow races; wall-clock timeline mutations fail all three production-row cases.
- `npm run typecheck`, affected-file ESLint and `git diff --check` pass. Logs: `/tmp/agent-workflows/e2f8af45fd34/f9c8ba82f694/` (`unit.log`, `component.log`, `component-correction.log`, `sql.log`, `typecheck.log`, `lint.log`). Final canonical validation remains owned by `finish-task`. No hosted migration or push was performed.
