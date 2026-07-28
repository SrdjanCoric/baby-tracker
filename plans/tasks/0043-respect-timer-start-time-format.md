# Task 0043: Respect the selected time format when starting timers earlier

**Branch**: `feature/respect-timer-start-time-format`
**Depends on**: none
**Source**: bug report conversation 2026-07-28 · **User stories**: caregivers using 24-hour time see the selected earlier start time in 24-hour format; equivalent timer screens follow the same preference; caregivers using 12-hour time keep the current display

## What to build

Make every timer screen's Started earlier flow honor the current app-level time-format preference. After a caregiver selects an earlier start time, Sleep, Feeding, Pumping, and Tummy Time must display that time through the shared time formatter rather than forcing a US 12-hour representation. The controls must react to the current preference without requiring navigation or reload, preserve existing earlier-time selection and clamping behavior, and avoid forcing a contradictory native-picker format where the picker API supports explicit 12/24-hour configuration.

Manual activity entry, edit screens, Timeline, Statistics, notifications, and exports are excluded because the current audit found that they already use the shared preference-aware formatter or store canonical time values without the duplicated Started earlier display defect.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Use the existing typed time-format context and shared formatter consistently across equivalent timer views; prove with lint and typecheck.
- [ ] Add deterministic behavior-focused component regressions for both 24-hour and 12-hour output on the affected Started earlier flows.
- [ ] Remove the duplicated hardcoded formatting rather than adding another formatter or suppressing static analysis.
- [ ] Run focused tests and the canonical non-device code checks required for the changed UI.

## Implementation work

- [ ] Test-first, reproduce the Sleep Started earlier label showing a 12-hour value while the app preference is 24-hour.
- [ ] Add equivalent regression coverage for Feeding, Pumping, and Tummy Time so the duplicated defect cannot remain or recur on sibling timer screens.
- [ ] Subscribe each affected timer start view to the current time-format preference and format its selected value with the shared time utility.
- [ ] Preserve 12-hour output, earlier-time selection, future-time rollover, date clamping, and iOS Done behavior.
- [ ] Pass the current preference to native time-picker configuration on platforms where the picker API supports an explicit 12/24-hour mode, without replacing the existing safe iOS datetime picker.
- [ ] Audit production code for any remaining Started earlier or custom-start label that hardcodes 12-hour formatting.
- [ ] Run focused component tests, lint, typecheck, and the canonical non-device checks.

## Acceptance criteria

- [ ] With 24-hour time selected, an earlier start such as 14:30 is displayed as `14:30` on Sleep, Feeding, Pumping, and Tummy Time.
- [ ] With 12-hour time selected, the same value is displayed as `2:30 PM` on all four timer screens.
- [ ] Changing the app time-format preference causes affected views to use the current value without requiring an app reload.
- [ ] Selecting an earlier time still starts the timer at the selected timestamp and retains existing date-boundary safeguards.
- [ ] No affected Started earlier label contains a hardcoded `hour12` formatter.
- [ ] Focused component tests, lint, typecheck, and canonical non-device checks pass.
