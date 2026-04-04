import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { SmartSleepPrediction, WakeWindowConfig } from "@/types/wake-windows";
import { getDefaultWakeWindowConfig, getSleepAgeGroupForBaby } from "@/utils/sleepGoals";

const MIN_AGE_DAYS = 56;
const MIN_DATA_POINTS_PER_SLOT = 3;
const ROLLING_WINDOW_DAYS = 14;
const RANGE_HALF_WIDTH_MINUTES = 15;
const NAP_CONTINUATION_MINUTES = 20;

interface DayNapSequence {
  dateKey: string;
  morningWakeMs: number;
  morningWakeMinutesSinceMidnight: number;
  slots: SlotData[];
}

interface SlotData {
  slotIndex: number;
  wakeWindowMinutes: number;
  slotType: "nap" | "bedtime";
  napStartMinutesSinceMidnight: number;
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

  const nightStartsSorted = nightSleeps
    .map(n => ({ startMs: new Date(n.startedAt).getTime(), key: getDayKey(new Date(n.startedAt), dayStartHour) }))
    .sort((a, b) => a.startMs - b.startMs);

  const sequences: DayNapSequence[] = [];

  for (const [dateKey, day] of dayMap) {
    if (day.naps.length === 0) continue;

    const napGroups = groupNapsByContinuation(day.naps, NAP_CONTINUATION_MINUTES);
    const slots: SlotData[] = [];

    let lastWakeMs = day.morningWakeMs;
    const morningWakeDate = new Date(day.morningWakeMs);
    const morningWakeMinutesSinceMidnight = morningWakeDate.getHours() * 60 + morningWakeDate.getMinutes();

    for (let i = 0; i < napGroups.length; i++) {
      const group = napGroups[i];
      const napStartMs = new Date(group[0].startedAt).getTime();
      const napStartDate = new Date(napStartMs);
      const wakeWindowMinutes = (napStartMs - lastWakeMs) / (1000 * 60);

      if (wakeWindowMinutes > 0) {
        slots.push({
          slotIndex: i,
          wakeWindowMinutes,
          slotType: "nap",
          napStartMinutesSinceMidnight: napStartDate.getHours() * 60 + napStartDate.getMinutes(),
        });
      }

      const lastNapInGroup = group[group.length - 1];
      lastWakeMs = lastNapInGroup.endedAt
        ? new Date(lastNapInGroup.endedAt).getTime()
        : napStartMs;
    }

    const bedtimeNight = nightStartsSorted.find(n => n.key === dateKey && n.startMs > lastWakeMs);
    if (bedtimeNight && napGroups.length > 0) {
      const bedtimeWakeWindow = (bedtimeNight.startMs - lastWakeMs) / (1000 * 60);
      if (bedtimeWakeWindow > 0) {
        const bedtimeDate = new Date(bedtimeNight.startMs);
        slots.push({
          slotIndex: napGroups.length,
          wakeWindowMinutes: bedtimeWakeWindow,
          slotType: "bedtime",
          napStartMinutesSinceMidnight: bedtimeDate.getHours() * 60 + bedtimeDate.getMinutes(),
        });
      }
    }

    sequences.push({ dateKey, morningWakeMs: day.morningWakeMs, morningWakeMinutesSinceMidnight, slots });
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

  if (secondFreq >= 3) {
    const lowerCount = Math.min(modeCount, secondCount);
    return { isTransitioning: true, transitionNapCount: lowerCount, napCountsPerDay };
  }

  return { isTransitioning: false, transitionNapCount: modeCount, napCountsPerDay };
}

export function countConsecutiveDays(sequences: DayNapSequence[], now: Date): number {
  if (sequences.length === 0) return 0;

  const todayKey = getDayKey(now, 6);
  const dateKeys = new Set(sequences.map(s => s.dateKey));

  let count = 0;
  const d = new Date(now);

  for (let i = 0; i < 30; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dateKeys.has(key)) {
      count++;
    } else if (key !== todayKey) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }

  return count;
}

function getProgressiveAlpha(count: number): number {
  if (count >= 14) return 0.15;
  if (count >= 7) return 0.25;
  return 0.4;
}

interface EWMASlotResult {
  ewma: number;
  sd: number;
  count: number;
  slotType: "nap" | "bedtime";
}

