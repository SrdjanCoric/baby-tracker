/**
 * Tummy time smart goals utilities
 * Age-based default goals with user customization based on AAP/WHO research
 */

export interface AgeGroup {
  label: string;
  labelKey: string;
  minAgeDays: number;
  maxAgeDays: number;
  defaultGoalSeconds: number;
  rationale: string;
  rationaleKey: string;
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
    labelKey: "ageGroups.tummyTime.0-2weeks",
    minAgeDays: 0,
    maxAgeDays: 14,
    defaultGoalSeconds: 2 * 60,
    rationale: "2 sessions of ~1 min (AAP newborn guidance)",
    rationaleKey: "ageGroups.rationale.0-2weeks",
  },
  {
    label: "2-4 weeks",
    labelKey: "ageGroups.tummyTime.2-4weeks",
    minAgeDays: 15,
    maxAgeDays: 28,
    defaultGoalSeconds: 5 * 60,
    rationale: "2-3 sessions of ~2 min",
    rationaleKey: "ageGroups.rationale.2-4weeks",
  },
  {
    label: "1-2 months",
    labelKey: "ageGroups.tummyTime.1-2months",
    minAgeDays: 29,
    maxAgeDays: 60,
    defaultGoalSeconds: 10 * 60,
    rationale: "Short sessions building tolerance",
    rationaleKey: "ageGroups.rationale.1-2months",
  },
  {
    label: "2-3 months",
    labelKey: "ageGroups.tummyTime.2-3months",
    minAgeDays: 61,
    maxAgeDays: 90,
    defaultGoalSeconds: 20 * 60,
    rationale: "Gradual increase with better head control",
    rationaleKey: "ageGroups.rationale.2-3months",
  },
  {
    label: "3-4 months",
    labelKey: "ageGroups.tummyTime.3-4months",
    minAgeDays: 91,
    maxAgeDays: 120,
    defaultGoalSeconds: 30 * 60,
    rationale: "Building toward AAP target",
    rationaleKey: "ageGroups.rationale.3-4months",
  },
  {
    label: "4-6 months",
    labelKey: "ageGroups.tummyTime.4-6months",
    minAgeDays: 121,
    maxAgeDays: 180,
    defaultGoalSeconds: 45 * 60,
    rationale: "Approaching AAP/Pathways target",
    rationaleKey: "ageGroups.rationale.4-6months",
  },
  {
    label: "6+ months",
    labelKey: "ageGroups.tummyTime.6+months",
    minAgeDays: 181,
    maxAgeDays: Infinity,
    defaultGoalSeconds: 60 * 60,
    rationale: "Consensus target, transitions to floor play",
    rationaleKey: "ageGroups.rationale.6+months",
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
