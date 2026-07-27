# Task 0028: Detect age-aware earlier morning drift

**Branch**: `feature/detect-age-aware-morning-drift`
**Depends on**: 0027
**Source**: Production sleep diagnosis and talk-it-through session 2026-07-26 · **User stories**: caregivers are told when a baby's settled morning has consistently shifted earlier; fragmented nights do not trigger boundary-change suggestions; settings never change without caregiver approval

## What to build

Replace the current morning-drift inference with one based on Task 0027's final resolved morning wakes. A recorded morning supports an earlier-boundary suggestion only when its final wake is at least 60 minutes earlier than configured day start and the first subsequent nap begins after approximately the full age-appropriate first wake window, with 15 minutes of tolerance. This age-aware validation applies only to the first wake window and first nap.

Suggest drift when that behavior occurs on at least 5 of the last 7 recorded mornings. Suggest the median qualifying final wake through the existing drift banner and existing supported boundary-update flow. Never update the boundary automatically. Do not adjust later wake windows, later naps, the final daytime wake window, or bedtime.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Reuse the shared resolved-morning model and existing age-based wake-window definitions rather than adding a second source of truth; prove with lint and typecheck.
- [x] Cover qualifying, fragmented, sparse, and mixed seven-morning histories with deterministic tests, plus the existing banner's accept/dismiss behavior.
- [x] Document the 5-of-7, one-hour, first-nap, age-window, and no-automatic-update rules in the sleep-prediction design documentation.

## Implementation work

- [x] Test-first, build histories that distinguish true early mornings from resumed or fragmented night sleep.
- [x] Compute drift only from final wakes produced by the shared morning resolver.
- [x] Validate only the first nap against the age-appropriate first wake window, allowing it to begin up to 15 minutes early.
- [x] Require at least five qualifying mornings among the last seven recorded mornings and at least a one-hour shift from configured day start.
- [x] Feed the median qualifying final wake into the existing suggestion banner without changing settings automatically.
- [x] Prove that later wake windows and bedtime calculations are unchanged.
- [x] Update sleep-prediction documentation and run focused utility/component tests, then canonical lint and typecheck.

## Acceptance criteria

- [x] A one-off early wake never triggers a morning-boundary suggestion.
- [x] Five qualifying early mornings among the last seven recorded mornings produce a suggestion based on their median final wake.
- [x] A short awake interval followed by more sleep does not count as an earlier morning.
- [x] Age-aware validation reads the baby's existing first wake-window definition and affects only the first nap.
- [x] Accepting or dismissing the suggestion retains existing behavior, and no setting changes automatically.
- [x] Later naps, later wake windows, and bedtime predictions are unchanged.

## Completion record

- **Implementation:** `src/utils/sleepPredictions.ts` now builds the last-seven history from final wakes returned by `resolveMorningSleep()`, reads the first window from `WAKE_WINDOW_PROGRESSIONS`, and suggests the median of at least five qualifying wakes. `src/contexts/sleep-context.tsx` evaluates morning drift independently from model-training eligibility while preserving the prior bedtime-drift gate and existing accept/dismiss flow.
- **Decisions:** A recorded morning without a first nap occupies a history position but cannot qualify. Age selection uses the baby's current age-based progression. No product, database, security, or manual-verification decision was required.
- **TDD:** The first focused test returned `null` instead of the expected 5-of-7 median, then passed after the age-aware detector was implemented. The sparse-history test exposed an older morning leaking into the seven-morning window, then passed after napless recorded mornings were retained. Additional deterministic tests cover resumed night sleep, a one-off wake, the 15-minute tolerance, age differences, and later-day isolation.
- **Repository guidelines:** Implement mode loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, `references/02-testing.md`, and `references/03-documentation.md`. Strict typing and naming are proved by lint and typecheck. Public utility and component tests prove the behavior, and `docs/SLEEP_PREDICTIONS.md` records the inference rules.
- **Review:** Task review against `main` fixed one major finding that incorrectly tied morning drift to model-training days, then one minor finding that broadened bedtime-drift eligibility. The second remediation pass was clean. Security review was skipped because the diff has no relevant trust-boundary surface. No risks were accepted.
- **Documentation:** `docs/SLEEP_PREDICTIONS.md` documents the 5-of-7 threshold, one-hour shift, first-nap age window, 15-minute tolerance, and caregiver approval. `README.md` updates the Sleep Predictions section. Write-well audits completed in four passes for the design document and two passes for the README section.
- **Proof:** Focused runs passed 102 sleep-prediction utility tests and 60 `SleepPredictionCard` component tests. Final `npm run check:code` passed lint, typecheck, 2,276 unit tests, 644 component tests, 103 security tests, 244 sync tests, and 49 CI-contract tests. `git diff --check` passed. The component suite is the highest available automated proof for this React Native banner behavior; no manual check is required.
