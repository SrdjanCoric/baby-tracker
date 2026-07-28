# Task 0033: Prevent duplicate bedtime predictions after evening night sleep

**Branch**: `feature/prevent-duplicate-bedtime-predictions`
**Depends on**: none
**Source**: Production bug diagnosis captured in `handoffs/feature/load-requested-statistics-ranges/completed-evening-night-sleep-shows-overdue-bedtime.md` · **User stories**: caregivers see a completed evening night sleep reflected as nighttime rather than another overdue bedtime; caregivers continue to receive legitimate overdue predictions and normal next-morning guidance

## What to build

Correct the sleep prediction card state after a completed sleep has been classified as the current evening's night sleep. With night starting at 21:00, a sleep from 20:30 to 23:20 must remain stored as `night`, and stopping it must leave the dashboard in its calm Bedtime/Nighttime state instead of treating 23:20 as a new daytime wake, calculating another bedtime against the same evening's anchor, and displaying `Bedtime … ago`.

Keep this correction at the card's prediction-role/state boundary. Do not change duration-based sleep classification, persisted sleep rows, the bedtime model or cap globally, morning-sleep resolution, wake-window calculations, or the valid overdue treatment for genuine nap and bedtime predictions. Date-sensitive state must reevaluate through the card's existing clock transitions so the completed evening sleep cannot suppress normal tracking or predictions the next morning.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [x] Keep the evening-night role/state logic strictly typed, warning-free, and consistent with existing sleep-domain naming; prove with lint and typecheck.
- [x] Add a deterministic component regression at the real card seam using the production duration classifier and fake-clock transitions; preserve tests for legitimate overdue predictions.
- [x] Update the authoritative sleep-prediction documentation and relevant README summary with the completed-evening-night state rule and transition behavior.

## Implementation work

- [x] Test-first, reproduce a 20:30–23:20 sleep with day end 21:00 and median bedtime 22:00, using `classifySleepByTimeRange` to prove the persisted role is `night`; assert that the card does not render `Bedtime … ago`.
- [x] Make the card recognize a completed current-evening night sleep before it enters next-sleep prediction, while retaining the existing calm Bedtime/Nighttime presentation.
- [x] Prove the time-sensitive state expires across midnight and the existing morning threshold so next-day tracking or predictions resume without navigation or a sleep-data mutation.
- [x] Preserve legitimate overdue nap and bedtime output and existing morning-resolution, wake-window, and bedtime-model behavior.
- [x] Update `docs/SLEEP_PREDICTIONS.md` and the relevant README sleep-prediction summary.
- [x] Run focused sleep-prediction utility and component tests, then the canonical lint, typecheck, and code checks.

## Acceptance criteria

- [x] A 20:30–23:20 sleep with night starting at 21:00 remains classified and persisted as `night`.
- [x] Immediately after that session stops, the prediction card shows the calm Bedtime/Nighttime state and never another overdue bedtime for the same evening.
- [x] The evening-night state is date-bounded and does not suppress the next morning's track-sleep prompt or valid next-sleep prediction.
- [x] Genuine overdue nap and bedtime predictions retain their current behavior.
- [x] Sleep history, duration classification, prediction-model anchors and caps, morning resolution, and wake-window calculations are otherwise unchanged.
- [x] Automated regression coverage exercises the production classification and card-state path with deterministic clock transitions.

## Completion record

- **Implementation**: `src/components/SleepPredictionCard.tsx` now recognizes the latest completed `night` session when it ends after the current date's configured day-end boundary. The existing midnight and morning-anchor clock updates clear this card state without changing sleep records or prediction calculations.
- **Tests**: `src/components/SleepPredictionCard.component.test.tsx` covers the 20:30–23:20 production interval through `classifySleepByTimeRange`, the calm Bedtime result, midnight and morning-anchor transitions, and genuine overdue nap and bedtime output.
- **TDD evidence**: The first focused run failed with `Bedtime 35m ago` and 1 failed test out of 61. The state guard made the regression green. Transition and overdue-preservation characterizations then passed, ending with 63 passing card tests.
- **Guidelines**: Implement and review modes loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, `references/02-testing.md`, and `references/03-documentation.md`. Evidence is the strict card-state implementation, deterministic fake-clock component tests, `npm run lint`, `npm run typecheck`, and the documentation updates.
- **Documentation**: `docs/SLEEP_PREDICTIONS.md` and the README Sleep Predictions section describe the completed-evening rule and its midnight-to-morning transition. Each affected section passed two `write-well` audit passes.
- **Review**: `task-review` checked `2751523` against `main` with Standards, Spec, and Bug lenses. It found no supported issues, required no remediation pass, and skipped Security because the diff has no relevant trust-boundary surface.
- **Proof**: Focused utility tests passed 193 tests; the final card run passed 63 tests. `npm run check:code` passed lint, strict typecheck, 2,310 unit tests, 667 component tests, 103 security tests, 244 sync tests, and 41 CI contract tests.
- **Manual verification**: Not required. The deterministic component test exercises the user-visible card, production classifier, and clock transitions at the highest available automated seam.
- **Security risks**: None found or accepted.
