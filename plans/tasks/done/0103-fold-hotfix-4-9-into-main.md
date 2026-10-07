# Task 0103: Fold the 4.9 hotfix line into main

**Branch**: `feature/fold-hotfix-4-9-into-main`
**Depends on**: none
**Base**: local `main` at the planning commit that adds this task (on top of `29f4e86`, 4.10.2).
**Merge source**: `hotfix/4.9` at `57b1a96`, tagged `v4.9.23`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-06 · **User stories**: one `main` line carries every shipped 4.9
fix and the held 4.10 work, so the next 4.10 build does not regress anything 4.9.23 fixed.

## What to build

`main` receives every 4.9 hotfix from 4.9.15 through 4.9.23 through one merge of `hotfix/4.9`. After
the merge the app behaves as the union of both lines, and every existing automated suite of both
lines passes on the merged result:

- 4.10: household members stop and pause any timer, widget and Watch control of household timers,
  the starter's Live Activity ends on remote stop, Live Activity push-to-start.
- 4.9 hotfixes: double-tap navigation guard, Android bounded date picker ANR fixes, session-lock
  abandonment handling, quieter offline observability, and the atomic save-and-clear on a
  caregiver's own timer stop.

Every merge conflict resolves to the behavior in this table:

| Conflicting surface | Resolved behavior |
| --- | --- |
| App version | `4.10.2` |
| Release notes | Every section from both sides, newest version first; no section reworded |
| Android bounded date picker and its component test | The `hotfix/4.9` behavior and tests in full |
| Lock release in the active-timer service | Both effects: main's snapshot invalidation and the hotfix release breadcrumb |
| Active-timer service tests | Both suites: household timer updates and lock failure reporting |
| Household device E2E runner | Both scenarios, each complete: main's member pause, resume, and stop of the owner's timer; the hotfix's owner stop with direct lock release blocked, ending with the member phone showing the timer stopped |
| SQL test runner | Both suites registered and run: Live Activity tokens and atomic timer completion |
| Master plan | Union of both sides' decisions, task pointers, and dated notes; no pointer lost or duplicated |
| Task 0095 file | `main`'s version |

Database migrations: `065_atomic_timer_completion` keeps its number. `main`'s three migrations are
renamed with byte-identical contents: `065_household_active_timer_controls` becomes `066`,
`066_live_activity_push_tokens` becomes `067`, `067_live_activity_start_tokens` becomes `068`. Every
repository reference to those migrations by number or count uses the new numbers. A fresh local
database built from the migrations folder applies all migrations, 001 through 068, with no
new duplicate version in 065–068; preserve the historical 039 duplicates and 009b file.

## Decided

- Merge, never rebase, and never force-push `main` — `main` is published history with merged PRs.
- Production migrations are pasted into the Supabase SQL editor by the owner and production keeps
  no migration-history rows, so renaming migration files has no production effect — owner, 2026-10-06.
- No agent connects to production Supabase — owner rule.
- Version `4.10.2` is unused: no EAS build and no tag exists above `4.10.1` — checked 2026-10-06.
- `main`'s local commits `bb87be3` and `29f4e86` stay in history: `bb87be3`'s navigation guard is
  identical to the hotfix's `d14a72b`, and its picker change is superseded by the later hotfix
  picker fixes.
- 065 (atomic completion) applies before 066 (household controls): they change disjoint database
  objects, and production already holds both.
- A household member stopping another member's timer still saves without the timer's identity, so
  the save step does not clear that lock. This known gap is fixed by Task 0104, not here.

## Clarifications

- Owner, 2026-10-06: preserve the existing duplicate 039 files and 009b file. The migration uniqueness criterion applies to 065–068; historical migration files stay unchanged.

- Owner, 2026-10-06: numeric migration references in SQL comments may be updated; executable SQL remains byte-identical. This qualifies the byte-identical migration requirement.

## Non-goals

- Clearing another member's lock in the save step (Task 0104).
- Final 4.10.2 release-note wording, store builds, and production checks (Task 0105).
- Review findings skipped in Task 0091 (TR-11 through TR-21).
- Pushing `main` or opening the PR before the owner says so.

## Context

`main` diverged from `hotfix/4.9` at `e5000ac` (4.9.14): 15 commits on `main`, 34 on `hotfix/4.9`.
A trial merge conflicts in ten files; everything else merges cleanly. `main` is two commits ahead
of `origin/main` (`bb87be3`, `29f4e86`). Production runs 4.9.14 and 4.9.23 is in store submission.
The 4.10.0 and 4.10.1 binaries were built and submitted on 2026-09-06 and 2026-09-07 but never
released. Task 0094 is still `[>]`: its combined-`main` household E2E gate and two-device Live
Activity checks are open and move to Task 0105.

