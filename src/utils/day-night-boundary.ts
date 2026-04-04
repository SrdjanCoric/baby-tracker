import type { SleepType } from "@/constants/activities";
import type { StoredSleepEntry } from "@/services/sleep-storage";

const DEFAULT_DAY_START = 6;
const DEFAULT_DAY_END = 19;
const DEFAULT_NAP_CONTINUATION_MINUTES = 20;

export function isNightTime(
  date: Date,
  dayStartHour = DEFAULT_DAY_START,
  dayEndHour = DEFAULT_DAY_END
): boolean {
  const hour = date.getHours();
  return hour >= dayEndHour || hour < dayStartHour;
}

export function determineSleepTypeFromBoundary(
  startedAt: Date,
  dayStartHour = DEFAULT_DAY_START,
  dayEndHour = DEFAULT_DAY_END
): SleepType {
  return isNightTime(startedAt, dayStartHour, dayEndHour) ? "night" : "nap";
}

export function countNapsWithContinuation(
  naps: StoredSleepEntry[],
  thresholdMinutes = DEFAULT_NAP_CONTINUATION_MINUTES
): number {
  if (naps.length === 0) return 0;

  const sorted = [...naps].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  let groupCount = 1;
  const thresholdMs = thresholdMinutes * 60 * 1000;

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].endedAt
      ? new Date(sorted[i - 1].endedAt!).getTime()
      : new Date(sorted[i - 1].startedAt).getTime();
    const currStart = new Date(sorted[i].startedAt).getTime();
    const gap = currStart - prevEnd;

    if (gap >= thresholdMs) {
      groupCount++;
    }
  }

  return groupCount;
}
