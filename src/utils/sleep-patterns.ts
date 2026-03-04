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
  totalSleepSeconds: number;
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
  bedtimeStdDevMinutes: number | null;
}

export interface DailySleepBar {
  label: string;
  dateKey: string;
  nightHours: number;
  napHours: number;
}

const HOURS_IN_DAY = 24;
const MIN_BLOCK_PX = 4;

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function splitSleepAtMidnight(
  sleep: StoredSleepEntry
): { dateKey: string; seconds: number; type: "nap" | "night" }[] {
  const start = new Date(sleep.startedAt);
  const end = sleep.endedAt ? new Date(sleep.endedAt) : null;
  if (!end) return [];

  const type = sleep.type as "nap" | "night";
  const result: { dateKey: string; seconds: number; type: "nap" | "night" }[] = [];

  let segStart = start;
  while (segStart < end) {
    const nextMidnight = new Date(segStart);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const segEnd = nextMidnight < end ? nextMidnight : end;
    const seconds = Math.floor((segEnd.getTime() - segStart.getTime()) / 1000);

    if (seconds > 0) {
      result.push({ dateKey: localDateKey(segStart), seconds, type });
    }

    segStart = segEnd;
  }

  return result;
}

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
  dayStartHour: number = 6,
  locale: string = "en",
  todayLabel: string = "Today",
  yesterdayLabel: string = "Yesterday"
): DayViewData {
  const windowStart = getDayWindowStart(date, dayStartHour);
  const windowEnd = getDayWindowEnd(date, dayStartHour);
  const totalPx = HOURS_IN_DAY * pxPerHour;

  const dateLabel = formatDateLabel(date, now, locale, todayLabel, yesterdayLabel);

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

    const durationSeconds = Math.floor((clampedEnd.getTime() - clampedStart.getTime()) / 1000);

    blocks.push({
      topPx,
      heightPx,
      type: sleep.type as "nap" | "night",
      durationSeconds,
      startedAt: sleep.startedAt,
    });
  }

  const dateKey = localDateKey(date);
  let totalSleepSeconds = 0;
  for (const sleep of sleeps) {
    if (!sleep.endedAt) continue;
    for (const seg of splitSleepAtMidnight(sleep)) {
      if (seg.dateKey === dateKey) {
        totalSleepSeconds += seg.seconds;
      }
    }
  }

  return { dateLabel, date, blocks, totalSleepSeconds };
}

export function buildWeekViewData(
  sleeps: StoredSleepEntry[],
  weekEndDate: Date,
  now: Date = new Date(),
  dayStartHour: number = 6,
  locale: string = "en"
): WeekColumn[] {
  const columns: WeekColumn[] = [];

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
      dayLabel: date.toLocaleDateString(locale, { weekday: "short" }),
      dateNum: String(date.getDate()),
      isToday: isCurrentDay,
      blocks: dayBlocks,
    });
  }

  return columns;
}

function getNightKey(
  startDate: Date,
  dayStartHour: number,
  dayEndHour: number
): string | null {
  const hour = startDate.getHours();
  if (hour >= dayEndHour) {
    return localDateKey(startDate);
  }
  if (hour < dayStartHour) {
    const prev = new Date(startDate);
    prev.setDate(prev.getDate() - 1);
    return localDateKey(prev);
  }
  return null;
}

function circularTimeMean(minutesArray: number[]): number {
  const n = minutesArray.length;
  if (n === 0) return 0;

  const MINUTES_IN_DAY = 1440;
  let sinSum = 0;
  let cosSum = 0;

  for (const mins of minutesArray) {
    const angle = (mins / MINUTES_IN_DAY) * 2 * Math.PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }

  let meanAngle = Math.atan2(sinSum / n, cosSum / n);
  if (meanAngle < 0) meanAngle += 2 * Math.PI;

  return Math.round((meanAngle / (2 * Math.PI)) * MINUTES_IN_DAY) % MINUTES_IN_DAY;
}

function bedtimeStdDev(minutesArray: number[]): number {
  if (minutesArray.length < 2) return 0;

  const shifted = minutesArray.map((m) => (m < 720 ? m + 1440 : m));

  const mean = shifted.reduce((a, b) => a + b, 0) / shifted.length;
  const variance =
    shifted.reduce((sum, m) => sum + (m - mean) ** 2, 0) / shifted.length;
  return Math.round(Math.sqrt(variance));
}

