# Edge Case Data Integrity Audit Report

## Summary

Utility functions and data processing code have several edge cases that can produce incorrect results: invalid birth dates cause NaN propagation, growth percentiles are silently clamped for older children, `calculateZScore` masks invalid data by returning 0, and `formatWeightChange` doesn't handle NaN. These won't crash the app but display incorrect information to users.

---

## Issue 1: Invalid birth date produces NaN in age calculations

**Severity: HIGH**
**File:** `src/utils/growth-helpers.ts`, lines 1-9

```typescript
export function isUnderTwoYears(birthDate: string | undefined): boolean {
  if (!birthDate) return true;
  const birth = new Date(birthDate);
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  return monthsDiff < 24;
}
```

If `birthDate` is an invalid string (e.g., `"invalid"`, corrupted storage data), `new Date(birthDate)` returns `Invalid Date`. Then `birth.getFullYear()` returns `NaN`, the arithmetic produces `NaN`, and `NaN < 24` evaluates to `false`.

**Impact:** The function returns `false` for invalid dates, meaning babies with corrupted birth date data are treated as over 2 years old. The UI shows "Height" instead of "Length" — a minor label issue but symptomatic of unvalidated data flowing through the system.

**Fix:** Validate the Date object:

```typescript
export function isUnderTwoYears(birthDate: string | undefined): boolean {
  if (!birthDate) return true;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return true; // Invalid date — default to under 2
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  return monthsDiff < 24;
}
```

---

## Issue 2: Growth percentiles silently clamped for children over 24 months

**Severity: MEDIUM**
**File:** `src/utils/percentile-calculator.ts`, lines 196-197

```typescript
const clampedAge = Math.max(0, Math.min(24, ageMonths));
```

The WHO growth data used by the percentile calculator covers 0-24 months. For babies older than 24 months, the age is silently clamped to 24 months. The percentile is then calculated against 24-month data.

**Impact:** A 3-year-old's weight/height percentile is evaluated against 24-month-old data, producing a meaningless result displayed as if it were valid. Parents could make incorrect assumptions about their child's growth.

**Fix:** Return `null` for out-of-range ages and let the UI handle it:

```typescript
export function getLMSForAge(
  ageMonths: number,
  data: GrowthDataPoint[]
): { L: number; M: number; S: number } | null {
  if (ageMonths < 0 || ageMonths > 24) {
    return null; // Outside WHO chart range
  }
  // ... existing interpolation logic
}
```

Update callers to show "N/A" or "Outside chart range" when `getLMSForAge` returns null.

---

## Issue 3: calculateZScore returns 0 for invalid inputs, masking data errors

**Severity: MEDIUM**
**File:** `src/utils/percentile-calculator.ts`, lines 138-140

```typescript
if (measurement <= 0 || M <= 0 || S <= 0) {
  return 0;
}
```

Returning 0 means the calculation yields a Z-score of 0, which maps to the 50th percentile. Invalid data (negative measurements, corrupted LMS parameters) produces a perfectly normal-looking result.

**Impact:** Parents see "50th percentile" for corrupt data instead of an error indication. This could mask real data entry errors (e.g., accidentally entering 0kg for weight).

**Fix:** Return `null` for invalid inputs:

```typescript
export function calculateZScore(
  measurement: number,
  L: number,
  M: number,
  S: number
): number | null {
  if (measurement <= 0 || M <= 0 || S <= 0) {
    return null;
  }
  // ... existing calculation
}
```

Update callers to show "—" or skip the percentile display when Z-score is null.

---

## Issue 4: formatWeightChange doesn't handle NaN/Infinity

**Severity: LOW**
**File:** `src/utils/growth-helpers.ts`, lines 16-20

```typescript
export function formatWeightChange(changeGrams: number): string {
  if (changeGrams === 0) return "stable";
  const sign = changeGrams > 0 ? "+" : "";
  return `${sign}${changeGrams}g`;
}
```

If `changeGrams` is `NaN` (from a calculation involving invalid data), the output is `"NaNg"`. If `Infinity`, the output is `"+Infinityg"`.

**Fix:** Add a guard:

```typescript
export function formatWeightChange(changeGrams: number): string {
  if (!Number.isFinite(changeGrams)) return "—";
  if (changeGrams === 0) return "stable";
  const sign = changeGrams > 0 ? "+" : "";
  return `${sign}${changeGrams}g`;
}
```

---

## Issue 5: Statistics rounding inconsistency

**Severity: LOW**
**File:** `src/utils/statistics.ts`, lines 283-289

```typescript
sleepHoursPerDay: Math.round((...) * 10) / 10,      // 1 decimal
feedingsPerDay: Math.round((...) * 10) / 10,          // 1 decimal
wetDiapersPerDay: Math.round((...) * 10) / 10,        // 1 decimal
dirtyDiapersPerDay: Math.round((...) * 10) / 10,      // 1 decimal
breastfeedingMinutesPerDay: Math.round(...),           // 0 decimals
pumpingMlPerDay: Math.round(...),                      // 0 decimals
tummyTimeMinutesPerDay: Math.round(...),               // 0 decimals
```

Some metrics use 1 decimal place (lines 283-286) while others use 0 (lines 287-289). This is inconsistent.

**Impact:** Minor UI inconsistency. Not a correctness issue.

**Fix:** Standardize to 1 decimal for all metrics, or explicitly document which should be integers:

```typescript
pumpingMlPerDay: Math.round((pumpingStats.totalVolumeMl / days) * 10) / 10,
tummyTimeMinutesPerDay: Math.round((tummyTimeStats.totalDurationSeconds / 60 / days) * 10) / 10,
```

---

## Issue 6: Notification scheduler quiet hours boundary precision

**Severity: LOW**
**File:** `src/utils/notification-scheduler.ts`, lines 94-100

```typescript
const result = new Date(fromTime);
result.setHours(end.hours, end.minutes, 0, 0);

if (result <= fromTime) {
  result.setDate(result.getDate() + 1);
}
```

If `fromTime` is exactly `15:00:00.500` (with milliseconds) and quiet hours end at `15:00`, the function creates `15:00:00.000` which is `<= 15:00:00.500`, triggering the +1 day branch. The next quiet hours end is pushed to tomorrow instead of being treated as "now".

**Impact:** A notification scheduled exactly at quiet hours end boundary could be delayed by ~24 hours. Extremely rare in practice.

**Fix:** Truncate `fromTime` to minute precision before comparison, or use `<` instead of `<=`:

```typescript
if (result < fromTime) {  // Strict less-than
  result.setDate(result.getDate() + 1);
}
```

---

## Implementation Checklist

- [x] **Task 1:** Add `isNaN(birth.getTime())` check to `isUnderTwoYears` (`growth-helpers.ts`, line 3).
- [x] **Task 2:** Return `null` from `getLMSForAge` when age > 24 months (`percentile-calculator.ts`, line 196). Update callers to handle null.
- [x] **Task 3:** Return `null` from `calculateZScore` for invalid inputs (`percentile-calculator.ts`, line 138). Update callers.
- [x] **Task 4:** Add `Number.isFinite()` guard to `formatWeightChange` (`growth-helpers.ts`, line 17).
- [x] **Task 5:** Standardize rounding in `calculateDailyAverages` (`statistics.ts`, lines 287-289).
- [x] **Task 6:** Use strict `<` comparison in `getNextQuietHoursEnd` (`notification-scheduler.ts`, line 98).