## Implementation work

- [x] `hotfix/4.9` is merged into the branch with every conflict resolved per the table, and both
      lines' unit and component suites pass — proven in `src/services/active-timer-service.test.ts`,
      `src/components/BoundedAndroidDateTimePicker.component.test.tsx`, and
      `src/__tests__/external-timer-stop-providers.integration.test.tsx`.
- [x] `main`'s three migrations carry numbers 066–068 with unchanged contents, and every reference
      names the new numbers; a fresh local database applies 001–068 — proven in
      `scripts/sql/active-timer-authorization-tests.sql`,
      `scripts/sql/active-timer-completion-tests.sql`, and
      `scripts/sql/live-activity-push-token-tests.sql`.
- [x] The household device runner keeps both scenarios complete and in sequence — proven in
      `e2e/scripts/run-household-timers.mjs`.

## Human checkpoints

- [x] [verify] Run `npm run e2e:household-timers:clean` on the merged branch with two iOS
      simulators and local Supabase. · Expected: both scenarios pass and cleanup completes. ·
      Failure: any Maestro, assertion, or cleanup failure. · Reason: needs booted simulators,
      Maestro, and Docker, which the implementing agent may lack.

## Acceptance criteria

- [x] `npm run check` passes on the merged branch, with Docker running.
- [x] `npm run audit:dependencies` passes.
- [x] The repository holds exactly one migration per number from 065 to 068; historical files remain unchanged.
- [x] `git log` shows `hotfix/4.9` at `57b1a96` as a parent of the merge, and `main`'s history is
      unchanged below it.

## Implementation classification

- Change class: mixed (merge of production code, tests, migrations, and documentation).
- Validation tier: canonical; focused pre-review suites here, final canonical proof in finish-task.
- TDD applicable: integration regression checks for the merged existing behavior; no new product behavior.

## Pre-review implementation evidence

