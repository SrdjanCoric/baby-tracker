import { StoredSleepEntry } from "../services/sleep-storage";
import {
  WAKE_WINDOW_PROGRESSIONS,
  getSleepAgeGroupForBaby,
} from "./sleepGoals";

export const SLEEP_MERGE_THRESHOLD_MINUTES = 25;

export interface SleepPredictionModel {
  primaryNapCount: number;
  secondaryNapCount: number | null;
  startRelativeWakeWindows: Record<string, number>;
  penultimateWakeWindow: number;
  bedtimeWakeWindow: number;
  medianNapDuration: number;
  napCountDistribution: Record<number, number>;
}

export interface ProcessedSleep {
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
}

export interface ProcessedDay {
  date: string;
  morningWakeTime: Date;
  naps: ProcessedSleep[];
  bedtime: Date | null;
}

export type PredictionType = "nap" | "bedtime";

export interface SleepPrediction {
  predictedTime: Date;
  type: PredictionType;
}

export interface DriftDetectionResult {
  type: "bedtime" | "morning";
  suggestedHour: number;
  currentHour: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function getMorningThreshold(dayStartHour: number): number {
  return dayStartHour - 3 - 3 / 60;
}

function hourToDate(fractionalHour: number, referenceDate: Date): Date {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  const hours = Math.floor(fractionalHour);
  const minutes = Math.round((fractionalHour - hours) * 60);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateToFractionalHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60);
}

function isDaytimeSleep(
  startedAt: Date,
  endedAt: Date,
  dayStartHour: number,
  dayEndHour: number
): boolean {
  const startMs = startedAt.getTime();
  const endMs = endedAt.getTime();
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return true;

  let dayMs = 0;
  let cursor = startMs;

  while (cursor < endMs) {
    const cursorDate = new Date(cursor);
    const hour = cursorDate.getHours() + cursorDate.getMinutes() / 60;
    const isDay = hour >= dayStartHour && hour < dayEndHour;

    let nextBoundaryMs: number;
    if (isDay) {
      const endOfDay = new Date(cursorDate);
      endOfDay.setHours(Math.floor(dayEndHour), Math.round((dayEndHour % 1) * 60), 0, 0);
      nextBoundaryMs = endOfDay.getTime();
    } else {
      if (hour < dayStartHour) {
        const startOfDay = new Date(cursorDate);
        startOfDay.setHours(Math.floor(dayStartHour), Math.round((dayStartHour % 1) * 60), 0, 0);
        nextBoundaryMs = startOfDay.getTime();
      } else {
        const nextDayStart = new Date(cursorDate);
        nextDayStart.setDate(nextDayStart.getDate() + 1);
        nextDayStart.setHours(Math.floor(dayStartHour), Math.round((dayStartHour % 1) * 60), 0, 0);
        nextBoundaryMs = nextDayStart.getTime();
      }
    }

    const segmentEnd = Math.min(nextBoundaryMs, endMs);
    if (isDay) {
      dayMs += segmentEnd - cursor;
    }
    cursor = segmentEnd;
  }

  return dayMs >= totalMs / 2;
}

