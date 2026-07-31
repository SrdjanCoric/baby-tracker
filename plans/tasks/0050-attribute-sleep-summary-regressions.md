# Task 0050: Attribute sleep-summary regressions

**Branch**: `feature/attribute-sleep-summary-regressions`
**Depends on**: 0047
**Source**: regression-planning conversation 2026-07-31 · **User stories**: caregivers can trust Past 7 Days total-sleep and bedtime averages; maintainers can see exactly which sleep days and nights entered each calculation and whether current behavior regressed after July 5

## What to build

Diagnose two reported sleep Statistics failures against the imported household snapshot on the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e` and the current implementation at audit start: an incomplete current sleep day lowers average total sleep, and Past 7 Days average bedtime is inconsistent with the observed nights, where only one bedtime occurred after 11 PM and the others occurred before 10 PM.

Create a privacy-safe, time-shifted reproduction preserving durations, sleep types, ordering, configured day-start/day-end boundaries, and midnight relationships without committing production timestamps or names. Produce a calculation ledger for each implementation that lists the requested interval, every candidate sleep, union/split result, sleep-day key, completeness state, selected bedtime and wake time per night, denominator, circular-time inputs, and final displayed values. Check for an unintended eighth date, current incomplete day/night inclusion, night misclassification, fragmented-night selection, timezone conversion, and arithmetic behavior around midnight.

Build deterministic tests or diagnostic harnesses with pinned `now`, timezone, locale, and configuration, then identify whether each symptom is post-July 5, pre-existing, data-specific, or an unresolved expectation. Locate the first causal commit when a post-July 5 differential exists. Produce diagnosis and exact future acceptance examples only; do not modify sleep-summary behavior in this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Use deterministic, time-zone-controlled calculations with real assertions over interval boundaries, incomplete periods, fragmented nights, and circular bedtime arithmetic.
- [ ] Document a redacted calculation ledger, baseline/current comparison, regression classification, causal evidence, and future proof without committing production-derived personal timestamps.
- [ ] Leave root commands and fixtures sufficient for a fresh contributor to reproduce every reported value locally.

## Implementation work

- [ ] Import and verify the household snapshot, then derive an ignored or safely time-shifted fixture that preserves the reported seven-day sleep relationships without personal timestamps.
- [ ] Pin current time, timezone, locale, day-start hour, day-end hour, selected summary period, and time format for baseline/current comparisons.
- [ ] Reproduce both displayed Statistics values on current code before testing causes.
- [ ] Generate a calculation ledger from raw sleeps through overlap union, boundary splitting, sleep-day and night grouping, period filtering, denominator selection, circular mean, and display formatting.
- [ ] Prove whether the requested Past 7 Days period includes exactly seven intended sleep days or an extra boundary date.
- [ ] Show separately how including or excluding the current incomplete sleep day changes total, night, and nap averages.
- [ ] Verify which start is selected as bedtime for every fragmented night and whether before/after-midnight times enter one circular mean correctly.
- [ ] Compare the ledger with July 5 behavior and use bounded bisection to identify the first causal post-July 5 commit when outputs differ.
- [ ] Classify each reported issue and define precise completed-day, completed-night, range, and bedtime examples for later fix tasks.
- [ ] Publish a privacy-safe diagnosis and run focused sleep-pattern, statistics-range, timezone, component, and canonical checks.

## Human checkpoints

**Manual device policy**: The agent may prepare, build, and launch iOS, Watch, or Android simulators, but must not execute Maestro or other E2E interactions or assertions. The release owner performs and classifies every device/E2E scenario.

- [ ] [verify] Open Past 7 Days Sleep Statistics in the July 5 and current simulator builds using the imported fixture and compare the visible total-sleep average and average bedtime with the audit ledger · Expected: displayed values and included nights match the recorded baseline/current calculations · Failure: values differ from the ledger or a production night cannot be represented by the privacy-safe fixture · Reason: final screen configuration and visual period selection require human confirmation.

## Acceptance criteria

- [ ] Both reported Statistics values reproduce deterministically or are unresolved with the exact missing evidence named.
- [ ] A privacy-safe ledger accounts for every sleep, day/night classification, boundary split, included date, denominator, bedtime input, and final displayed value.
- [ ] The audit proves whether the current incomplete day, an eighth boundary date, fragmented sleep, timezone handling, or circular arithmetic contributes to either symptom.
- [ ] Each symptom has baseline/current evidence and a regression, pre-existing, data-specific, expectation, or unresolved classification.
- [ ] Confirmed regressions identify the first causal commit when technically determinable and later fix tasks receive exact acceptance examples.
- [ ] No sleep-summary fix or production-derived personal timestamp is committed.
