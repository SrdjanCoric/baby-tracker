/**
 * Trend calculation utilities for week-over-week comparisons
 */

import { getDateRangeForPeriod, filterEntriesByDateRange } from "./statistics";

export type TrendDirection = "increase" | "decrease" | "stable";

export interface TrendResult {
  direction: TrendDirection;
  absoluteChange: number;
  percentageChange: number;
  currentValue: number;
  previousValue: number;
}

export function getTrendDirection(
  change: number,
  threshold: number = 0
): TrendDirection {
  if (Math.abs(change) <= threshold) {
    return "stable";
  }
  return change > 0 ? "increase" : "decrease";
}

export function calculateTrend(
  currentValue: number,
  previousValue: number
): TrendResult {
  const absoluteChange = currentValue - previousValue;

  let percentageChange: number;
  if (previousValue === 0 && currentValue === 0) {
    percentageChange = 0;
  } else if (previousValue === 0) {
    percentageChange = 100;
  } else {
    percentageChange = Math.round((absoluteChange / previousValue) * 100);
  }

  const direction = getTrendDirection(absoluteChange);

  return {
    direction,
    absoluteChange,
    percentageChange,
    currentValue,
    previousValue,
  };
}

export function formatTrendPercentage(percentage: number): string {
  const rounded = Math.round(percentage);
  if (rounded > 0) {
    return `+${rounded}%`;
  }
  return `${rounded}%`;
}

export function isSignificantChange(
  percentageChange: number,
  threshold: number = 20
): boolean {
  return Math.abs(percentageChange) >= threshold;
}

export function calculateWeekOverWeekTrend<T>(
  entries: T[],
  getDateField: (entry: T) => string,
  calculateValue: (entries: T[]) => number,
  referenceDate: Date = new Date()
): TrendResult {
  // Current week range (last 7 days ending today)
  const currentWeekRange = getDateRangeForPeriod("weekly", referenceDate);

  // Previous week range (7 days before the current week)
  const previousWeekStart = new Date(currentWeekRange.start);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(currentWeekRange.start);
  previousWeekEnd.setMilliseconds(previousWeekEnd.getMilliseconds() - 1);

  const previousWeekRange = {
    start: previousWeekStart,
    end: previousWeekEnd,
  };

  const currentWeekEntries = filterEntriesByDateRange(
    entries,
    currentWeekRange,
    getDateField
  );

  const previousWeekEntries = filterEntriesByDateRange(
    entries,
    previousWeekRange,
    getDateField
  );

  const currentValue = calculateValue(currentWeekEntries);
  const previousValue = calculateValue(previousWeekEntries);

  return calculateTrend(currentValue, previousValue);
}
