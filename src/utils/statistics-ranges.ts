import type { UtcActivityRange } from "@/services/activity-range-loader";
import type { StatisticsPeriod } from "@/utils/statistics";
import { getCompletedSleepDayWindow } from "@/utils/sleep-summary-window";

const ALL_HISTORY_START = "0001-01-01T00:00:00.000Z";
const ALL_HISTORY_END = "9999-12-31T23:59:59.999Z";

function nextLocalMidnight(referenceDate: Date): Date {
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return end;
}

export function getCalendarStatisticsRange(
  period: StatisticsPeriod,
  referenceDate: Date = new Date()
): UtcActivityRange {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  if (period === "7days") start.setDate(start.getDate() - 6);
  if (period === "30days") start.setDate(start.getDate() - 29);

  return {
    start: start.toISOString(),
    end: nextLocalMidnight(referenceDate).toISOString(),
  };
}

export function getSleepDayRange(date: Date, dayStartHour: number): UtcActivityRange {
  const start = new Date(date);
  start.setHours(dayStartHour, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getSleepWeekRange(
  weekEndDate: Date,
  dayStartHour: number
): UtcActivityRange {
  const start = new Date(weekEndDate);
  start.setDate(start.getDate() - 6);
  start.setHours(dayStartHour, 0, 0, 0);
  const end = new Date(weekEndDate);
  end.setDate(end.getDate() + 1);
  end.setHours(dayStartHour, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getSleepSummaryRange(
  days: 7 | 14 | 30,
  referenceDate: Date = new Date(),
  dayStartHour: number = 6
): UtcActivityRange {
  const window = getCompletedSleepDayWindow(days, referenceDate, dayStartHour);
  return {
    start: window.start.toISOString(),
    end: window.end.toISOString(),
  };
}

export function getAllHistoryRange(): UtcActivityRange {
  return {
    start: ALL_HISTORY_START,
    end: ALL_HISTORY_END,
  };
}

export function pointInActivityRange(
  timestamp: string,
  range: UtcActivityRange
): boolean {
  return timestamp >= range.start && timestamp < range.end;
}

export function sleepOverlapsActivityRange(
  sleep: { startedAt: string; endedAt?: string },
  range: UtcActivityRange
): boolean {
  return sleep.startedAt < range.end && (!sleep.endedAt || sleep.endedAt > range.start);
}
