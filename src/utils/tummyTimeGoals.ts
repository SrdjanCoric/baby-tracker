/**
 * Tummy time smart goals utilities
 * Age-based default goals with user customization based on AAP/WHO research
 */

export interface AgeGroup {
  label: string;
  minAgeDays: number;
  maxAgeDays: number;
  defaultGoalSeconds: number;
  rationale: string;
}

export type GoalSource = "age_based" | "custom";

export interface GoalInfo {
  goalSeconds: number;
  source: GoalSource;
  ageGroup: AgeGroup | null;
}

export const AGE_GROUPS: AgeGroup[] = [
  {
    label: "0-2 weeks",
    minAgeDays: 0,
    maxAgeDays: 14,
    defaultGoalSeconds: 2 * 60, // 2 min
    rationale: "2 sessions of ~1 min (AAP newborn guidance)",
  },
  {
    label: "2-4 weeks",
    minAgeDays: 15,
    maxAgeDays: 28,
    defaultGoalSeconds: 5 * 60, // 5 min
    rationale: "2-3 sessions of ~2 min",
  },
  {
    label: "1-2 months",
    minAgeDays: 29,
    maxAgeDays: 60,
    defaultGoalSeconds: 10 * 60, // 10 min
    rationale: "Short sessions building tolerance",
  },
  {
    label: "2-3 months",
    minAgeDays: 61,
    maxAgeDays: 90,
    defaultGoalSeconds: 20 * 60, // 20 min
    rationale: "Gradual increase with better head control",
  },
  {
    label: "3-4 months",
    minAgeDays: 91,
    maxAgeDays: 120,
    defaultGoalSeconds: 30 * 60, // 30 min
    rationale: "Building toward AAP target",
  },
  {
    label: "4-6 months",
    minAgeDays: 121,
    maxAgeDays: 180,
    defaultGoalSeconds: 45 * 60, // 45 min
    rationale: "Approaching AAP/Pathways target",
  },
  {
    label: "6+ months",
    minAgeDays: 181,
    maxAgeDays: Infinity,
    defaultGoalSeconds: 60 * 60, // 60 min
    rationale: "Consensus target, transitions to floor play",
  },
];

export function getAgeGroupForBaby(birthDate: Date, now: Date = new Date()): AgeGroup | null {
  const ageDays = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays < 0) return null;

  for (const group of AGE_GROUPS) {
    if (ageDays >= group.minAgeDays && ageDays <= group.maxAgeDays) {
      return group;
    }
  }

  return AGE_GROUPS[AGE_GROUPS.length - 1];
}

export function getDefaultGoalForAge(birthDate: Date, now: Date = new Date()): number {
  const ageGroup = getAgeGroupForBaby(birthDate, now);
  return ageGroup?.defaultGoalSeconds ?? 10 * 60; // Default to 10 min if no birthdate
}

export function getAgeGroupLabel(birthDate: Date, now: Date = new Date()): string {
  const ageGroup = getAgeGroupForBaby(birthDate, now);
  return ageGroup?.label ?? "Unknown";
}

export function isBabySixMonthsOrOlder(birthDate: Date, now: Date = new Date()): boolean {
  const ageDays = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
  return ageDays >= 181;
}

export interface MilestoneCrossing {
  previousGroup: AgeGroup;
  newGroup: AgeGroup;
  shouldSuggestGoalUpdate: boolean;
}

export function checkMilestoneCrossing(
  birthDate: Date,
  lastCheckedDate: Date,
  now: Date = new Date()
): MilestoneCrossing | null {
  const previousGroup = getAgeGroupForBaby(birthDate, lastCheckedDate);
  const currentGroup = getAgeGroupForBaby(birthDate, now);

  if (!previousGroup || !currentGroup) return null;

  if (previousGroup.label !== currentGroup.label) {
    return {
      previousGroup,
      newGroup: currentGroup,
      shouldSuggestGoalUpdate: currentGroup.defaultGoalSeconds !== previousGroup.defaultGoalSeconds,
    };
  }

  return null;
}

export function getGoalInfo(
  birthDate: Date | undefined,
  customGoalSeconds: number | null,
  now: Date = new Date()
): GoalInfo {
  if (customGoalSeconds !== null && customGoalSeconds > 0) {
    const ageGroup = birthDate ? getAgeGroupForBaby(birthDate, now) : null;
    return {
      goalSeconds: customGoalSeconds,
      source: "custom",
      ageGroup,
    };
  }

  if (!birthDate) {
    return {
      goalSeconds: 10 * 60, // Default 10 min when no birthdate
      source: "age_based",
      ageGroup: null,
    };
  }

  const ageGroup = getAgeGroupForBaby(birthDate, now);
  return {
    goalSeconds: ageGroup?.defaultGoalSeconds ?? 10 * 60,
    source: "age_based",
    ageGroup,
  };
}