export function calculateSleepSummary(
  sleeps: StoredSleepEntry[],
  days: number = 7,
  now: Date = new Date(),
  dayStartHour: number = 6,
  dayEndHour: number = 19
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
      bedtimeStdDevMinutes: null,
    };
  }

  const dailyData: Map<
    string,
    {
      date: Date;
      totalSeconds: number;
      nightSeconds: number;
      napCount: number;
      napSeconds: number;
      nightSessions: number;
    }
  > = new Map();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    dailyData.set(key, {
      date: new Date(d),
      totalSeconds: 0,
      nightSeconds: 0,
      napCount: 0,
      napSeconds: 0,
      nightSessions: 0,
    });
  }

  for (const sleep of recentSleeps) {
    const segments = splitSleepAtMidnight(sleep);
    for (const seg of segments) {
      const day = dailyData.get(seg.dateKey);
      if (!day) continue;

      day.totalSeconds += seg.seconds;

      if (seg.type === "night") {
        day.nightSeconds += seg.seconds;
      } else {
        day.napSeconds += seg.seconds;
      }
    }

    const startDate = new Date(sleep.startedAt);
    const startKey = localDateKey(startDate);
    const startDay = dailyData.get(startKey);
    if (startDay) {
      if (sleep.type === "night") {
        startDay.nightSessions++;
      } else {
        startDay.napCount++;
      }
    }
  }

  const nightlyData: Map<
    string,
    { nightDate: Date; starts: Date[]; ends: Date[] }
  > = new Map();

  const nightSleeps = recentSleeps.filter((s) => s.type === "night");
  for (const sleep of nightSleeps) {
    const startDate = new Date(sleep.startedAt);
    const nightKey = getNightKey(startDate, dayStartHour, dayEndHour);
    if (!nightKey) continue;

    let entry = nightlyData.get(nightKey);
    if (!entry) {
      const [y, m, d] = nightKey.split("-").map(Number);
      const nd = new Date(y, m - 1, d, 12, 0, 0);
      entry = { nightDate: nd, starts: [], ends: [] };
      nightlyData.set(nightKey, entry);
    }
    entry.starts.push(startDate);
    if (sleep.endedAt) entry.ends.push(new Date(sleep.endedAt));
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

  for (const [, night] of nightlyData) {
    if (night.starts.length > 0) {
      const earliest = night.starts.reduce((a, b) =>
        a.getTime() < b.getTime() ? a : b
      );
      const mins = earliest.getHours() * 60 + earliest.getMinutes();
      bedtimeMinutes.push(mins);
      bedtimeTrend.push({ date: night.nightDate, time: earliest });
    }

    if (night.ends.length > 0) {
      const latest = night.ends.reduce((a, b) =>
        a.getTime() > b.getTime() ? a : b
      );
      const mins = latest.getHours() * 60 + latest.getMinutes();
      wakeTimeMinutes.push(mins);
      wakeTimeTrend.push({ date: night.nightDate, time: latest });
    }
  }

  let avgBedtime: Date | null = null;
  if (bedtimeMinutes.length > 0) {
    const avgMins = circularTimeMean(bedtimeMinutes);
    avgBedtime = new Date(0);
    avgBedtime.setHours(Math.floor(avgMins / 60), avgMins % 60, 0, 0);
  }

  let avgWakeTime: Date | null = null;
  if (wakeTimeMinutes.length > 0) {
    const avgMins = circularTimeMean(wakeTimeMinutes);
    avgWakeTime = new Date(0);
    avgWakeTime.setHours(Math.floor(avgMins / 60), avgMins % 60, 0, 0);
  }

  const nightsWithSessions = Array.from(nightlyData.values());
  const totalNightSessions = nightsWithSessions.reduce(
    (sum, n) => sum + n.starts.length,
    0
  );
  const nightWakingsPerNight =
    nightsWithSessions.length > 0
      ? Math.max(
          0,
          totalNightSessions / nightsWithSessions.length - 1
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
    bedtimeStdDevMinutes:
      bedtimeMinutes.length >= 2 ? bedtimeStdDev(bedtimeMinutes) : null,
  };
}

export function buildDailySleepBars(
  sleeps: StoredSleepEntry[],
  days: number,
  now: Date = new Date(),
  dayStartHour: number = 6,
  dayEndHour: number = 19,
  locale: string = "en"
): DailySleepBar[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const recentSleeps = sleeps.filter((s) => {
    const start = new Date(s.startedAt);
    return start >= cutoff && s.endedAt;
  });

  const dailyMap = new Map<string, { nightSeconds: number; napSeconds: number }>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMap.set(localDateKey(d), { nightSeconds: 0, napSeconds: 0 });
  }

  for (const sleep of recentSleeps) {
    const segments = splitSleepAtMidnight(sleep);
    for (const seg of segments) {
      const day = dailyMap.get(seg.dateKey);
      if (!day) continue;

      if (seg.type === "night") {
        day.nightSeconds += seg.seconds;
      } else {
        day.napSeconds += seg.seconds;
      }
    }
  }

  const bars: DailySleepBar[] = [];
  for (const [key, data] of dailyMap) {
    const [, , dayStr] = key.split("-");
    bars.push({
      label: String(parseInt(dayStr, 10)),
      dateKey: key,
      nightHours: Math.round((data.nightSeconds / 3600) * 10) / 10,
      napHours: Math.round((data.napSeconds / 3600) * 10) / 10,
    });
  }

  return bars;
}

export function formatDateLabel(
  date: Date,
  now: Date = new Date(),
  locale: string = "en",
  todayLabel: string = "Today",
  yesterdayLabel: string = "Yesterday"
): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return todayLabel;
  if (diffDays === 1) return yesterdayLabel;

  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
  };
  return date.toLocaleDateString(locale, options);
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

export function formatWeekRange(weekEndDate: Date, locale: string = "en"): string {
  const start = new Date(weekEndDate);
  start.setDate(start.getDate() - 6);

  const startStr = start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
  const endStr = weekEndDate.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });

  return `${startStr} – ${endStr}`;
}
