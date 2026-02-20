# Silent Data Integrity Failures in Growth & Utility Functions

**Date:** 2026-02-20
**Files involved:** `src/utils/growth-helpers.ts`, `src/utils/percentile-calculator.ts`, `src/utils/statistics.ts`, `src/utils/notification-scheduler.ts`, `src/utils/report-aggregator.ts`, `src/components/growth/GrowthChart.tsx`, `app/growth/charts.tsx`, `src/utils/pdf-templates/growth-section.ts`

## Symptom

No crashes or test failures. The problems were all silent: invalid data flowed through utility functions and produced plausible-looking but incorrect results displayed to users.

- An invalid birth date string (e.g., corrupted storage) caused `isUnderTwoYears` to return `false`, showing "Height" instead of "Length" for babies.
- A 3-year-old's growth percentile was evaluated against 24-month WHO data (silently clamped), producing meaningless results displayed as valid.
- `calculateZScore` returned `0` (50th percentile) for invalid inputs like zero weight, masking data entry errors.
- `formatWeightChange` produced `"NaNg"` or `"+Infinityg"` strings for invalid inputs.
- Statistics rounding was inconsistent: some daily averages used 1 decimal, others used 0.
- Quiet hours boundary used `<=` comparison, causing a millisecond-precision edge case that could delay a notification by ~24 hours.

## Root Cause

**The common pattern: functions that silently produce "reasonable" output for invalid input.**

1. **NaN propagation from `new Date("invalid")`**: `getFullYear()` returns `NaN`, arithmetic produces `NaN`, and `NaN < 24` is `false`. The function returned a definite answer for garbage input.

2. **Silent clamping hides out-of-range data**: `Math.max(0, Math.min(24, ageMonths))` converts any out-of-range age into a valid-looking one. A 36-month-old gets evaluated as 24 months with no indication anything is wrong.

3. **Returning 0 instead of null for invalid Z-scores**: `return 0` maps to the 50th percentile via the normal CDF. Parents see "perfectly average" for corrupt data.

4. **Missing `Number.isFinite` guards**: JavaScript happily concatenates `NaN` and `Infinity` into strings.

5. **`<=` vs `<` boundary precision**: `setHours(h, m, 0, 0)` truncates milliseconds, so a time like `15:00:00.500` is "greater than" `15:00:00.000`, pushing to the next day.

## Fix

1. **`isUnderTwoYears`**: Added `if (isNaN(birth.getTime())) return true` before any arithmetic. Invalid dates default to "under 2" (safer assumption for a baby tracker).

2. **`getLMSForAge`**: Changed return type to `LMSParameters | null`. Returns `null` for `ageMonths < 0 || ageMonths > 24` instead of clamping. Removed the silent `Math.max/Math.min` clamp.

3. **`calculateZScore`**: Changed return type to `number | null`. Returns `null` instead of `0` for invalid inputs (`measurement <= 0 || M <= 0 || S <= 0`).

4. **`calculatePercentileFromMeasurement`**: Changed return type to `PercentileResult | null`. Propagates `null` from both `getLMSForAge` and `calculateZScore`. All callers updated with optional chaining (`result?.percentile ?? fallback`).

5. **`getPercentileValue`**: Changed return type to `number | null`. Callers (`generatePercentileLine`, `growth-section.ts`) skip null values.

6. **`formatWeightChange`**: Added `if (!Number.isFinite(changeGrams)) return "\u2014"` (em dash) as the first guard.

7. **`calculateDailyAverages`**: Changed `pumpingMlPerDay` and `tummyTimeMinutesPerDay` to use `Math.round(x * 10) / 10` (1 decimal) matching all other metrics.

8. **`getNextQuietHoursEnd`**: Changed `result <= fromTime` to `result < fromTime` (strict less-than).

## Lessons / Notes

- **"Return 0 for invalid input" is a lie, not a safe default.** Returning `null` forces callers to handle the error case explicitly. The 50th-percentile display for corrupt data could mislead parents about their child's growth.

- **Silent clamping is a data integrity antipattern.** `Math.min(24, age)` makes a 36-month-old look like a 24-month-old with no warning. Better to return null and let the UI show "Outside chart range" than to show a confidently wrong number.

- **`new Date(invalidString)` doesn't throw** — it returns `Invalid Date`, and `NaN` propagates silently through all arithmetic. Always validate with `isNaN(date.getTime())` before using a parsed date.

- **Boundary comparisons with sub-second precision**: When comparing `Date` objects that were constructed with `setHours(h, m, 0, 0)` (milliseconds zeroed) against dates that may have sub-second precision, use strict `<` not `<=` to avoid off-by-one-day errors.

- **Test for the edges, not just the happy path.** All existing tests used valid inputs. The new tests for `NaN`, `Infinity`, negative ages, and zero measurements caught the exact scenarios that would silently fail in production.