export function processSleepData(
  sleeps: StoredSleepEntry[],
  mergeThreshold: number = SLEEP_MERGE_THRESHOLD_MINUTES,
  minDuration: number = 15
): ProcessedSleep[] {
  const completed = sleeps
    .filter((s) => s.endedAt)
    .map((s) => ({
      startedAt: new Date(s.startedAt),
      endedAt: new Date(s.endedAt!),
      durationMinutes:
        (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) /
        (1000 * 60),
    }))
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  if (completed.length === 0) return [];

  const merged: ProcessedSleep[] = [completed[0]];

  for (let i = 1; i < completed.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = completed[i];
    const gap = minutesBetween(prev.endedAt, curr.startedAt);

    if (gap < mergeThreshold) {
      prev.endedAt = curr.endedAt;
      prev.durationMinutes = minutesBetween(prev.startedAt, prev.endedAt);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged.filter((s) => s.durationMinutes >= minDuration);
}

function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function areDatesConsecutive(dates: string[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T12:00:00");
    const curr = new Date(dates[i] + "T12:00:00");
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.round(diffDays) !== 1) return false;
  }
  return true;
}

export function groupSleepsByDay(
  sleeps: ProcessedSleep[],
  dayStartHour: number,
  dayEndHour: number
): ProcessedDay[] {
  const sorted = [...sleeps].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime()
  );

  const dates = new Set<string>();
  for (const sleep of sorted) {
    dates.add(getDayKey(sleep.startedAt));
    dates.add(getDayKey(sleep.endedAt));
  }

  const dayMap = new Map<string, ProcessedDay>();

  for (const dateStr of dates) {
    let morningWakeTime: Date | null = null;
    const naps: ProcessedSleep[] = [];
    let bedtime: Date | null = null;

    for (const sleep of sorted) {
      const endedAtHour = dateToFractionalHour(sleep.endedAt);
      const endedOnThisDate = getDayKey(sleep.endedAt) === dateStr;
      const startedOnThisDate = getDayKey(sleep.startedAt) === dateStr;

      if (endedOnThisDate && endedAtHour >= getMorningThreshold(dayStartHour) && endedAtHour <= dayStartHour + 4) {
        const startHour = dateToFractionalHour(sleep.startedAt);
        const isNightSleep = startHour < dayStartHour || getDayKey(sleep.startedAt) !== dateStr || sleep.durationMinutes > 120;
        if (isNightSleep) {
          if (!morningWakeTime || sleep.endedAt.getTime() > morningWakeTime.getTime()) {
            morningWakeTime = sleep.endedAt;
          }
        }
      }

      if (startedOnThisDate) {
        const isDay = isDaytimeSleep(sleep.startedAt, sleep.endedAt, dayStartHour, dayEndHour);

        if (isDay) {
          if (morningWakeTime && sleep.startedAt.getTime() > morningWakeTime.getTime()) {
            naps.push(sleep);
          }
        }

        if (!isDay && sleep.durationMinutes > 120 && morningWakeTime && sleep.startedAt.getTime() > morningWakeTime.getTime()) {
          if (!bedtime || sleep.startedAt.getTime() < bedtime.getTime()) {
            bedtime = sleep.startedAt;
          }
        }
      }
    }

    if (morningWakeTime && naps.length > 0) {
      naps.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      dayMap.set(dateStr, {
        date: dateStr,
        morningWakeTime,
        naps,
        bedtime,
      });
    }
  }

  return Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export function computeSleepModel(
  sleeps: ProcessedSleep[],
  dayStartHour: number,
  dayEndHour: number,
  babyAgeMonths: number = 0
): SleepPredictionModel | null {
  const days = groupSleepsByDay(sleeps, dayStartHour, dayEndHour);

  const minNaps = babyAgeMonths >= 13 ? 1 : 2;
  const qualifyingDays = days.filter((d) => d.naps.length >= minNaps);
  const last7 = qualifyingDays.slice(-7);

  if (last7.length === 0) return null;

  const startRelativePools: Record<string, number[]> = {};
  const penultimatePool: number[] = [];
  const bedtimePool: number[] = [];
  const allNapDurations: number[] = [];
  const napCountDist: Record<number, number> = {};

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const day of last7) {
    const isToday = day.date === todayStr;
    const napCount = day.naps.length;
    if (!isToday) {
      napCountDist[napCount] = (napCountDist[napCount] || 0) + 1;
    }

    for (const nap of day.naps) {
      allNapDurations.push(nap.durationMinutes);
    }

    const wakeWindows: { position: number; minutes: number }[] = [];

    const firstNapGap = minutesBetween(day.morningWakeTime, day.naps[0].startedAt);
    wakeWindows.push({ position: 0, minutes: firstNapGap });

    for (let i = 1; i < day.naps.length; i++) {
      const gap = minutesBetween(day.naps[i - 1].endedAt, day.naps[i].startedAt);
      wakeWindows.push({ position: i, minutes: gap });
    }

    const penultimatePosition = napCount - 1;

    for (const ww of wakeWindows) {
      const isPenultimate = ww.position === penultimatePosition;

      if (isPenultimate) {
        penultimatePool.push(ww.minutes);
      } else {
        const key = String(ww.position);
        if (!startRelativePools[key]) startRelativePools[key] = [];
        startRelativePools[key].push(ww.minutes);
      }
    }

    if (day.bedtime) {
      const lastNap = day.naps[day.naps.length - 1];
      const bedtimeGap = minutesBetween(lastNap.endedAt, day.bedtime);
      bedtimePool.push(bedtimeGap);
    }
  }

  const startRelativeMedians: Record<string, number> = {};
  for (const [pos, values] of Object.entries(startRelativePools)) {
    startRelativeMedians[pos] = median(values);
  }

  const allStartRelativeValues = Object.values(startRelativePools).flat();
  const overallStartRelativeMedian =
    allStartRelativeValues.length > 0 ? median(allStartRelativeValues) : 60;

  for (const pos of Object.keys(startRelativeMedians)) {
    if (startRelativePools[pos].length === 0) {
      startRelativeMedians[pos] = overallStartRelativeMedian;
    }
  }

  if (Object.keys(napCountDist).length === 0) {
    for (const day of last7) {
      const napCount = day.naps.length;
      napCountDist[napCount] = (napCountDist[napCount] || 0) + 1;
    }
  }

  const napCounts = Object.entries(napCountDist)
    .map(([count, freq]) => ({ count: Number(count), freq }))
    .sort((a, b) => b.freq - a.freq || a.count - b.count);

  const primaryNapCount = napCounts[0].count;
  let secondaryNapCount: number | null = null;

  if (napCounts.length > 1) {
    const candidate = napCounts[1];
    if (
      Math.abs(candidate.count - primaryNapCount) === 1 &&
      candidate.freq >= 2
    ) {
      secondaryNapCount = candidate.count;
    }
  }

  return {
    primaryNapCount,
    secondaryNapCount,
    startRelativeWakeWindows: startRelativeMedians,
    penultimateWakeWindow: penultimatePool.length > 0 ? median(penultimatePool) : 60,
    bedtimeWakeWindow: bedtimePool.length > 0 ? median(bedtimePool) : 120,
    medianNapDuration: allNapDurations.length > 0 ? median(allNapDurations) : 45,
    napCountDistribution: napCountDist,
  };
}

