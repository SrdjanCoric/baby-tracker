# Task 0118: Delete tests that only test themselves

**Branch**: `feature/delete-self-testing-tests`
**Depends on**: 0117
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/test-audit.md`, section 7) · **User stories**: when a test fails before deploy, it means something a user can hit broke.

## What to build

Remove tests whose code under test is a fake or a copy written inside the test, or that only pin source text, and tests that no runner ever executes. Production code doesn't change. Language coverage is kept by one test.

| Kind | Examples from the audit | Action |
| --- | --- | --- |
| Tests of a fake or copy defined in the test file | feeding, sleep, diaper, theme, caregiver and sync "flow" integration tests; household and sync context unit tests; timer-sync, service-unavailability and sync edge-case tests; household-isolation security test | Delete |
| Source-text pinning that guards nothing real | morning-classification migration security test; native resume and watch morning-confirmation wiring tests; most cases of the widget-snapshot and watch-summary wiring tests (keep the one real guard in each); package-scripts text pinning | Delete those cases |
| Never run before deploy | the baby-selection UI test no runner matches; the multi-user E2E suite and the E2E flows and helpers it and others point at that don't exist or are debug-only | Delete |
| "Key exists" checks for single screens | 7 i18n files | Replace with one test: every English key exists in all 8 other languages with the same placeholders |

## Decided

- Waste tests are deleted, not rewritten. — Owner request 2026-10-08.
- Keys missing in a language today are listed by name in the new test as known gaps; the list may only shrink. — Keeps the test green without writing translations in this task.
- A test is kept if it is the only guard of a user-visible behavior, even if mock-heavy; those are upgraded by other tasks. — Avoids losing coverage.

## Clarifications

## Non-goals

- Test files the gap tasks rewrite: BabySelector, Home tab, DashboardCard, widget context, timer-stop coordinator, active-timer service, sleep and pumping storage, external-timer-stop providers, activity-provider baby binding, push handler tests.
- Wiring valuable tests that never run (the live import test, tooling tests missing from `test:ci`, the stale edge-timer script) into the deploy gate. Separate future work.
- Writing missing translations the new language test finds.

## Context

The audit counted about 90 cases testing fakes, about 25 source-text cases, and several files no runner picks up.

## Implementation work

- [ ] The listed self-testing, source-text and unrunnable tests are deleted — proven by `npm run check:code` still passing
- [ ] One language test checks every English key and placeholder in all 8 other languages — proven in a new `src/i18n/locale-parity.test.ts`
- [ ] The 7 single-screen "key exists" files are deleted — proven by the new language test passing

## Acceptance criteria

- [ ] `npm run check:code` passes.
- [ ] No E2E suite references a missing flow file.
- [ ] `docs/usage/test-audit.md` section 7 marks these as removed.
