import type { StoredSleepEntry } from "@/services/sleep-storage";

export interface DayBlock {
  topPx: number;
  heightPx: number;
  type: "nap" | "night";
  durationSeconds: number;
  startedAt: string;
}

export interface DayViewData {
  dateLabel: string;
  date: Date;
  blocks: DayBlock[];
}

export interface WeekColumn {
  dayLabel: string;
  dateNum: string;
  isToday: boolean;
  blocks: { topFraction: number; heightFraction: number; type: "nap" | "night" }[];
}

export interface SleepSummary {
  avgBedtime: Date | null;
  avgWakeTime: Date | null;
  avgTotalSleepSeconds: number;
  avgNightSleepSeconds: number;
  avgNapsPerDay: number;
  avgNapDurationSeconds: number;
  longestStretchSeconds: number;
  nightWakingsPerNight: number;
  bedtimeTrend: { date: Date; time: Date }[];
  wakeTimeTrend: { date: Date; time: Date }[];
}

const HOURS_IN_DAY = 24;
const MIN_BLOCK_PX = 4;

function getDayWindowStart(date: Date, dayStartHour: number = 6): Date {
  const start = new Date(date);
  start.setHours(dayStartHour, 0, 0, 0);
  return start;
}

function getDayWindowEnd(date: Date, dayStartHour: number = 6): Date {
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  end.setHours(dayStartHour, 0, 0, 0);
  return end;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildDayViewData(
  sleeps: StoredSleepEntry[],
  date: Date,
  pxPerHour: number = 60,
  now: Date = new Date(),
  dayStartHour: number = 6
): DayViewData {
  const windowStart = getDayWindowStart(date, dayStartHour);
  const windowEnd = getDayWindowEnd(date, dayStartHour);
  const totalPx = HOURS_IN_DAY * pxPerHour;

  const dateLabel = formatDateLabel(date, now);

  const blocks: DayBlock[] = [];

  for (const sleep of sleeps) {
    const sleepStart = new Date(sleep.startedAt);
    const sleepEnd = sleep.endedAt ? new Date(sleep.endedAt) : now;

    if (sleepEnd <= windowStart || sleepStart >= windowEnd) continue;

    const clampedStart = new Date(Math.max(sleepStart.getTime(), windowStart.getTime()));
    const clampedEnd = new Date(Math.min(sleepEnd.getTime(), windowEnd.getTime()));

    const startOffsetMs = clampedStart.getTime() - windowStart.getTime();
    const endOffsetMs = clampedEnd.getTime() - windowStart.getTime();

    const totalWindowMs = HOURS_IN_DAY * 60 * 60 * 1000;
    const topPx = clamp((startOffsetMs / totalWindowMs) * totalPx, 0, totalPx);
    const bottomPx = clamp((endOffsetMs / totalWindowMs) * totalPx, 0, totalPx);
    const heightPx = Math.max(bottomPx - topPx, MIN_BLOCK_PX);

    const durationSeconds = sleep.durationSeconds ?? Math.floor((sleepEnd.getTime() - sleepStart.getTime()) / 1000);

    blocks.push({
      topPx,
      heightPx,
      type: sleep.type as "nap" | "night",
      durationSeconds,
      startedAt: sleep.startedAt,
    });
  }

  return { dateLabel, date, blocks };
}

export function buildWeekViewData(
  sleeps: StoredSleepEntry[],
  weekEndDate: Date,
  now: Date = new Date(),
  dayStartHour: number = 6
): WeekColumn[] {
  const columns: WeekColumn[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(weekEndDate);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const windowStart = getDayWindowStart(date, dayStartHour);
    const windowEnd = getDayWindowEnd(date, dayStartHour);

    const isCurrentDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const dayBlocks: WeekColumn["blocks"] = [];

    for (const sleep of sleeps) {
      const sleepStart = new Date(sleep.startedAt);
      const sleepEnd = sleep.endedAt ? new Date(sleep.endedAt) : now;

      if (sleepEnd <= windowStart || sleepStart >= windowEnd) continue;

      const clampedStart = new Date(Math.max(sleepStart.getTime(), windowStart.getTime()));
      const clampedEnd = new Date(Math.min(sleepEnd.getTime(), windowEnd.getTime()));

      const totalWindowMs = HOURS_IN_DAY * 60 * 60 * 1000;
      const topFraction = clamp(
        (clampedStart.getTime() - windowStart.getTime()) / totalWindowMs,
        0,
        1
      );
      const heightFraction = clamp(
        (clampedEnd.getTime() - clampedStart.getTime()) / totalWindowMs,
        0,
        1 - topFraction
      );

      if (heightFraction > 0) {
        dayBlocks.push({
          topFraction,
          heightFraction,
          type: sleep.type as "nap" | "night",
        });
      }
    }

    columns.push({
      dayLabel: dayNames[date.getDay()],
      dateNum: String(date.getDate()),
      isToday: isCurrentDay,
      blocks: dayBlocks,
    });
  }

  return columns;
}

export function calculateSleepSummary(
  sleeps: StoredSleepEntry[],
  days: number = 7,
  now: Date = new Date()
): SleepSummary {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const recentSleeps = sleeps.filter((s) => {
    const start = new Date(s.startedAt);
    return start >= cutoff && s.endedAt;
  });

  if (recentSleeps.length === 0) {
    return {
      avgBedtime: null,
      avgWakeTime: null,
      avgTotalSleepSeconds: 0,
      avgNightSleepSeconds: 0,
      avgNapsPerDay: 0,
      avgNapDurationSeconds: 0,
      longestStretchSeconds: 0,
      nightWakingsPerNight: 0,
      bedtimeTrend: [],
      wakeTimeTrend: [],
    };
  }

  const nightSleeps = recentSleeps.filter((s) => s.type === "night");
  const naps = recentSleeps.filter((s) => s.type === "nap");

  const dailyData: Map<
    string,
    {
      date: Date;
      totalSeconds: number;
      nightSeconds: number;
      napCount: number;
      napSeconds: number;
      nightStarts: Date[];
      nightEnds: Date[];
      nightSessions: number;
    }
  > = new Map();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyData.set(key, {
      date: new Date(d),
      totalSeconds: 0,
      nightSeconds: 0,
      napCount: 0,
      napSeconds: 0,
      nightStarts: [],
      nightEnds: [],
      nightSessions: 0,
    });
  }

  for (const sleep of recentSleeps) {
    const startDate = new Date(sleep.startedAt);
    const key = startDate.toISOString().slice(0, 10);
    const day = dailyData.get(key);
    if (!day) continue;

    const duration = sleep.durationSeconds ?? 0;
    day.totalSeconds += duration;

    if (sleep.type === "night") {
      day.nightSeconds += duration;
      day.nightStarts.push(startDate);
      if (sleep.endedAt) day.nightEnds.push(new Date(sleep.endedAt));
      day.nightSessions++;
    } else {
      day.napCount++;
      day.napSeconds += duration;
    }
  }

  const daysWithData = Array.from(dailyData.values()).filter(
    (d) => d.totalSeconds > 0
  );
  const activeDays = Math.max(daysWithData.length, 1);

  const totalSleepSeconds = daysWithData.reduce(
    (sum, d) => sum + d.totalSeconds,
    0
  );
  const totalNightSeconds = daysWithData.reduce(
    (sum, d) => sum + d.nightSeconds,
    0
  );
  const totalNaps = daysWithData.reduce((sum, d) => sum + d.napCount, 0);
  const totalNapSeconds = daysWithData.reduce(
    (sum, d) => sum + d.napSeconds,
    0
  );

  let longestStretch = 0;
  for (const sleep of recentSleeps) {
    const duration = sleep.durationSeconds ?? 0;
    if (duration > longestStretch) longestStretch = duration;
  }

  const bedtimeMinutes: number[] = [];
  const wakeTimeMinutes: number[] = [];
  const bedtimeTrend: SleepSummary["bedtimeTrend"] = [];
  const wakeTimeTrend: SleepSummary["wakeTimeTrend"] = [];

  for (const [, day] of dailyData) {
    if (day.nightStarts.length > 0) {
      const earliest = day.nightStarts.reduce((a, b) =>
        a.getTime() < b.getTime() ? a : b
      );
      const mins = earliest.getHours() * 60 + earliest.getMinutes();
      bedtimeMinutes.push(mins);
      bedtimeTrend.push({ date: day.date, time: earliest });
    }

    if (day.nightEnds.length > 0) {
      const latest = day.nightEnds.reduce((a, b) =>
        a.getTime() > b.getTime() ? a : b
      );
      const mins = latest.getHours() * 60 + latest.getMinutes();
      wakeTimeMinutes.push(mins);
      wakeTimeTrend.push({ date: day.date, time: latest });
    }
  }

  let avgBedtime: Date | null = null;
  if (bedtimeMinutes.length > 0) {
    const avgMins = Math.round(
      bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length
    );
    avgBedtime = new Date(0);
    avgBedtime.setHours(Math.floor(avgMins / 60), avgMins % 60, 0, 0);
  }

  let avgWakeTime: Date | null = null;
  if (wakeTimeMinutes.length > 0) {
    const avgMins = Math.round(
      wakeTimeMinutes.reduce((a, b) => a + b, 0) / wakeTimeMinutes.length
    );
    avgWakeTime = new Date(0);
    avgWakeTime.setHours(Math.floor(avgMins / 60), avgMins % 60, 0, 0);
  }

  const nightDaysWithSessions = daysWithData.filter(
    (d) => d.nightSessions > 0
  );
  const totalNightSessions = nightDaysWithSessions.reduce(
    (sum, d) => sum + d.nightSessions,
    0
  );
  const nightWakingsPerNight =
    nightDaysWithSessions.length > 0
      ? Math.max(
          0,
          totalNightSessions / nightDaysWithSessions.length - 1
        )
      : 0;

  return {
    avgBedtime,
    avgWakeTime,
    avgTotalSleepSeconds: Math.round(totalSleepSeconds / activeDays),
    avgNightSleepSeconds: Math.round(totalNightSeconds / activeDays),
    avgNapsPerDay: Math.round((totalNaps / activeDays) * 10) / 10,
    avgNapDurationSeconds:
      totalNaps > 0 ? Math.round(totalNapSeconds / totalNaps) : 0,
    longestStretchSeconds: longestStretch,
    nightWakingsPerNight: Math.round(nightWakingsPerNight * 10) / 10,
    bedtimeTrend: bedtimeTrend.sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    ),
    wakeTimeTrend: wakeTimeTrend.sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    ),
  };
}

