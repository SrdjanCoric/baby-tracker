# Task 0051: Sweep adjacent app regressions introduced after July 5

**Branch**: `feature/sweep-post-release-app-regressions`
**Depends on**: 0047, 0048, 0049, 0050
**Source**: regression-planning conversation 2026-07-31 · **User stories**: the release owner can see which adjacent user-facing behaviors may have regressed after July 5 before prioritizing fixes; maintainers have evidence rather than relying only on already reported symptoms

## What to build

Perform a bounded, risk-based differential audit of user-facing application changes after the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e`, using the imported household snapshot and the feedback loops established by Tasks 0047–0050. Cover changed TypeScript/React Native product surfaces not already resolved by those diagnoses, including Home, Timeline and deletion/editing, activity entry and history, Statistics and range loading, Health and Growth, sleep views and predictions, onboarding and household restoration, localization, accessibility, and preference-derived presentation.

Inventory post-baseline commits and completed tasks by changed capability rather than treating raw file count as proof. Rank surfaces by user impact, data-loss potential, change density, weak historical coverage, and adjacency to confirmed causes. For each high-risk surface, compare current behavior with July 5 or an explicit post-July intended contract using deterministic automated checks where possible and controlled simulator scenarios where necessary. Existing post-July features should be checked against their approved task behavior rather than automatically labeled regressions merely because they differ from July 5.

Produce a consolidated, privacy-safe regression matrix. Every reviewed surface must be marked exercised, statically reviewed with rationale, already covered by Tasks 0047–0050, deferred with reason and owner decision, or represented by a reproducible finding. Every finding must include severity, affected capability, minimal reproduction, expected basis, likely introduction range, data risk, and recommended next diagnostic or fix task. Do not fix product defects or commit production-derived data in this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Use risk-ranked, deterministic automated and simulator checks with explicit expected bases; do not equate code change with regression without behavioral evidence.
- [ ] Publish a navigable matrix covering every scoped capability, commands and evidence, findings, deferrals, and recommended follow-up tasks.
- [ ] Leave sufficient version-controlled instructions and privacy-safe fixtures for another contributor to repeat each finding.

## Implementation work

- [ ] Build a capability-level inventory of all user-facing changes between the July 5 baseline and audit-start current source, mapping merged tasks, commits, tests, and affected screens or state providers.
- [ ] Incorporate the confirmed causes, discarded hypotheses, harnesses, and uncovered adjacent call sites from Tasks 0047–0050 without repeating disproven work.
- [ ] Rank capabilities by credible data loss, incorrect caregiver decisions, broken primary workflows, historical-data dependence, change density, and missing differential coverage.
- [ ] Define a finite audit matrix with explicit expected behavior sourced from July 5 behavior or approved post-July task contracts.
- [ ] Run focused unit/component/integration differentials for pure and provider behavior before spending device time.
- [ ] Exercise high-risk visual flows with the local household fixture on current and baseline/intended builds, capturing redacted results and exact configuration.
- [ ] Check adjacent latest-record selection, history ranges, deletion/editing, aggregate denominators, preference refresh, localization boundaries, accessibility actions, and onboarding restoration where post-July changes touched them.
- [ ] Record every scoped capability as exercised, statically reviewed, previously covered, deferred, or a reproducible finding; do not leave silent gaps.
- [ ] For every finding, state severity, regression/pre-existing/contract classification, minimal reproduction, likely introduction range, data risk, and recommended follow-up task boundary.
- [ ] Publish the matrix, remove temporary instrumentation and raw artifacts, and run applicable canonical documentation and test checks.

## Human checkpoints

- [ ] [verify] Review the completed regression matrix and manually spot-check each critical/high user-facing finding in the simulator using the imported household fixture · Expected: findings reproduce as documented and every omitted surface has an explicit rationale · Failure: a critical finding cannot be reproduced, expected behavior lacks a source, or a changed capability is silently unassessed · Reason: prioritization and visual confirmation across a broad product surface require release-owner judgment.

## Acceptance criteria

- [ ] Every scoped post-July user-facing capability is mapped to its commits/tasks and classified as exercised, statically reviewed, already covered, deferred, or a finding.
- [ ] Differences from July 5 that implement approved post-July behavior are not mislabeled as regressions.
- [ ] Every reported new issue has a minimal reproduction, expected basis, severity, likely introduction range, and recommended follow-up boundary.
- [ ] Critical and high findings are manually spot-checked against the local household fixture.
- [ ] The matrix is privacy-safe, repeatable, and contains no product fixes, source account identifier, or production-derived raw data.