export function getQualifyingDayCount(
  sleeps: ProcessedSleep[],
  dayStartHour: number,
  dayEndHour: number,
  babyAgeMonths: number
): number {
  const days = groupSleepsByDay(sleeps, dayStartHour, dayEndHour);
  const minNaps = babyAgeMonths >= 13 ? 1 : 2;
  return days.filter((d) => d.naps.length >= minNaps).length;
}

export function predictNextSleep(
  model: SleepPredictionModel,
  selectedNapCount: number,
  completedNapsToday: number,
  lastWakeTime: Date,
  dayEndHour: number,
  referenceDate?: Date
): SleepPrediction | null {
  const ref = referenceDate || lastWakeTime;
  const dayEndTime = hourToDate(dayEndHour, ref);

  if (completedNapsToday >= selectedNapCount) {
    return predictAfterAllNaps(model, completedNapsToday, lastWakeTime, dayEndTime);
  }

  const position = completedNapsToday;
  let wakeWindowMinutes: number;

  if (position === selectedNapCount - 1) {
    wakeWindowMinutes = model.penultimateWakeWindow;
  } else {
    const key = String(position);
    wakeWindowMinutes =
      model.startRelativeWakeWindows[key] ?? getFallbackWakeWindow(model);
  }

  const predictedNapStart = new Date(
    lastWakeTime.getTime() + wakeWindowMinutes * 60 * 1000
  );

  if (!isNapWorthIt(predictedNapStart, model, dayEndTime)) {
    const bedtime = new Date(
      lastWakeTime.getTime() + model.bedtimeWakeWindow * 60 * 1000
    );
    return { predictedTime: bedtime, type: "bedtime" };
  }

  return { predictedTime: predictedNapStart, type: "nap" };
}

function predictAfterAllNaps(
  model: SleepPredictionModel,
  completedNapsToday: number,
  lastWakeTime: Date,
  dayEndTime: Date
): SleepPrediction {
  const bedtime = new Date(
    lastWakeTime.getTime() + model.bedtimeWakeWindow * 60 * 1000
  );

  const gapToDayEnd = minutesBetween(lastWakeTime, dayEndTime);

  if (gapToDayEnd > model.bedtimeWakeWindow * 1.5) {
    const wakeWindowMinutes = getFallbackWakeWindow(model);
    const extraNapStart = new Date(
      lastWakeTime.getTime() + wakeWindowMinutes * 60 * 1000
    );

    if (isNapWorthIt(extraNapStart, model, dayEndTime)) {
      return { predictedTime: extraNapStart, type: "nap" };
    }
  }

  return { predictedTime: bedtime, type: "bedtime" };
}

const MIN_NAP_START_BEFORE_DAY_END = 20;