function computePerSlotEWMA(
  sequences: DayNapSequence[]
): Map<number, EWMASlotResult> {
  const sorted = [...sequences].sort(
    (a, b) => a.morningWakeMs - b.morningWakeMs
  );

  const slotValues = new Map<number, { values: number[]; slotType: "nap" | "bedtime" }>();

  for (const seq of sorted) {
    for (const slot of seq.slots) {
      const existing = slotValues.get(slot.slotIndex);
      if (existing) {
        existing.values.push(slot.wakeWindowMinutes);
      } else {
        slotValues.set(slot.slotIndex, {
          values: [slot.wakeWindowMinutes],
          slotType: slot.slotType,
        });
      }
    }
  }

  const result = new Map<number, EWMASlotResult>();

  for (const [slotIndex, { values, slotType }] of slotValues) {
    const count = values.length;
    const alpha = getProgressiveAlpha(count);

    let ewma = values[0];
    let ewmaVar = 0;

    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - ewma;
      ewma = alpha * values[i] + (1 - alpha) * ewma;
      ewmaVar = alpha * diff * diff + (1 - alpha) * ewmaVar;
    }

    result.set(slotIndex, {
      ewma,
      sd: Math.sqrt(ewmaVar),
      count,
      slotType,
    });
  }

  return result;
}

function computeDynamicHalfWidth(sd: number): number {
  return Math.round(Math.min(25, Math.max(10, 1.5 * sd)));
}

const CLOCK_TIME_MIN_DATA_POINTS = 5;

interface ClockTimeEWMAResult {
  ewma: number;
  sd: number;
  count: number;
}

function computeClockTimeEWMA(
  sequences: DayNapSequence[]
): Map<number, ClockTimeEWMAResult> {
  const sorted = [...sequences].sort(
    (a, b) => a.morningWakeMs - b.morningWakeMs
  );

  const slotValues = new Map<number, number[]>();

  for (const seq of sorted) {
    for (const slot of seq.slots) {
      const existing = slotValues.get(slot.slotIndex);
      if (existing) {
        existing.push(slot.napStartMinutesSinceMidnight);
      } else {
        slotValues.set(slot.slotIndex, [slot.napStartMinutesSinceMidnight]);
      }
    }
  }

  const result = new Map<number, ClockTimeEWMAResult>();

  for (const [slotIndex, values] of slotValues) {
    const count = values.length;
    const alpha = getProgressiveAlpha(count);

    let ewma = values[0];
    let ewmaVar = 0;

    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - ewma;
      ewma = alpha * values[i] + (1 - alpha) * ewma;
      ewmaVar = alpha * diff * diff + (1 - alpha) * ewmaVar;
    }

    result.set(slotIndex, { ewma, sd: Math.sqrt(ewmaVar), count });
  }

  return result;
}

function computeMorningWakeEWMA(sequences: DayNapSequence[]): ClockTimeEWMAResult | null {
  const sorted = [...sequences].sort(
    (a, b) => a.morningWakeMs - b.morningWakeMs
  );

  const values = sorted.map(s => s.morningWakeMinutesSinceMidnight);
  if (values.length === 0) return null;

  const count = values.length;
  const alpha = getProgressiveAlpha(count);

  let ewma = values[0];
  let ewmaVar = 0;

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - ewma;
    ewma = alpha * values[i] + (1 - alpha) * ewma;
    ewmaVar = alpha * diff * diff + (1 - alpha) * ewmaVar;
  }

  return { ewma, sd: Math.sqrt(ewmaVar), count };
}

export function getCircadianMaturity(ageWeeks: number): number {
  return 1 / (1 + Math.exp(-(ageWeeks - 12) / 4));
}

const SLOT_WEIGHTS: Record<string, number> = {
  nap1: 0.7,
  nap2: 0.6,
  nap3: 0.3,
  bedtime: 0.8,
};

export function getSlotWeight(slotIndex: number, slotType: "nap" | "bedtime", _napCount: number): number {
  if (slotType === "bedtime") return SLOT_WEIGHTS.bedtime;
  const key = `nap${slotIndex + 1}`;
  return SLOT_WEIGHTS[key] ?? 0.3;
}

export function getSDConfidence(clockTimeSD: number): number {
  return Math.max(0, 1 - clockTimeSD / 60);
}

interface ClockAdjustmentInput {
  basePredictionMinutesSinceMidnight: number;
  clockAnchorMinutesSinceMidnight: number;
  effectiveClockWeight: number;
}

function computeClockAdjustment(input: ClockAdjustmentInput): number {
  const { basePredictionMinutesSinceMidnight, clockAnchorMinutesSinceMidnight, effectiveClockWeight } = input;
  const deviation = basePredictionMinutesSinceMidnight - clockAnchorMinutesSinceMidnight;
  const factor = deviation > 0 ? 0.8 : 0.4;
  return -deviation * effectiveClockWeight * factor;
}

