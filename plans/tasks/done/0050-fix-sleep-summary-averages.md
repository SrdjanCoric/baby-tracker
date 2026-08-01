# Task 0050: Fix incomplete-day and fragmented-night sleep summaries

**Branch**: `fix/sleep-summary-averages`
**Depends on**: 0047
**Source**: regression-planning conversation 2026-07-31 and Task 0050 implementation findings · **User stories**: caregivers can trust Past 7 Days total-sleep and bedtime averages; incomplete current sleep periods and fragmented nights do not distort the displayed summary

## What to build

Fix two confirmed Sleep Statistics calculation defects.

Past 7 Days currently includes a nonempty but incomplete current sleep day in the average denominator. The summary must instead select the seven most recent **completed** sleep days according to the caregiver's configured day-start boundary. The current sleep day remains excluded until its next day-start boundary passes. Keep the existing missing-data behavior within that completed window: completed days without recorded sleep are not treated as zero-sleep days.

Average bedtime currently uses a broader set of nights than the seven displayed sleep days and can choose an after-midnight fragment instead of the real evening bedtime. This happens because the raw cutoff admits an eighth night, a sleep that overlaps the cutoff can be discarded solely because it started earlier, and a session calculated as night may receive no night key when it starts shortly before `dayEndHour`. Group every calculated night session by the same sleep-day identity used by the selected completed-day window. Include overlapping boundary records when they contribute to an included night, reject night keys outside the seven-day window, and select the earliest chronological start across all fragments in each included night.

Preserve the existing interval-union behavior, automatic Nap/Night classification, configured day boundaries, local-time interpretation, circular bedtime/wake averaging, 12/24-hour formatting, and exclusion of unfinished timers. Update range loading so the selected completed sleep days and boundary-overlapping sessions are available without loading an unintended extra summary day. Use small synthetic fixtures only; do not add a production-derived fixture, historical comparison harness, attribution ledger, or further proof that the defect existed before the fix.

## Known findings that define the fix

- A partially populated current sleep day enters the denominator and lowers total, night, and nap averages.
- A seven-day summary can currently create eight bedtime night keys.
- A session beginning before `dayEndHour` but calculated as night can be omitted from night grouping because classification and key assignment use different rules.
- When that evening session is omitted, a later after-midnight fragment can become the selected bedtime.
- A sleep overlapping the oldest range boundary can be discarded solely because its start precedes the cutoff.
- Timezone conversion and circular-time arithmetic are working and must not be replaced with linear averaging or UTC clock-time grouping.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/10-definition-of-done.md`

- [x] Add deterministic, timezone-controlled regression tests through production calculation and range-loading interfaces.
- [x] Cover completed-window selection, incomplete day and night exclusion, exact range boundaries, fragmented nights, boundary overlap, circular arithmetic, and both time formats.
- [x] Keep the permanent proof synthetic, focused, and runnable through existing root test commands.

## Implementation work

- [x] Add a pure helper that derives the seven most recent completed sleep-day keys and their exact local start/end boundaries from pinned `now` and `dayStartHour`.
- [x] Update sleep-summary range loading to request the complete selected window while retaining overlap-query support for a session that starts before the oldest boundary and ends inside it.
- [x] Make summary totals, daily bars, and denominator selection use the same seven completed sleep-day keys; never add the current incomplete key.
- [x] Preserve existing missing-data semantics by averaging only selected completed days that contain sleep data.
- [x] Group calculated night sessions by their selected sleep-day key rather than deriving a second key from `dayEndHour` and the raw start hour.
- [x] Restrict bedtime, wake-time, trend, and night-waking inputs to nights belonging to the selected completed-day window.
- [x] Select the earliest start and latest end across every included fragment of a night, including a night-classified session that begins shortly before `dayEndHour`.
- [x] Keep interval union, local timezone behavior, circular means, and stored-type-independent automatic classification unchanged.
- [x] Add focused utility, statistics-range, and Sleep Statistics component regressions, then run canonical non-device checks.
- [x] Inspect README behavior documentation after implementation and update it only if the completed-day summary contract belongs in existing user-facing sleep documentation.

## Human checkpoints

**Manual device policy**: The agent may prepare, build, and launch iOS or Android simulators, but must not execute Maestro or other E2E interactions or assertions. The release owner performs and classifies device/E2E scenarios.

- [x] [verify] Open Past 7 Days Sleep Statistics with a synthetic history containing seven completed days, a partial current day, and one fragmented night · Expected: the partial current day is absent, exactly seven completed day bars are shown, the fragmented night's evening start supplies bedtime, and the visible averages match the focused tests · Failure: the current day lowers an average, an eighth night contributes, or an after-midnight fragment replaces the evening bedtime.

## Acceptance criteria

- [x] At any time before the next configured day-start boundary, the current sleep day and current night are excluded from Past 7 Days aggregates and trends.
- [x] Past 7 Days uses the seven most recent completed sleep-day keys and cannot produce an eighth bedtime or wake input.
- [x] With `dayStartHour=9`, `dayEndHour=21`, and synthetic now at 18:00 on August 1, the selected completed keys are July 25 through July 31; August 1 is excluded.
- [x] A night-classified session from 20:35 to 00:20 plus a later fragment from 02:15 to 06:55 is one night whose selected bedtime is 20:35 and selected wake is 06:55.
- [x] A record overlapping the oldest selected boundary contributes only to an included selected night and never creates a preceding eighth night.
- [x] Bedtimes `21:00`, `23:00`, and `01:00` still average circularly to `23:00`, with correct local-time grouping and 12/24-hour display.
- [x] Overlapping completed sleeps remain unioned once, unfinished sleeps remain excluded, and complete empty days retain existing missing-data behavior.
- [x] Focused utility, range, and component tests fail against the old behavior and pass with the fix; canonical non-device validation passes.
- [x] No production-derived sleep data, diagnostic ledger, baseline-comparison harness, or unrelated sleep-prediction behavior is added.

## Completion record

- **Implementation**: `src/utils/sleep-summary-window.ts` now owns completed local sleep-day keys and boundaries for 7/14/30-day periods. `src/utils/sleep-patterns.ts` uses that window for totals, bars, nap averages, fragmented-night grouping, trends, and boundary overlaps. Both summary screens load the same exact range and refresh it when day-start passes.
- **Decision**: Completed-day semantics apply consistently to all selectable 7, 14, and 30-day periods. The adjacent average audit confirmed that every affected displayed sleep average shares these helpers; no non-sleep statistic uses the faulty calculation.
- **Repository guidelines**: Loaded `references/00-overview.md`, `references/02-testing.md`, and `references/10-definition-of-done.md`. Synthetic production-interface regressions cover the declared boundary, average, formatting, and determinism requirements.
- **Review**: One compact Standards/Spec/Bug panel ran; security was skipped because no relevant trust-boundary surface changed. Remediation added day-start refresh consistency, explicit incomplete-night proof, a timezone-controlled focused root command, and timezone-independent component range setup. All findings are fixed; no accepted risks or deferred concerns remain.
- **README**: No update. Existing sleep documentation describes predictions and overlap union; the internal completed-day summary denominator does not change setup or usage documentation.
- **Automated proof**: `npm run test:sleep-summary` passed (104 unit tests and 9 component tests). `npm run check:code` passed the complete canonical non-device suite. Focused lint and typecheck also passed.
- **Manual proof**: Release owner confirmed the Past 7 Days synthetic-history checkpoint passed: seven completed bars, current partial day excluded, evening fragment used for bedtime, and visible averages matched.