function isNapWorthIt(
  napStart: Date,
  _model: SleepPredictionModel,
  dayEndTime: Date
): boolean {
  const latestNapStart = new Date(dayEndTime.getTime() - MIN_NAP_START_BEFORE_DAY_END * 60 * 1000);
  return napStart.getTime() <= latestNapStart.getTime();
}

function getFallbackWakeWindow(model: SleepPredictionModel): number {
  const values = Object.values(model.startRelativeWakeWindows);
  return values.length > 0 ? median(values) : 60;
}

export function getQualifyingNightSleep(
  sleeps: StoredSleepEntry[],
  thresholdHour: number,
  referenceDate?: Date
): StoredSleepEntry | null {
  const ref = referenceDate || new Date();
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);

  const thresholdTime = hourToDate(thresholdHour, today);

  const qualifying = sleeps
    .filter((s) => {
      if (!s.endedAt) return false;
      const endedAt = new Date(s.endedAt);
      return endedAt.getTime() >= thresholdTime.getTime();
    })
    .sort(
      (a, b) =>
        new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime()
    );

  return qualifying.length > 0 ? qualifying[0] : null;
}

export function detectBedtimeDrift(
  sleeps: ProcessedSleep[],
  dayStartHour: number,
  dayEndHour: number
): DriftDetectionResult | null {
  const days = groupSleepsByDay(sleeps, dayStartHour, dayEndHour);
  if (days.length < 5) return null;

  const last5 = days.slice(-5);

  if (!areDatesConsecutive(last5.map((d) => d.date))) return null;

  const bedtimeHours: number[] = [];

  for (let i = 0; i < last5.length; i++) {
    const day = last5[i];
    const nextDayMorning = i + 1 < last5.length
      ? last5[i + 1].morningWakeTime
      : null;

    const candidates = sleeps
      .filter((s) => {
        if (s.durationMinutes <= 120) return false;
        if (s.startedAt.getTime() <= day.morningWakeTime.getTime()) return false;
        if (nextDayMorning && s.startedAt.getTime() >= nextDayMorning.getTime()) return false;
        return true;
      })
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    if (candidates.length === 0) return null;

    bedtimeHours.push(dateToFractionalHour(candidates[0].startedAt));
  }

  const allEarlyEnough = bedtimeHours.every((h) => dayEndHour - h >= 1);
  if (!allEarlyEnough) return null;

  const medianBedtime = median(bedtimeHours);

  return {
    type: "bedtime",
    suggestedHour: Math.round(medianBedtime * 2) / 2,
    currentHour: dayEndHour,
  };
}

export function detectMorningDrift(
  sleeps: ProcessedSleep[],
  dayStartHour: number,
  dayEndHour: number
): DriftDetectionResult | null {
  const days = groupSleepsByDay(sleeps, dayStartHour, dayEndHour);
  if (days.length < 5) return null;

  const last5 = days.slice(-5);

  if (!areDatesConsecutive(last5.map((d) => d.date))) return null;

  for (const day of last5) {
    if (day.naps.length === 0) return null;

    const firstNap = day.naps[0];
    const wakeWindow = minutesBetween(day.morningWakeTime, firstNap.startedAt);
    const napDuration = firstNap.durationMinutes;

    if (wakeWindow >= 30 || napDuration <= 90) return null;
  }

  const firstNapEnds = last5.map((d) =>
    dateToFractionalHour(d.naps[0].endedAt)
  );
  const suggestedHour = Math.round(median(firstNapEnds) * 2) / 2;

  return {
    type: "morning",
    suggestedHour,
    currentHour: dayStartHour,
  };
}

export function getAgeFallbackModel(
  birthDate: Date,
  now: Date = new Date()
): SleepPredictionModel | null {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);
  if (!ageGroup) return null;

  const progression = WAKE_WINDOW_PROGRESSIONS[ageGroup.label];
  if (!progression) return null;

  const startRelativeWakeWindows: Record<string, number> = {};
  for (let i = 0; i < progression.windows.length - 1; i++) {
    startRelativeWakeWindows[String(i)] = progression.windows[i];
  }

  const lastWindowIndex = progression.windows.length - 1;

  return {
    primaryNapCount: progression.napCount,
    secondaryNapCount: null,
    startRelativeWakeWindows,
    penultimateWakeWindow: progression.windows[lastWindowIndex - 1] ?? progression.windows[0],
    bedtimeWakeWindow: progression.windows[lastWindowIndex],
    medianNapDuration: 45,
    napCountDistribution: { [progression.napCount]: 7 },
  };
}
