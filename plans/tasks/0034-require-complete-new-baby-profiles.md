# Task 0034: Require complete profiles for new babies

**Branch**: `feature/require-complete-new-baby-profiles`
**Depends on**: none
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: caregivers provide the profile data Sofi needs for age-aware features; every newly added baby follows the same validation rules; existing baby records remain unchanged

## What to build

Require a name, birth date, and gender whenever a caregiver creates a baby, whether creation starts during onboarding or from the regular Add Baby flow. Keep the existing rules that reject future birth dates and birth dates more than five years ago. Present Gender with the existing Boy and Girl choices, and prevent submission until one is selected.

Apply one shared creation contract across every baby-creation entry point. Do not migrate, prompt for, default, or otherwise alter legacy baby profiles that are already stored with missing fields. Do not add the redesigned onboarding navigation in this task.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`

- [x] Keep the creation input and validation contract strictly typed and shared across equivalent forms; prove with lint and typecheck.
- [x] Add meaningful deterministic unit and component tests for every required field, date boundary, and baby-creation entry point; prove with focused tests and the canonical code checks.

## Implementation work

- [x] Test-first, define a shared complete-new-baby validation contract that requires trimmed name, valid birth date, and gender.
- [x] Keep future dates and dates more than five years old invalid with localized errors.
- [x] Update every new-baby form to show required labels, prevent deselecting into an invalid silent state, and surface accessible validation feedback.
- [x] Keep edit and load behavior for legacy incomplete profiles unchanged and never manufacture a gender or birth date default.
- [x] Add or update every onboarding translation key touched by validation in all nine locale files.
- [x] Run focused validator and baby-form tests, then lint, typecheck, unit tests, and component tests.

## Acceptance criteria

- [x] A baby cannot be created without a nonblank name, birth date, and selected gender from any app entry point.
- [x] Today is accepted; a future date and a date more than five years ago are rejected with localized feedback.
- [x] Boy and Girl remain the user-facing gender choices.
- [x] Existing persisted profiles with missing fields load and behave as they do today without migration or a new prompt.
- [x] Validation behavior is shared rather than duplicated across creation screens.
- [x] Automated tests cover successful creation and each blocked submission path.

## Completion record

- **Implementation**: `src/validators/baby.ts` defines the shared complete-profile validator and parsed `CompleteNewBabyProfile` type. `CreateBabyInput` extends that contract. `src/components/BabyProfileForm.tsx` applies it only in create mode, while `app/onboarding/baby.tsx` applies the same validation after name sanitization. Creation forms use required labels, radio semantics, alert feedback, and non-deselecting gender choices. Edit mode remains permissive for stored profiles without birth date or gender.
- **Translations**: All nine files under `src/i18n/locales/` include the required birth-date, invalid-date, and gender errors. Onboarding gender labels no longer say optional.
- **Tests**: `src/validators/baby.test.ts` covers required fields, invalid dates, trimming, and today's boundary alongside the existing future, five-year, and too-old cases. `src/components/BabyProfileForm.component.test.tsx` covers blocked and successful regular creation plus legacy incomplete editing. `app/onboarding/baby.component.test.tsx` covers blocked and successful onboarding creation, including a name that sanitizes to blank. Locale completeness and direct storage, sync, and provider creation fixtures use the complete contract.
- **TDD evidence**: RED runs observed the missing shared validator, absent birth-date and gender errors, an accepted invalid `Date`, four strict-type errors after making creation fields required, missing accessible name feedback, incomplete onboarding validation, and the post-sanitization blank-name path. Each slice passed its focused Vitest, Jest, or typecheck command after the minimum implementation, followed by refactoring to the shared parsed type.
- **Guidelines**: Implement and review modes loaded `references/00-overview.md`, `references/01-style-and-code-quality.md`, and `references/02-testing.md`. Evidence is the shared discriminated validation result, `CreateBabyInput` inheritance, deterministic public-interface tests, warning-free lint, strict typecheck, and canonical code gate.
- **Documentation**: README inspected after review. No section covers baby-profile form rules, so it remains unchanged; adding an isolated validation note would not improve its architecture, setup, testing, or release guidance. No prose audit was needed because no README text changed.
- **Review**: `task-review` checked implementation head `3494893` against `main` with Standards, Spec, Bug, and Security lenses. One remediation pass fixed post-validation sanitization that could create a blank onboarding name and updated stale incomplete creation fixtures. The second pass found no remaining issues. Security reviewed the changed input handling and found no exploitable trust-boundary issue.
- **Proof**: Focused remediation checks passed 66 unit tests and 22 component/integration tests. `npm run check:code` passed lint, strict typecheck, 2,322 unit tests, 673 component/integration tests, 103 security tests, 244 sync tests, and 41 CI contract tests.
- **Manual verification**: Not required. Deterministic component tests exercise both user-facing creation forms and legacy edit behavior at the highest available automated seam.
- **Decisions and obstacles**: No product or architecture decision was needed. The review-discovered sanitization ordering defect stayed within the task's nonblank-name contract and was fixed without changing scope.
- **Security risks**: None found or accepted.
