import type { WakeWindowConfig, NapSlotWindow } from "@/types/wake-windows";

export interface SleepAgeGroup {
  label: string;
  minAgeDays: number;
  maxAgeDays: number;
  totalSleepHoursMin: number;
  totalSleepHoursMax: number;
  napsMin: number;
  napsMax: number;
  wakeWindowMinMinutes: number;
  wakeWindowMaxMinutes: number;
}

export type GoalSource = "age_based" | "custom";

export interface SleepGoalInfo {
  targetMinutes: number;
  minHours: number;
  maxHours: number;
  source: GoalSource;
  ageGroup: SleepAgeGroup | null;
}

export interface WakeWindowInfo {
  minMinutes: number;
  maxMinutes: number;
  targetMinutes: number;
}

export interface NapsInfo {
  minNaps: number;
  maxNaps: number;
}

export interface SleepGoalRange {
  minHours: number;
  maxHours: number;
  targetMinutes: number;
}

export interface SleepMilestoneCrossing {
  previousGroup: SleepAgeGroup;
  newGroup: SleepAgeGroup;
  shouldSuggestGoalUpdate: boolean;
}

export const SLEEP_AGE_GROUPS: SleepAgeGroup[] = [
  {
    label: "0-2 months",
    minAgeDays: 0,
    maxAgeDays: 60,
    totalSleepHoursMin: 15,
    totalSleepHoursMax: 17,
    napsMin: 4,
    napsMax: 5,
    wakeWindowMinMinutes: 30,
    wakeWindowMaxMinutes: 60,
  },
  {
    label: "3-5 months",
    minAgeDays: 61,
    maxAgeDays: 150,
    totalSleepHoursMin: 14,
    totalSleepHoursMax: 15,
    napsMin: 3,
    napsMax: 4,
    wakeWindowMinMinutes: 60,
    wakeWindowMaxMinutes: 120,
  },
  {
    label: "6-8 months",
    minAgeDays: 151,
    maxAgeDays: 240,
    totalSleepHoursMin: 14,
    totalSleepHoursMax: 14,
    napsMin: 2,
    napsMax: 3,
    wakeWindowMinMinutes: 120,
    wakeWindowMaxMinutes: 180,
  },
  {
    label: "9-12 months",
    minAgeDays: 241,
    maxAgeDays: 365,
    totalSleepHoursMin: 13,
    totalSleepHoursMax: 14,
    napsMin: 2,
    napsMax: 2,
    wakeWindowMinMinutes: 150,
    wakeWindowMaxMinutes: 210,
  },
  {
    label: "13-18 months",
    minAgeDays: 366,
    maxAgeDays: 540,
    totalSleepHoursMin: 13,
    totalSleepHoursMax: 14,
    napsMin: 1,
    napsMax: 2,
    wakeWindowMinMinutes: 180,
    wakeWindowMaxMinutes: 240,
  },
  {
    label: "19+ months",
    minAgeDays: 541,
    maxAgeDays: Infinity,
    totalSleepHoursMin: 11,
    totalSleepHoursMax: 12,
    napsMin: 0,
    napsMax: 1,
    wakeWindowMinMinutes: 240,
    wakeWindowMaxMinutes: 360,
  },
];

export function getSleepAgeGroupForBaby(
  birthDate: Date,
  now: Date = new Date()
): SleepAgeGroup | null {
  const ageDays = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays < 0) return null;

  for (const group of SLEEP_AGE_GROUPS) {
    if (ageDays >= group.minAgeDays && ageDays <= group.maxAgeDays) {
      return group;
    }
  }

  return SLEEP_AGE_GROUPS[SLEEP_AGE_GROUPS.length - 1];
}

export function getDefaultSleepGoalForAge(
  birthDate: Date,
  now: Date = new Date()
): SleepGoalRange {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);

  if (!ageGroup) {
    return {
      minHours: 14,
      maxHours: 14,
      targetMinutes: 14 * 60,
    };
  }

  const midpointHours = (ageGroup.totalSleepHoursMin + ageGroup.totalSleepHoursMax) / 2;

  return {
    minHours: ageGroup.totalSleepHoursMin,
    maxHours: ageGroup.totalSleepHoursMax,
    targetMinutes: midpointHours * 60,
  };
}

export function getWakeWindowForAge(birthDate: Date, now: Date = new Date()): WakeWindowInfo {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);

  if (!ageGroup) {
    return {
      minMinutes: 120,
      maxMinutes: 180,
      targetMinutes: 150,
    };
  }

  const midpoint = (ageGroup.wakeWindowMinMinutes + ageGroup.wakeWindowMaxMinutes) / 2;

  return {
    minMinutes: ageGroup.wakeWindowMinMinutes,
    maxMinutes: ageGroup.wakeWindowMaxMinutes,
    targetMinutes: midpoint,
  };
}

export function getNapsForAge(birthDate: Date, now: Date = new Date()): NapsInfo {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);

  if (!ageGroup) {
    return {
      minNaps: 2,
      maxNaps: 3,
    };
  }

  return {
    minNaps: ageGroup.napsMin,
    maxNaps: ageGroup.napsMax,
  };
}

