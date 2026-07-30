# Task 0043: Respect the selected time format when starting timers earlier

**Branch**: `feature/respect-timer-start-time-format`
**Depends on**: none
**Source**: bug report conversation 2026-07-28 · **User stories**: caregivers using 24-hour time see the selected earlier start time in 24-hour format; equivalent timer screens follow the same preference; caregivers using 12-hour time keep the current display

## What to build

Make every timer screen's Started earlier flow honor the current app-level time-format preference. After a caregiver selects an earlier start time, Sleep, Feeding, Pumping, and Tummy Time must display that time through the shared time formatter rather than forcing a US 12-hour representation. The controls must react to the current preference without requiring navigation or reload, preserve existing earlier-time selection and clamping behavior, and avoid forcing a contradictory native-picker format where the picker API supports explicit 12/24-hour configuration.

Manual activity entry, edit screens, Timeline, Statistics, notifications, and exports are excluded because the current audit found that they already use the shared preference-aware formatter or store canonical time values without the duplicated Started earlier display defect.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Use the existing typed time-format context and shared formatter consistently across equivalent timer views; prove with lint and typecheck.
- [x] Add deterministic behavior-focused component regressions for both 24-hour and 12-hour output on the affected Started earlier flows.
- [x] Remove the duplicated hardcoded formatting rather than adding another formatter or suppressing static analysis.
- [x] Run focused tests and the canonical non-device code checks required for the changed UI.

## Implementation work

- [x] Test-first, reproduce the Sleep Started earlier label showing a 12-hour value while the app preference is 24-hour.
- [x] Add equivalent regression coverage for Feeding, Pumping, and Tummy Time so the duplicated defect cannot remain or recur on sibling timer screens.
- [x] Subscribe each affected timer start view to the current time-format preference and format its selected value with the shared time utility.
- [x] Preserve 12-hour output, earlier-time selection, future-time rollover, date clamping, and iOS Done behavior.
- [x] Pass the current preference to native time-picker configuration on platforms where the picker API supports an explicit 12/24-hour mode, without replacing the existing safe iOS datetime picker.
- [x] Audit production code for any remaining Started earlier or custom-start label that hardcodes 12-hour formatting.
- [x] Run focused component tests, lint, typecheck, and the canonical non-device checks.

## Acceptance criteria

- [x] With 24-hour time selected, an earlier start such as 14:30 is displayed as `14:30` on Sleep, Feeding, Pumping, and Tummy Time.
- [x] With 12-hour time selected, the same value is displayed as `2:30 PM` on all four timer screens.
- [x] Changing the app time-format preference causes affected views to use the current value without requiring an app reload.
- [x] Selecting an earlier time still starts the timer at the selected timestamp and retains existing date-boundary safeguards.
- [x] No affected Started earlier label contains a hardcoded `hour12` formatter.
- [x] Focused component tests, lint, typecheck, and canonical non-device checks pass.

## Completion record

- **Implementation**: `app/{sleep,feeding,pumping,tummyTime}/index.tsx` now subscribes to `useTimeFormat`, renders custom starts with the shared `formatTime`, and sets Android `is24Hour` from the current preference. Existing iOS datetime mode, Done dismissal, and date bounds remain in place.
- **Tests**: component regressions cover reactive `14:30` and `2:30 PM` labels on all four screens, selected-timestamp forwarding, Android picker configuration, Android future-time rollover, and iOS bounds and Done dismissal. The initial focused run failed only on the four missing 24-hour labels; the implementation run passed 30 tests, and review closure passed 36 tests.
- **Audit**: no production Started earlier or custom-start label retains `formatCustomTime`, `toLocaleTimeString("en-US")`, or `hour12: true`. The four Android pickers all receive preference-aware `is24Hour` values.
- **Guidelines**: loaded `00-overview`, `01-style-and-code-quality`, `02-testing`, `06-code-health-and-maintainability`, and `10-definition-of-done`. Typed reuse, deterministic public-behavior tests, duplicate removal, lint, typecheck, and canonical validation are complete; unrelated dependency and bundle-health work was not applicable to this task.
- **Review**: one `task-review-compact` panel found missing picker and selected-timestamp coverage. One remediation batch added that coverage, targeted verification passed, no security lens was required for this UI-only diff, and no full review was recommended.
- **Documentation**: README `Timer Exclusivity` now documents preference-aware Started earlier labels and Android pickers. The affected prose passed one clean `write-well` audit pass.
- **Proof**: `npm run lint` and `npm run typecheck` passed independently. `npm run check:code` passed lint, typecheck, 2,445 unit tests, 756 component tests, 110 security tests, 244 sync tests, 41 CI contract tests, and production-bundle gating. Automated component coverage provides the required highest-level proof; no separate manual verification is needed.
- **Decisions and risks**: no task decision or unexpected obstacle required user input. No security risk was found or accepted.
