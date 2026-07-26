# Task 0028: Detect age-aware earlier morning drift

**Branch**: `feature/detect-age-aware-morning-drift`
**Depends on**: 0027
**Source**: Production sleep diagnosis and talk-it-through session 2026-07-26 · **User stories**: caregivers are told when a baby's settled morning has consistently shifted earlier; fragmented nights do not trigger boundary-change suggestions; settings never change without caregiver approval

## What to build

Replace the current morning-drift inference with one based on Task 0027's final resolved morning wakes. A recorded morning supports an earlier-boundary suggestion only when its final wake is at least 60 minutes earlier than configured day start and the first subsequent nap begins after approximately the full age-appropriate first wake window, with 15 minutes of tolerance. This age-aware validation applies only to the first wake window and first nap.

Suggest drift when that behavior occurs on at least 5 of the last 7 recorded mornings. Suggest the median qualifying final wake through the existing drift banner and existing supported boundary-update flow. Never update the boundary automatically. Do not adjust later wake windows, later naps, the final daytime wake window, or bedtime.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [ ] Reuse the shared resolved-morning model and existing age-based wake-window definitions rather than adding a second source of truth; prove with lint and typecheck.
- [ ] Cover qualifying, fragmented, sparse, and mixed seven-morning histories with deterministic tests, plus the existing banner's accept/dismiss behavior.
- [ ] Document the 5-of-7, one-hour, first-nap, age-window, and no-automatic-update rules in the sleep-prediction design documentation.

## Implementation work

- [ ] Test-first, build histories that distinguish true early mornings from resumed or fragmented night sleep.
- [ ] Compute drift only from final wakes produced by the shared morning resolver.
- [ ] Validate only the first nap against the age-appropriate first wake window, allowing it to begin up to 15 minutes early.
- [ ] Require at least five qualifying mornings among the last seven recorded mornings and at least a one-hour shift from configured day start.
- [ ] Feed the median qualifying final wake into the existing suggestion banner without changing settings automatically.
- [ ] Prove that later wake windows and bedtime calculations are unchanged.
- [ ] Update sleep-prediction documentation and run focused utility/component tests, then canonical lint and typecheck.

## Acceptance criteria

- [ ] A one-off early wake never triggers a morning-boundary suggestion.
- [ ] Five qualifying early mornings among the last seven recorded mornings produce a suggestion based on their median final wake.
- [ ] A short awake interval followed by more sleep does not count as an earlier morning.
- [ ] Age-aware validation reads the baby's existing first wake-window definition and affects only the first nap.
- [ ] Accepting or dismissing the suggestion retains existing behavior, and no setting changes automatically.
- [ ] Later naps, later wake windows, and bedtime predictions are unchanged.