- Base: `de01e81`; merge source: `57b1a96`. Both lines are preserved by a merge commit.
- RED: imported failure-injection cleanup regression failed because main lacked reusable cleanup; GREEN: all 18 household runner tests pass.
- Imported timer completion provider test failed because its crypto mock omitted main's digest API; supplied real SHA-256 hashing in that test mock. Both online and offline cases now pass.
- Unit: 168 files, 2,950 tests pass. Component/integration: 121 suites, 1,134 tests pass (explicit loopback Supabase URL and dummy test key; no environment files read). Lint and typecheck pass.
- Static checks: 065–068 each unique; 70 migration files in total, including preserved historical 009b and duplicate 039 files. All historical contents unchanged; moved contents unchanged except the approved numeric comment. Picker files match hotfix; task 0095 matches main; release sections from both lines unchanged and ordered newest first; master-plan pointers form a unique union.
- Both SQL suites remain registered. Fresh migration application and SQL execution are **unproven**: Docker daemon absent, Docker.app has no executable, and localhost Postgres refuses connection. Two-simulator gate remains the declared finish-task checkpoint.
- `npm run audit:dependencies` **fails**: eight unapproved high/critical advisories (brace-expansion ×2, braces, compression, node-forge, shell-quote, source-map-js, undici). Package manifest and lockfile are unchanged from main. Dependency remediation is outside this merge task and left undone. No exceptions were added.
- Full `npm run check` is reserved for finish-task and remains unchecked. The migration implementation item remains unchecked until fresh local application is proved.
- Derived facts: main's timer completion IDs need SHA-256 (`timer-completion-service.ts`); main's second owner completion is row 2, so the retained blocked-delete scenario expects two completions while the first member stop remains row 1.
- Boundaries: existing SQL files and migration applier supply migration format/order; static byte comparisons prove preservation, database behavior is unproven without local Supabase. Existing completion service supplies digest contract, exercised through the real provider/sync integration test. Device assertions mirror both original branches; device execution remains unproven.
- Additions outside task: none. README edits are limited to migration references required by the task; no broader README update.
- Clarifications: comment-reference exception and preservation of historical migration numbering, both approved by owner.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/1e4e3d200eb7` (`runner-red.log`, `runner-green.log`, `unit.log`, `component.log`, `component-green.log`, `affected-checks.log`, `merge-consistency.log`, `audit.log`).
- Status: merge implementation committed; acceptance blocked by dependency audit and unavailable local SQL runtime. Not fully complete.

### Local SQL follow-up, 2026-10-06

- Owner requested starting Docker. Launching `/Applications/Docker.app/Contents/MacOS/Docker Desktop.app` succeeded; the earlier outer-app launch failure did not mean the nested executable was missing. Restarted this repository's stopped local Supabase containers.
- `npm run test:sql:setup` passed: fresh local reset followed by all 70 migration files, through 068. This proves the migration implementation item and supersedes the earlier unavailable-runtime blocker.
- `npm run test:sql` passed, including active timer authorization, Live Activity tokens, atomic timer completion, CRDT vectors and concurrency checks. Logs: `sql-setup.log` and `sql.log` in the existing task log directory.
- Remaining blocker: dependency audit. The declared two-simulator check and full canonical proof remain for finish-task. No dependency changes or audit exceptions were introduced.

### Authorized dependency remediation, 2026-10-06

- Owner explicitly requested fixing the dependency audit findings, extending this task's scope to their remediation. Classification for this follow-up: dependencies/focused; no new application behavior, so behavioral TDD is not applicable.
- Updated only compatible versions of five transitive packages in the lockfile: brace-expansion 1.1.21/2.1.7/5.0.12 (two findings), compression 1.8.2, shell-quote 1.12.0, source-map-js 1.2.2, undici 6.29.0. Manifest and overrides unchanged.
- Installed the updated lockfile and reapplied the existing date-picker codegen patch. No new patch machinery added.
- Passed: 65 CI tests, lint, 21 active-timer service tests, 70 bounded-picker/provider tests, and iOS production bundle gate. Only targeted package entries differ in the lockfile.
- Audit now reports only two unapproved findings: braces GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv. Upstream advisories list no patched release. No new exceptions or local security patches have been applied; owner decision pending.
- Boundary evidence: npm's lockfile/audit report and official advisories supply dependency versions and affected ranges. Installed package sources show braces consumed by micromatch/chokidar and node-forge consumed by Expo CLI/code-signing-certificates; neither has a direct app/src import.
- Evidence logs: dependency-update.log, dependency-install.log, audit-updated.log, dependency-checks.log, dependency-runner-smoke.log, dependency-bundle.log in the existing task log directory.
- Upstream: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm ; https://github.com/advisories/GHSA-86w9-cpqp-85rv ; proposed RSA fix https://github.com/digitalbazaar/forge/pull/1152 remains open.

### Approved audit policy follow-up, 2026-10-06

- Owner approved the recommended documented temporary exceptions for braces GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv, expiring 2026-10-31. Exact dependency paths, reviewed tooling exposure, reason, owner and upstream links are recorded in `.github/dependency-audit-exceptions.json`. These vulnerabilities remain present and are accepted temporarily, not patched.
- `npm run audit:dependencies` passes: four active high-severity exceptions (the two existing image-size advisories and the two owner-approved additions); no unapproved high/critical findings. All nine dependency-policy tests and `git diff --check` pass. Logs: `audit-approved.log`, `dependency-policy.log`.
- This clears the dependency-audit implementation blocker. Scope additions (dependency updates and the two exceptions) were explicitly approved by the owner. No decisions remain pending.
- Implementation and focused pre-review validation are complete; branch is stable for manual task-review. Master-plan pointer stays `[~]`. Full `npm run check`, declared device verification, final completion and publication remain owned by finish-task.
- Next: `/skill:task-review`, then `/skill:review-fix-worker`, repeat until clean/accepted, then `/skill:finish-task`.


### Canonical and device validation, 2026-10-07

- Validated head `4c0337e`, including review fixes 1–7.
- `npm run check` passed (exit 0, 137 seconds) with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `EXPO_PUBLIC_SUPABASE_ANON_KEY=dummy-test-key`. The first attempt stopped at the Watch test's missing environment variables; the rerun passed lint, typecheck, 169 unit files / 2,955 tests, timezone checks, 121 component suites / 1,138 tests, CI tests, Swift tests, production bundle, fresh local migration application and SQL vectors.
- `npm run e2e:household-timers:clean` passed (exit 0, 1,203 seconds) on SofiBaby Owner and SofiBaby Member with iOS 26.5. Clean install/build, offline reconnect, household pause/resume and member stop, blocked direct release with owner completion, widget/Watch completion assertions, simultaneous stops, date-picker regression and cleanup all completed.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/1e4e3d200eb7/canonical-with-test-env.log` and `household-e2e.log`; the latter is capped during verbose Xcode output. Complete stage artifacts: `e2e/artifacts/household-timers/2026-10-07T08-45-27-514Z/`. `cleanup.log` confirms local cleanup; both simulators shut down.
- Restored the Watch icon metadata and removed its duplicate image generated by clean prebuild. No application changes were needed for validation.
