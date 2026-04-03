import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { SmartSleepPrediction, WakeWindowConfig } from "@/types/wake-windows";
import { countNapsWithContinuation } from "@/utils/day-night-boundary";
import { getDefaultWakeWindowConfig } from "@/utils/sleepGoals";

const MIN_AGE_DAYS = 56;
const MIN_DATA_POINTS_PER_SLOT = 3;
const ROLLING_WINDOW_DAYS = 7;
const RANGE_HALF_WIDTH_MINUTES = 15;

interface DayNapSequence {
  dateKey: string;
  morningWakeMs: number;
  slots: SlotData[];
}

interface SlotData {
  slotIndex: number;
  wakeWindowMinutes: number;
  slotType: "nap" | "bedtime";
}

export function getAgeDays(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(birthDate);
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
}

export function isSmartSleepEligible(birthDate: string, now: Date = new Date()): boolean {
  return getAgeDays(birthDate, now) >= MIN_AGE_DAYS;
}

function getDayKey(date: Date, dayStartHour: number): string {
  const adjusted = new Date(date.getTime());
  if (adjusted.getHours() < dayStartHour) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, "0")}-${String(adjusted.getDate()).padStart(2, "0")}`;
}

function groupNapsByContinuation(
  naps: StoredSleepEntry[],
  thresholdMinutes: number
): StoredSleepEntry[][] {
  if (naps.length === 0) return [];

  const sorted = [...naps].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  const groups: StoredSleepEntry[][] = [[sorted[0]]];
  const thresholdMs = thresholdMinutes * 60 * 1000;

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].endedAt
      ? new Date(sorted[i - 1].endedAt!).getTime()
      : new Date(sorted[i - 1].startedAt).getTime();
    const currStart = new Date(sorted[i].startedAt).getTime();
    const gap = currStart - prevEnd;

    if (gap >= thresholdMs) {
      groups.push([sorted[i]]);
    } else {
      groups[groups.length - 1].push(sorted[i]);
    }
  }

  return groups;
}

function reconstructDaySequences(
  sleepEntries: StoredSleepEntry[],
  dayStartHour: number,
  dayEndHour: number,
  napContinuationMinutes: number,
  lookbackDays: number,
  now: Date
): DayNapSequence[] {
  const cutoff = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const nightSleeps = sleepEntries
    .filter(s => s.type === "night" && s.endedAt && new Date(s.endedAt) >= cutoff)
    .sort((a, b) => new Date(a.endedAt!).getTime() - new Date(b.endedAt!).getTime());

  const naps = sleepEntries
    .filter(s => s.type === "nap" && s.endedAt && new Date(s.startedAt) >= cutoff)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  const dayMap = new Map<string, { morningWakeMs: number; naps: StoredSleepEntry[] }>();

  for (const night of nightSleeps) {
    const wakeTime = new Date(night.endedAt!);
    const key = getDayKey(wakeTime, dayStartHour);
    if (!dayMap.has(key)) {
      dayMap.set(key, { morningWakeMs: wakeTime.getTime(), naps: [] });
    } else {
      const existing = dayMap.get(key)!;
      if (wakeTime.getTime() > existing.morningWakeMs) {
        existing.morningWakeMs = wakeTime.getTime();
      }
    }
  }

  for (const nap of naps) {
    const key = getDayKey(new Date(nap.startedAt), dayStartHour);
    if (!dayMap.has(key)) continue;
    dayMap.get(key)!.naps.push(nap);
  }

  const sequences: DayNapSequence[] = [];

  for (const [dateKey, day] of dayMap) {
    if (day.naps.length === 0) continue;

    const napGroups = groupNapsByContinuation(day.naps, napContinuationMinutes);
    const slots: SlotData[] = [];

    let lastWakeMs = day.morningWakeMs;

    for (let i = 0; i < napGroups.length; i++) {
      const group = napGroups[i];
      const napStartMs = new Date(group[0].startedAt).getTime();
      const wakeWindowMinutes = (napStartMs - lastWakeMs) / (1000 * 60);

      if (wakeWindowMinutes > 0) {
        slots.push({
          slotIndex: i,
          wakeWindowMinutes,
          slotType: "nap",
        });
      }

      const lastNapInGroup = group[group.length - 1];
      lastWakeMs = lastNapInGroup.endedAt
        ? new Date(lastNapInGroup.endedAt).getTime()
        : napStartMs;
    }

    const dayEndMs = new Date(day.morningWakeMs);
    dayEndMs.setHours(dayEndHour, 0, 0, 0);
    if (dayEndMs.getTime() <= day.morningWakeMs) {
      dayEndMs.setDate(dayEndMs.getDate() + 1);
    }

    const bedtimeWakeWindow = (dayEndMs.getTime() - lastWakeMs) / (1000 * 60);
    if (bedtimeWakeWindow > 0 && napGroups.length > 0) {
      slots.push({
        slotIndex: napGroups.length,
        wakeWindowMinutes: bedtimeWakeWindow,
        slotType: "bedtime",
      });
    }

    sequences.push({ dateKey, morningWakeMs: day.morningWakeMs, slots });
  }

  return sequences;
}

interface NapTransitionInfo {
  isTransitioning: boolean;
  transitionNapCount: number;
  napCountsPerDay: Map<string, number>;
}

export function detectNapTransition(
  sequences: DayNapSequence[]
): NapTransitionInfo {
  const napCountsPerDay = new Map<string, number>();
  for (const seq of sequences) {
    const napCount = seq.slots.filter(s => s.slotType === "nap").length;
    napCountsPerDay.set(seq.dateKey, napCount);
  }

  const freq = new Map<number, number>();
  for (const count of napCountsPerDay.values()) {
    freq.set(count, (freq.get(count) ?? 0) + 1);
  }

  if (freq.size < 2) {
    const mode = napCountsPerDay.size > 0
      ? napCountsPerDay.values().next().value!
      : 0;
    return { isTransitioning: false, transitionNapCount: mode, napCountsPerDay };
  }

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const [modeCount] = sorted[0];
  const [secondCount, secondFreq] = sorted[1];

  if (secondFreq >= 2) {
    const lowerCount = Math.min(modeCount, secondCount);
    return { isTransitioning: true, transitionNapCount: lowerCount, napCountsPerDay };
  }

  return { isTransitioning: false, transitionNapCount: modeCount, napCountsPerDay };
}

function computePerSlotAverages(
  sequences: DayNapSequence[]
): Map<number, { avg: number; count: number; slotType: "nap" | "bedtime" }> {
  const slotAccumulators = new Map<number, { total: number; count: number; slotType: "nap" | "bedtime" }>();

  for (const seq of sequences) {
    for (const slot of seq.slots) {
      const existing = slotAccumulators.get(slot.slotIndex);
      if (existing) {
        existing.total += slot.wakeWindowMinutes;
        existing.count += 1;
      } else {
        slotAccumulators.set(slot.slotIndex, {
          total: slot.wakeWindowMinutes,
          count: 1,
          slotType: slot.slotType,
        });
      }
    }
  }

  const result = new Map<number, { avg: number; count: number; slotType: "nap" | "bedtime" }>();

  for (const [slotIndex, acc] of slotAccumulators) {
    result.set(slotIndex, {
      avg: acc.total / acc.count,
      count: acc.count,
      slotType: acc.slotType,
    });
  }

  return result;
}

export function computeSmartSleepPrediction(
  sleepEntries: StoredSleepEntry[],
  babyBirthDate: string,
  currentNapSlotIndex: number,
  wakeWindowConfig: WakeWindowConfig | null,
  now: Date = new Date(),
  todayNapsDone?: number
): SmartSleepPrediction {
  if (!isSmartSleepEligible(babyBirthDate, now)) {
    return {
      rangeStartMs: 0,
      rangeEndMs: 0,
      slotType: "nap",
      slotIndex: currentNapSlotIndex,
      confidence: "age_based",
      isEligible: false,
      centerMinutes: 0,
    };
  }

  const config = wakeWindowConfig ?? getDefaultWakeWindowConfig(new Date(babyBirthDate), now);
  const dayStartHour = config.dayStartHour ?? 6;
  const dayEndHour = config.dayEndHour ?? 19;
  const napContinuationMinutes = config.napContinuationMinutes ?? 15;

  const sequences = reconstructDaySequences(
    sleepEntries,
    dayStartHour,
    dayEndHour,
    napContinuationMinutes,
    ROLLING_WINDOW_DAYS,
    now
  );

  const transition = detectNapTransition(sequences);

  let filteredSequences = sequences;
  if (transition.isTransitioning && todayNapsDone !== undefined) {
    const higherCount = Math.max(...[...transition.napCountsPerDay.values()]);
    const targetCount = todayNapsDone > transition.transitionNapCount
      ? higherCount
      : transition.transitionNapCount;

    const filtered = sequences.filter(seq => {
      const napCount = seq.slots.filter(s => s.slotType === "nap").length;
      return napCount === targetCount;
    });

    if (filtered.length >= MIN_DATA_POINTS_PER_SLOT) {
      filteredSequences = filtered;
    }
  }

  const slotAverages = computePerSlotAverages(filteredSequences);
  const slotData = slotAverages.get(currentNapSlotIndex);

  if (!slotData || slotData.count < MIN_DATA_POINTS_PER_SLOT) {
    const fallbackConfig = getDefaultWakeWindowConfig(new Date(babyBirthDate), now);
    const fallbackSlot = fallbackConfig.slots.find(s => s.slotIndex === currentNapSlotIndex);
    const fallbackMinutes = fallbackSlot?.durationMinutes ?? 120;

    return {
      rangeStartMs: 0,
      rangeEndMs: 0,
      slotType: currentNapSlotIndex >= (config.napCount) ? "bedtime" : "nap",
      slotIndex: currentNapSlotIndex,
      confidence: "age_based",
      isEligible: true,
      centerMinutes: fallbackMinutes,
      isTransitioning: transition.isTransitioning || undefined,
      transitionNapCount: transition.isTransitioning ? transition.transitionNapCount : undefined,
    };
  }

  const centerMinutes = Math.round(slotData.avg);

  return {
    rangeStartMs: 0,
    rangeEndMs: 0,
    slotType: slotData.slotType,
    slotIndex: currentNapSlotIndex,
    confidence: "personalized",
    isEligible: true,
    centerMinutes,
    isTransitioning: transition.isTransitioning || undefined,
    transitionNapCount: transition.isTransitioning ? transition.transitionNapCount : undefined,
  };
}

export function computePredictionWithTiming(
  sleepEntries: StoredSleepEntry[],
  babyBirthDate: string,
  currentNapSlotIndex: number,
  wakeWindowConfig: WakeWindowConfig | null,
  lastWakeTimeMs: number,
  now: Date = new Date(),
  todayNapsDone?: number
): SmartSleepPrediction {
  const prediction = computeSmartSleepPrediction(
    sleepEntries,
    babyBirthDate,
    currentNapSlotIndex,
    wakeWindowConfig,
    now,
    todayNapsDone
  );

  if (!prediction.isEligible || lastWakeTimeMs === 0) {
    return prediction;
  }

  const centerMs = lastWakeTimeMs + prediction.centerMinutes * 60 * 1000;
  const rangeStartMs = centerMs - RANGE_HALF_WIDTH_MINUTES * 60 * 1000;
  const rangeEndMs = centerMs + RANGE_HALF_WIDTH_MINUTES * 60 * 1000;

  return {
    ...prediction,
    rangeStartMs,
    rangeEndMs,
  };
}

export function getPerSlotAverages(
  sleepEntries: StoredSleepEntry[],
  babyBirthDate: string,
  wakeWindowConfig: WakeWindowConfig | null,
  now: Date = new Date()
): Map<number, { avg: number; count: number; slotType: "nap" | "bedtime" }> {
  const config = wakeWindowConfig ?? getDefaultWakeWindowConfig(new Date(babyBirthDate), now);
  const dayStartHour = config.dayStartHour ?? 6;
  const dayEndHour = config.dayEndHour ?? 19;
  const napContinuationMinutes = config.napContinuationMinutes ?? 15;

  const sequences = reconstructDaySequences(
    sleepEntries,
    dayStartHour,
    dayEndHour,
    napContinuationMinutes,
    ROLLING_WINDOW_DAYS,
    now
  );

  return computePerSlotAverages(sequences);
}

export { MIN_AGE_DAYS, MIN_DATA_POINTS_PER_SLOT, ROLLING_WINDOW_DAYS, RANGE_HALF_WIDTH_MINUTES };