export function checkSleepMilestoneCrossing(
  birthDate: Date,
  lastCheckedDate: Date,
  now: Date = new Date()
): SleepMilestoneCrossing | null {
  const previousGroup = getSleepAgeGroupForBaby(birthDate, lastCheckedDate);
  const currentGroup = getSleepAgeGroupForBaby(birthDate, now);

  if (!previousGroup || !currentGroup) return null;

  if (previousGroup.label !== currentGroup.label) {
    const prevTarget =
      (previousGroup.totalSleepHoursMin + previousGroup.totalSleepHoursMax) / 2;
    const newTarget = (currentGroup.totalSleepHoursMin + currentGroup.totalSleepHoursMax) / 2;

    return {
      previousGroup,
      newGroup: currentGroup,
      shouldSuggestGoalUpdate: prevTarget !== newTarget,
    };
  }

  return null;
}

export function getSleepGoalInfo(
  birthDate: Date | undefined,
  customGoalMinutes: number | null,
  now: Date = new Date()
): SleepGoalInfo {
  if (customGoalMinutes !== null && customGoalMinutes > 0) {
    const ageGroup = birthDate ? getSleepAgeGroupForBaby(birthDate, now) : null;
    return {
      targetMinutes: customGoalMinutes,
      minHours: ageGroup?.totalSleepHoursMin ?? 14,
      maxHours: ageGroup?.totalSleepHoursMax ?? 14,
      source: "custom",
      ageGroup,
    };
  }

  if (!birthDate) {
    return {
      targetMinutes: 14 * 60,
      minHours: 14,
      maxHours: 14,
      source: "age_based",
      ageGroup: null,
    };
  }

  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);
  const goalRange = getDefaultSleepGoalForAge(birthDate, now);

  return {
    targetMinutes: goalRange.targetMinutes,
    minHours: goalRange.minHours,
    maxHours: goalRange.maxHours,
    source: "age_based",
    ageGroup,
  };
}

interface WakeWindowProgression {
  napCount: number;
  windows: number[];
}

const WAKE_WINDOW_PROGRESSIONS: Record<string, WakeWindowProgression> = {
  "0-2 months": { napCount: 5, windows: [30, 36, 42, 48, 54, 60] },
  "3-5 months": { napCount: 4, windows: [60, 75, 90, 105, 120] },
  "6-8 months": { napCount: 3, windows: [120, 140, 160, 180] },
  "9-12 months": { napCount: 2, windows: [150, 180, 210] },
  "13-18 months": { napCount: 2, windows: [180, 210, 240] },
  "19+ months": { napCount: 1, windows: [240, 360] },
};

function generateProgressiveSlots(napCount: number, minMinutes: number, maxMinutes: number): NapSlotWindow[] {
  const slotCount = napCount + 1;
  const slots: NapSlotWindow[] = [];

  for (let i = 0; i < slotCount; i++) {
    const t = slotCount === 1 ? 0 : i / (slotCount - 1);
    const duration = Math.round(minMinutes + t * (maxMinutes - minMinutes));
    const isLast = i === slotCount - 1;
    slots.push({
      slotIndex: i,
      label: isLast ? "bedtime" : `nap${i + 1}`,
      durationMinutes: duration,
    });
  }

  return slots;
}

export function getDefaultWakeWindowConfig(
  birthDate: Date,
  now: Date = new Date()
): WakeWindowConfig {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);

  if (!ageGroup) {
    return {
      napCount: 2,
      slots: generateProgressiveSlots(2, 120, 180),
      source: "age_based",
    };
  }

  const progression = WAKE_WINDOW_PROGRESSIONS[ageGroup.label];

  if (progression) {
    const slots: NapSlotWindow[] = progression.windows.map((duration, i) => ({
      slotIndex: i,
      label: i === progression.windows.length - 1 ? "bedtime" : `nap${i + 1}`,
      durationMinutes: duration,
    }));

    return {
      napCount: progression.napCount,
      slots,
      source: "age_based",
    };
  }

  return {
    napCount: ageGroup.napsMax,
    slots: generateProgressiveSlots(
      ageGroup.napsMax,
      ageGroup.wakeWindowMinMinutes,
      ageGroup.wakeWindowMaxMinutes
    ),
    source: "age_based",
  };
}

export function generateSlotsForNapCount(
  napCount: number,
  birthDate: Date,
  now: Date = new Date()
): NapSlotWindow[] {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);
  const minMinutes = ageGroup?.wakeWindowMinMinutes ?? 120;
  const maxMinutes = ageGroup?.wakeWindowMaxMinutes ?? 180;
  return generateProgressiveSlots(napCount, minMinutes, maxMinutes);
}

export function getPresetPillsForAge(
  birthDate: Date,
  now: Date = new Date()
): number[] {
  const ageGroup = getSleepAgeGroupForBaby(birthDate, now);
  if (!ageGroup) return [60, 90, 120, 150, 180];

  const min = ageGroup.wakeWindowMinMinutes;
  const max = ageGroup.wakeWindowMaxMinutes;
  const range = max - min;

  if (range <= 30) {
    return [min, Math.round((min + max) / 2), max];
  }

  const step = Math.round(range / 4);
  const presets: number[] = [];
  for (let v = min; v <= max; v += step) {
    presets.push(v);
  }
  if (presets[presets.length - 1] !== max) {
    presets.push(max);
  }

  return presets;
}
