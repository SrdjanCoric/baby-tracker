# Task 0034: Require complete profiles for new babies

**Branch**: `feature/require-complete-new-baby-profiles`
**Depends on**: none
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: caregivers provide the profile data Sofi needs for age-aware features; every newly added baby follows the same validation rules; existing baby records remain unchanged

## What to build

Require a name, birth date, and gender whenever a caregiver creates a baby, whether creation starts during onboarding or from the regular Add Baby flow. Keep the existing rules that reject future birth dates and birth dates more than five years ago. Present Gender with the existing Boy and Girl choices, and prevent submission until one is selected.

Apply one shared creation contract across every baby-creation entry point. Do not migrate, prompt for, default, or otherwise alter legacy baby profiles that are already stored with missing fields. Do not add the redesigned onboarding navigation in this task.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`

- [ ] Keep the creation input and validation contract strictly typed and shared across equivalent forms; prove with lint and typecheck.
- [ ] Add meaningful deterministic unit and component tests for every required field, date boundary, and baby-creation entry point; prove with focused tests and the canonical code checks.

## Implementation work

- [ ] Test-first, define a shared complete-new-baby validation contract that requires trimmed name, valid birth date, and gender.
- [ ] Keep future dates and dates more than five years old invalid with localized errors.
- [ ] Update every new-baby form to show required labels, prevent deselecting into an invalid silent state, and surface accessible validation feedback.
- [ ] Keep edit and load behavior for legacy incomplete profiles unchanged and never manufacture a gender or birth date default.
- [ ] Add or update every onboarding translation key touched by validation in all nine locale files.
- [ ] Run focused validator and baby-form tests, then lint, typecheck, unit tests, and component tests.

## Acceptance criteria

- [ ] A baby cannot be created without a nonblank name, birth date, and selected gender from any app entry point.
- [ ] Today is accepted; a future date and a date more than five years ago are rejected with localized feedback.
- [ ] Boy and Girl remain the user-facing gender choices.
- [ ] Existing persisted profiles with missing fields load and behave as they do today without migration or a new prompt.
- [ ] Validation behavior is shared rather than duplicated across creation screens.
- [ ] Automated tests cover successful creation and each blocked submission path.