function formatDateLabel(date: Date, now: Date = new Date()): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

export function getHoursForAxis(dayStartHour: number = 6): number[] {
  const hours: number[] = [];
  for (let i = 0; i < HOURS_IN_DAY; i++) {
    hours.push((dayStartHour + i) % 24);
  }
  return hours;
}

export function getEvenHoursForAxis(dayStartHour: number = 6): number[] {
  const hours: number[] = [];
  for (let i = 0; i < HOURS_IN_DAY; i += 2) {
    hours.push((dayStartHour + i) % 24);
  }
  return hours;
}

export function getNowPosition(pxPerHour: number, now: Date = new Date(), dayStartHour: number = 6): number | null {
  const todayWindowStart = getDayWindowStart(now, dayStartHour);
  const todayWindowEnd = getDayWindowEnd(now, dayStartHour);

  if (now < todayWindowStart || now >= todayWindowEnd) return null;

  const offsetMs = now.getTime() - todayWindowStart.getTime();
  const totalMs = HOURS_IN_DAY * 60 * 60 * 1000;
  return (offsetMs / totalMs) * (HOURS_IN_DAY * pxPerHour);
}

export function getNowFraction(now: Date = new Date(), dayStartHour: number = 6): number | null {
  const todayWindowStart = getDayWindowStart(now, dayStartHour);
  const todayWindowEnd = getDayWindowEnd(now, dayStartHour);

  if (now < todayWindowStart || now >= todayWindowEnd) return null;

  const offsetMs = now.getTime() - todayWindowStart.getTime();
  const totalMs = HOURS_IN_DAY * 60 * 60 * 1000;
  return offsetMs / totalMs;
}

export function formatWeekRange(weekEndDate: Date): string {
  const start = new Date(weekEndDate);
  start.setDate(start.getDate() - 6);

  const startStr = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endStr = weekEndDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${startStr} – ${endStr}`;
}
