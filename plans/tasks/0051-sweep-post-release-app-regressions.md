# Task 0051: Sweep adjacent app regressions introduced after July 5

**Branch**: `feature/sweep-post-release-app-regressions`
**Depends on**: 0047, 0048, 0050 (0049 removed by owner decision 2026-08-01; Watch native synchronization is audited by Task 0052)
**Source**: regression-planning conversation 2026-07-31 · **User stories**: the release owner can see which adjacent user-facing behaviors may have regressed after July 5 before prioritizing fixes; maintainers have evidence rather than relying only on already reported symptoms

## What to build

Perform a bounded, risk-based differential audit of user-facing application changes after the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e`, using the imported household snapshot and the evidence or completed fixes from Tasks 0047–0050. Cover changed TypeScript/React Native product surfaces not already resolved by those tasks, including Home, Timeline and deletion/editing, activity entry and history, Statistics and range loading, Health and Growth, sleep views and predictions, onboarding and household restoration, localization, accessibility, and preference-derived presentation. Treat Task 0050's completed-day and fragmented-night summary contract as fixed behavior: do not repeat its historical attribution or rebuild a diagnostic ledger, and inspect only adjacent sleep surfaces not covered by its regression tests.

Inventory post-baseline commits and completed tasks by changed capability rather than treating raw file count as proof. Rank surfaces by user impact, data-loss potential, change density, weak historical coverage, and adjacency to confirmed causes. For each high-risk surface, compare current behavior with July 5 or an explicit post-July intended contract using deterministic automated checks where possible and controlled simulator scenarios where necessary. Existing post-July features should be checked against their approved task behavior rather than automatically labeled regressions merely because they differ from July 5.

Produce a consolidated, privacy-safe regression matrix. Every reviewed surface must be marked exercised, statically reviewed with rationale, already covered by Tasks 0047–0050, deferred with reason and owner decision, or represented by a reproducible finding. Every finding must include severity, affected capability, minimal reproduction, expected basis, likely introduction range, data risk, and recommended next diagnostic or fix task. Do not fix product defects or commit production-derived data in this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [x] Use risk-ranked, deterministic automated and simulator checks with explicit expected bases; do not equate code change with regression without behavioral evidence.
- [x] Publish a navigable matrix covering every scoped capability, commands and evidence, findings, deferrals, and recommended follow-up tasks.
- [x] Leave sufficient version-controlled instructions and privacy-safe fixtures for another contributor to repeat each finding.

## Implementation work

- [x] Build a capability-level inventory of all user-facing changes between the July 5 baseline and audit-start current source, mapping merged tasks, commits, tests, and affected screens or state providers.
- [x] Incorporate confirmed fixes, remaining findings, and uncovered adjacent call sites from Tasks 0047–0050 without repeating resolved attribution work or re-auditing Task 0050's fixed sleep-summary scenarios.
- [x] Rank capabilities by credible data loss, incorrect caregiver decisions, broken primary workflows, historical-data dependence, change density, and missing differential coverage.
- [x] Define a finite audit matrix with explicit expected behavior sourced from July 5 behavior or approved post-July task contracts.
- [x] Run focused unit/component/integration differentials for pure and provider behavior before spending device time.
- [~] Exercise high-risk visual flows with the local household fixture on current and baseline/intended builds, capturing redacted results and exact configuration. — Deferred to the release owner by this task's manual device policy: the agent may build and launch simulators but must not execute E2E interactions or classify device results. Exact steps, expected results, and failure signals are in the matrix's "Manual verification for the release owner" section.
- [x] Check adjacent latest-record selection, history ranges, deletion/editing, aggregate denominators, preference refresh, localization boundaries, accessibility actions, and onboarding restoration where post-July changes touched them.
- [x] Record every scoped capability as exercised, statically reviewed, previously covered, deferred, or a reproducible finding; do not leave silent gaps.
- [x] For every finding, state severity, regression/pre-existing/contract classification, minimal reproduction, likely introduction range, data risk, and recommended follow-up task boundary.
- [x] Publish the matrix, remove temporary instrumentation and raw artifacts, and run applicable canonical documentation and test checks.

## Implementation record

**Deliverables**
- `docs/post-july-app-regression-audit.md` — the regression matrix: scope, exclusions with owning task, method, baseline suite state, 23-row capability matrix, 3 findings, repeatability commands, owner verification checklist.
- `scripts/audit/export-range-coverage.mjs` — structural probe that reproduces finding F-1 from committed source alone, with no database, simulator, or production-derived fixture. Exits 1 while the defect is present and 0 once every range-reading consumer resolves its range, so the eventual fix can be confirmed with it.
- `scripts/audit/locale-key-parity.mjs` — version-controlled locale key differential across all 9 locales; reproduces finding F-2. Neither script is wired into any npm script or CI workflow, so their non-zero exits gate nothing.

**Baseline and scope**: baseline `cdbbb1e` (2026-07-05) to audit head `73100d6` (2026-08-01); 258 commits repo-wide with 63 touching `src/`/`app/`, 283 changed files under `src/`/`app/` (+33,623 / −7,156), 114 of them tests.

**Audit approach**: capability inventory from git plumbing, then five isolated risk-ranked differential passes (range/statistics loading; Timeline deletion/editing/latest-record; adjacent sleep surfaces; preferences/accessibility/onboarding; export/reports/health/growth/milestones/account). Every claimed finding was re-verified in the parent against the actual code path and the baseline revision before being recorded — one agent-reported finding was materially narrowed by that check (see F-1 below).

**Findings**
- **F-1 (high, regression)** — Export (CSV) and reports (PDF) silently omit records older than the locally cached window. Introduced by `c1b9cc1` (2026-07-27). Seven per-collection fetches cap the initial pull at 1,000 records with no pagination loop, while export/reports read AsyncStorage directly and never resolve the selected range through `fetchActivityRangeFromDatabase` (which paginates correctly). The pre-export record count is drawn from the same truncated cache, so it confirms the wrong number. No data is destroyed — `commitPulledRecentCollection` merges rather than replaces. The 1,000-row cap is itself intended and documented at `README.md:43`, which states that surfaces request the ranges they display; export and reports are the only scoped historical-data consumers absent from that contract. Planned as Task 0053, scoped to the export/report path only.
- **F-2 (low, pre-existing)** — `pt-PT` lacks `foods.cereal` and carries orphan `foods.cereais`; three feeding screens fall back to English. Predates the baseline (`6144e30`, 2026-05-16), so not a regression. Follow-up: rename the key; optionally gate `check:code` on the parity script.
- **F-3 (low, new-code gap)** — Four `Pressable` controls in `ReturningUserProfileFallback.tsx` have no accessibility label or role. Component postdates the baseline (Task 0039), so not a regression. Follow-up: label those four controls; a broader accessibility sweep would be its own task.

**Known limitation**: F-1's *code path* is reproducible from the repository via the committed probe, but its *user-visible symptom* still needs either the release owner's local household snapshot or a hand-built collection of more than 1,000 records. No committed fixture reaches that size. Committing a synthetic high-volume seed would close the gap; it is recommended to the owner as an E2E-fixture change rather than made here, and is listed in the matrix's owner checklist.

**Verified non-regressions**: adjacent sleep surfaces, Timeline deletion and tombstone read path, activity range and statistics loading with baby scoping, preference-derived presentation, and onboarding/household restoration all passed. Post-July differences trace to approved contracts (0033, 0034, 0036–0045, 0050, age-aware morning drift, overlap warning) and are recorded as intended rather than flagged. Post-July localization is clean: 115 new `en` keys, all translated across all 9 locales.

**Decisions**: none required escalation. No `[decision]`, `[confirm-db]`, or `[confirm-security]` items were declared and no unexpected out-of-task obstacle arose.

**Automated proof**: full canonical `check:code` chain green at the audit head before any audit change (lint, typecheck, unit 2,459, component 778, security 13, sync 20, ci, production-gating), establishing that no finding is explained by a pre-existing suite failure. `git diff --check` clean; `node scripts/audit/export-range-coverage.mjs` reproduces F-1 and `node scripts/audit/locale-key-parity.mjs` reproduces F-2, both from committed source with no external state.

**Review**: one `task-review-compact` panel (Standards, Spec, Bug, Security) over `main...HEAD`. Security returned no findings. The other three lenses returned 14 unique findings after dedupe, all non-security and all attributable to this diff; every one was remediated in a single batch. The substantive ones were real defects in the deliverable rather than cosmetic: the stated way to load the reproduction fixture did not work (no committed code path reads `household.json`, and the cited command seeds a different, much smaller fixture); F-1's primary code citation pointed at a function the export screen never calls; Home and the activity edit screens had no matrix row; F-2 and F-3 were missing required per-finding fields; and three recorded figures were wrong — 115 test files (114), an absolute "no key equals its English source" claim (one Italian key does), and a 258-commit headline paired with a command returning 63. Remediation added the `export-range-coverage.mjs` probe so F-1 no longer depends on an uncommitted fixture.

**README disposition**: unchanged, no documentation impact. The task changed no application behavior, setup, configuration, or usage — it publishes an audit report and two read-only probes. `README.md:43` already documents the 1,000-row startup cap as intended behavior, and the audit cites it as F-1's expected basis rather than revising it; correcting the export path is the follow-up task's work, not this one's. The existing precedent audit (`docs/tombstone-read-path-audit.md`) is likewise not linked from README, so no index entry was added. `write-well` was therefore not invoked, as no README prose changed.

**Final validation**: `npm run check:code` green at the post-remediation head (lint, typecheck, unit 128 files/2,459 tests, component 80 suites/778 tests, security 13, sync 20, ci, production-gating). One intermediate failure was found and fixed during remediation: the new probes initially used the `URL` global, which `no-undef` rejects for `scripts/*.mjs`; both were switched to the `dirname(fileURLToPath(import.meta.url))` pattern already used by `scripts/check-development-tools-production-bundle.mjs`, and both still resolve correctly from any working directory.

**Privacy**: no production-derived data, account identifier, or raw export is committed. The household snapshot at `e2e/artifacts/reproduction/household.json` is gitignored and stays local; the matrix states that F-1 reproduces with any baby exceeding 1,000 records in one collection, so the snapshot is not required to repeat it.

## Human checkpoints

**Manual device policy**: The agent may prepare, build, and launch iOS, Watch, or Android simulators, but must not execute Maestro or other E2E interactions or assertions. The release owner performs and classifies every device/E2E scenario.

- [ ] [verify] Review the completed regression matrix and manually spot-check each critical/high user-facing finding in the simulator using the imported household fixture · Expected: findings reproduce as documented and every omitted surface has an explicit rationale · Failure: a critical finding cannot be reproduced, expected behavior lacks a source, or a changed capability is silently unassessed · Reason: prioritization and visual confirmation across a broad product surface require release-owner judgment.

## Acceptance criteria

- [ ] Every scoped post-July user-facing capability is mapped to its commits/tasks and classified as exercised, statically reviewed, already covered, deferred, or a finding.
- [ ] Differences from July 5 that implement approved post-July behavior are not mislabeled as regressions.
- [ ] Every reported new issue has a minimal reproduction, expected basis, severity, likely introduction range, and recommended follow-up boundary.
- [ ] Critical and high findings are manually spot-checked against the local household fixture.
- [ ] The matrix is privacy-safe, repeatable, and contains no product fixes, source account identifier, or production-derived raw data.