function computeUnusualWakeDampener(
  actualWakeMinutes: number,
  ewmaWakeMinutes: number
): number {
  const deviation = ewmaWakeMinutes - actualWakeMinutes;
  if (deviation <= 45) return 1.0;
  return Math.max(0.1, 1 - (deviation - 45) / 90);
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

  const sequences = reconstructDaySequences(
    sleepEntries,
    dayStartHour,
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

  const slotEWMA = computePerSlotEWMA(filteredSequences);
  const clockTimeEWMA = computeClockTimeEWMA(filteredSequences);
  const morningWakeEWMA = computeMorningWakeEWMA(filteredSequences);
  const slotData = slotEWMA.get(currentNapSlotIndex);
  const clockData = clockTimeEWMA.get(currentNapSlotIndex);
  const consecutiveDays = countConsecutiveDays(sequences, now);

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
      consecutiveDays,
    };
  }

  const centerMinutes = Math.round(slotData.ewma);
  const halfWidthMinutes = computeDynamicHalfWidth(slotData.sd);

  let clockAnchorMinutes: number | undefined;
  if (clockData && clockData.count >= CLOCK_TIME_MIN_DATA_POINTS) {
    clockAnchorMinutes = Math.round(clockData.ewma);
  }

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
    standardDeviation: Math.round(slotData.sd * 10) / 10,
    halfWidthMinutes,
    consecutiveDays,
    clockAnchorMinutes,
    clockTimeSD: clockData?.sd !== undefined ? Math.round(clockData.sd * 10) / 10 : undefined,
    morningWakeEWMA: morningWakeEWMA?.ewma !== undefined ? Math.round(morningWakeEWMA.ewma * 10) / 10 : undefined,
  };
}

export function computePredictionWithTiming(
  sleepEntries: StoredSleepEntry[],
  babyBirthDate: string,
  currentNapSlotIndex: number,
  wakeWindowConfig: WakeWindowConfig | null,
  lastWakeTimeMs: number,
  now: Date = new Date(),
  todayNapsDone?: number,
  isAutoAdvanced?: boolean
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

  let adjustedCenterMinutes = prediction.centerMinutes;

  if (prediction.confidence === "personalized" && prediction.clockAnchorMinutes !== undefined) {
    const ageDays = getAgeDays(babyBirthDate, now);
    const ageWeeks = ageDays / 7;
    const maturity = getCircadianMaturity(ageWeeks);
    const slotWeight = getSlotWeight(currentNapSlotIndex, prediction.slotType, wakeWindowConfig?.napCount ?? 3);
    const sdFactor = getSDConfidence(prediction.clockTimeSD ?? 60);

    let effectiveClockWeight = maturity * slotWeight * sdFactor;

    if (isAutoAdvanced) {
      effectiveClockWeight = 0.9;
    }

    if (currentNapSlotIndex === 0 && prediction.morningWakeEWMA !== undefined) {
      const lastWakeDate = new Date(lastWakeTimeMs);
      const actualWakeMinutes = lastWakeDate.getHours() * 60 + lastWakeDate.getMinutes();
      const dampener = computeUnusualWakeDampener(actualWakeMinutes, prediction.morningWakeEWMA);
      effectiveClockWeight *= dampener;
    }

    const basePredictionMs = lastWakeTimeMs + prediction.centerMinutes * 60 * 1000;
    const basePredictionDate = new Date(basePredictionMs);
    const basePredictionMinutesSinceMidnight = basePredictionDate.getHours() * 60 + basePredictionDate.getMinutes();

    const adjustment = computeClockAdjustment({
      basePredictionMinutesSinceMidnight,
      clockAnchorMinutesSinceMidnight: prediction.clockAnchorMinutes,
      effectiveClockWeight,
    });

    const ageGroup = getSleepAgeGroupForBaby(new Date(babyBirthDate), now);
    const minWW = ageGroup?.wakeWindowMinMinutes ?? 60;
    const maxWW = ageGroup?.wakeWindowMaxMinutes ?? 360;

    const lowerBound = Math.min(prediction.centerMinutes, minWW);
    const upperBound = Math.max(prediction.centerMinutes, maxWW);
    const adjustedMinutes = prediction.centerMinutes + adjustment;
    adjustedCenterMinutes = Math.round(Math.min(upperBound, Math.max(lowerBound, adjustedMinutes)));
  }

  const halfWidth = prediction.halfWidthMinutes ?? RANGE_HALF_WIDTH_MINUTES;
  const centerMs = lastWakeTimeMs + adjustedCenterMinutes * 60 * 1000;
  const rangeStartMs = centerMs - halfWidth * 60 * 1000;
  const rangeEndMs = centerMs + halfWidth * 60 * 1000;

  return {
    ...prediction,
    centerMinutes: adjustedCenterMinutes,
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

  const sequences = reconstructDaySequences(
    sleepEntries,
    dayStartHour,
    ROLLING_WINDOW_DAYS,
    now
  );

  const ewmaResult = computePerSlotEWMA(sequences);
  const result = new Map<number, { avg: number; count: number; slotType: "nap" | "bedtime" }>();
  for (const [slotIndex, data] of ewmaResult) {
    result.set(slotIndex, { avg: data.ewma, count: data.count, slotType: data.slotType });
  }
  return result;
}

export { MIN_AGE_DAYS, MIN_DATA_POINTS_PER_SLOT, ROLLING_WINDOW_DAYS, RANGE_HALF_WIDTH_MINUTES, NAP_CONTINUATION_MINUTES, CLOCK_TIME_MIN_DATA_POINTS };
