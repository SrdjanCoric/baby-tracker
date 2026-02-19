/**
 * Trend calculation utilities for week-over-week comparisons
 */

import { getDateRangeForPeriod, filterEntriesByDateRange, type StatisticsPeriod } from "./statistics";

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
  return calculatePeriodOverPeriodTrend(
    entries,
    getDateField,
    calculateValue,
    "7days",
    referenceDate
  );
}

export function calculatePeriodOverPeriodTrend<T>(
  entries: T[],
  getDateField: (entry: T) => string,
  calculateValue: (entries: T[]) => number,
  period: StatisticsPeriod,
  referenceDate: Date = new Date()
): TrendResult {
  const currentRange = getDateRangeForPeriod(period, referenceDate);

  const periodDays = period === "today" ? 1 : period === "7days" ? 7 : 30;

  const previousEnd = new Date(currentRange.start);
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (periodDays - 1));
  previousStart.setHours(0, 0, 0, 0);

  const previousRange = { start: previousStart, end: previousEnd };

  const currentEntries = filterEntriesByDateRange(entries, currentRange, getDateField);
  const previousEntries = filterEntriesByDateRange(entries, previousRange, getDateField);

  const currentValue = calculateValue(currentEntries);
  const previousValue = calculateValue(previousEntries);

  return calculateTrend(currentValue, previousValue);
}
