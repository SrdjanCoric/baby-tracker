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
duplicate version.

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

- [ ] `hotfix/4.9` is merged into the branch with every conflict resolved per the table, and both
      lines' unit and component suites pass — proven in `src/services/active-timer-service.test.ts`,
      `src/components/BoundedAndroidDateTimePicker.component.test.tsx`, and
      `src/__tests__/external-timer-stop-providers.integration.test.tsx`.
- [ ] `main`'s three migrations carry numbers 066–068 with unchanged contents, and every reference
      names the new numbers; a fresh local database applies 001–068 — proven in
      `scripts/sql/active-timer-authorization-tests.sql`,
      `scripts/sql/active-timer-completion-tests.sql`, and
      `scripts/sql/live-activity-push-token-tests.sql`.
- [ ] The household device runner keeps both scenarios complete and in sequence — proven in
      `e2e/scripts/run-household-timers.mjs`.

## Human checkpoints

- [ ] [verify] Run `npm run e2e:household-timers:clean` on the merged branch with two iOS
      simulators and local Supabase. · Expected: both scenarios pass and cleanup completes. ·
      Failure: any Maestro, assertion, or cleanup failure. · Reason: needs booted simulators,
      Maestro, and Docker, which the implementing agent may lack.

## Acceptance criteria

- [ ] `npm run check` passes on the merged branch, with Docker running.
- [ ] `npm run audit:dependencies` passes.
- [ ] The repository holds exactly one migration per number from 001 to 068.
- [ ] `git log` shows `hotfix/4.9` at `57b1a96` as a parent of the merge, and `main`'s history is
      unchanged below it.
