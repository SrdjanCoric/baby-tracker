export type MilestoneCategory = "social" | "language" | "cognitive" | "movement";

export interface MilestoneItem {
  id: string;
  category: MilestoneCategory;
}

export interface AgeGroup {
  key: string;
  months: number;
  milestones: MilestoneItem[];
}

export const CATEGORY_EMOJI: Record<MilestoneCategory, string> = {
  social: "\u{1F49B}",
  language: "\u{1F4AC}",
  cognitive: "\u{1F9E0}",
  movement: "\u{1F3C3}",
};

export const CATEGORY_ORDER: MilestoneCategory[] = ["social", "language", "cognitive", "movement"];

export const AGE_GROUPS: AgeGroup[] = [
  {
    key: "2m",
    months: 2,
    milestones: [
      { id: "2m-social-1", category: "social" },
      { id: "2m-social-2", category: "social" },
      { id: "2m-social-3", category: "social" },
      { id: "2m-social-4", category: "social" },
      { id: "2m-language-1", category: "language" },
      { id: "2m-language-2", category: "language" },
      { id: "2m-cognitive-1", category: "cognitive" },
      { id: "2m-cognitive-2", category: "cognitive" },
      { id: "2m-movement-1", category: "movement" },
      { id: "2m-movement-2", category: "movement" },
      { id: "2m-movement-3", category: "movement" },
    ],
  },
  {
    key: "4m",
    months: 4,
    milestones: [
      { id: "4m-social-1", category: "social" },
      { id: "4m-social-2", category: "social" },
      { id: "4m-social-3", category: "social" },
      { id: "4m-language-1", category: "language" },
      { id: "4m-language-2", category: "language" },
      { id: "4m-language-3", category: "language" },
      { id: "4m-cognitive-1", category: "cognitive" },
      { id: "4m-cognitive-2", category: "cognitive" },
      { id: "4m-movement-1", category: "movement" },
      { id: "4m-movement-2", category: "movement" },
      { id: "4m-movement-3", category: "movement" },
      { id: "4m-movement-4", category: "movement" },
      { id: "4m-movement-5", category: "movement" },
    ],
  },
  {
    key: "6m",
    months: 6,
    milestones: [
      { id: "6m-social-1", category: "social" },
      { id: "6m-social-2", category: "social" },
      { id: "6m-social-3", category: "social" },
      { id: "6m-language-1", category: "language" },
      { id: "6m-language-2", category: "language" },
      { id: "6m-language-3", category: "language" },
      { id: "6m-cognitive-1", category: "cognitive" },
      { id: "6m-cognitive-2", category: "cognitive" },
      { id: "6m-cognitive-3", category: "cognitive" },
      { id: "6m-movement-1", category: "movement" },
      { id: "6m-movement-2", category: "movement" },
      { id: "6m-movement-3", category: "movement" },
    ],
  },
  {
    key: "9m",
    months: 9,
    milestones: [
      { id: "9m-social-1", category: "social" },
      { id: "9m-social-2", category: "social" },
      { id: "9m-social-3", category: "social" },
      { id: "9m-social-4", category: "social" },
      { id: "9m-social-5", category: "social" },
      { id: "9m-language-1", category: "language" },
      { id: "9m-language-2", category: "language" },
      { id: "9m-cognitive-1", category: "cognitive" },
      { id: "9m-cognitive-2", category: "cognitive" },
      { id: "9m-movement-1", category: "movement" },
      { id: "9m-movement-2", category: "movement" },
      { id: "9m-movement-3", category: "movement" },
      { id: "9m-movement-4", category: "movement" },
    ],
  },
  {
    key: "1y",
    months: 12,
    milestones: [
      { id: "1y-social-1", category: "social" },
      { id: "1y-social-2", category: "social" },
      { id: "1y-social-3", category: "social" },
      { id: "1y-social-4", category: "social" },
      { id: "1y-language-1", category: "language" },
      { id: "1y-language-2", category: "language" },
      { id: "1y-cognitive-1", category: "cognitive" },
      { id: "1y-cognitive-2", category: "cognitive" },
      { id: "1y-movement-1", category: "movement" },
      { id: "1y-movement-2", category: "movement" },
    ],
  },
  {
    key: "15m",
    months: 15,
    milestones: [
      { id: "15m-social-1", category: "social" },
      { id: "15m-social-2", category: "social" },
      { id: "15m-social-3", category: "social" },
      { id: "15m-social-4", category: "social" },
      { id: "15m-social-5", category: "social" },
      { id: "15m-language-1", category: "language" },
      { id: "15m-language-2", category: "language" },
      { id: "15m-language-3", category: "language" },
      { id: "15m-language-4", category: "language" },
      { id: "15m-cognitive-1", category: "cognitive" },
      { id: "15m-cognitive-2", category: "cognitive" },
      { id: "15m-movement-1", category: "movement" },
      { id: "15m-movement-2", category: "movement" },
    ],
  },
  {
    key: "18m",
    months: 18,
    milestones: [
      { id: "18m-social-1", category: "social" },
      { id: "18m-social-2", category: "social" },
      { id: "18m-social-3", category: "social" },
      { id: "18m-social-4", category: "social" },
      { id: "18m-social-5", category: "social" },
      { id: "18m-language-1", category: "language" },
      { id: "18m-language-2", category: "language" },
      { id: "18m-cognitive-1", category: "cognitive" },
      { id: "18m-cognitive-2", category: "cognitive" },
      { id: "18m-movement-1", category: "movement" },
      { id: "18m-movement-2", category: "movement" },
      { id: "18m-movement-3", category: "movement" },
      { id: "18m-movement-4", category: "movement" },
      { id: "18m-movement-5", category: "movement" },
      { id: "18m-movement-6", category: "movement" },
    ],
  },
  {
    key: "2y",
    months: 24,
    milestones: [
      { id: "2y-social-1", category: "social" },
      { id: "2y-social-2", category: "social" },
      { id: "2y-language-1", category: "language" },
      { id: "2y-language-2", category: "language" },
      { id: "2y-language-3", category: "language" },
      { id: "2y-language-4", category: "language" },
      { id: "2y-cognitive-1", category: "cognitive" },
      { id: "2y-cognitive-2", category: "cognitive" },
      { id: "2y-cognitive-3", category: "cognitive" },
      { id: "2y-movement-1", category: "movement" },
      { id: "2y-movement-2", category: "movement" },
      { id: "2y-movement-3", category: "movement" },
      { id: "2y-movement-4", category: "movement" },
    ],
  },
  {
    key: "30m",
    months: 30,
    milestones: [
      { id: "30m-social-1", category: "social" },
      { id: "30m-social-2", category: "social" },
      { id: "30m-social-3", category: "social" },
      { id: "30m-language-1", category: "language" },
      { id: "30m-language-2", category: "language" },
      { id: "30m-language-3", category: "language" },
      { id: "30m-language-4", category: "language" },
      { id: "30m-cognitive-1", category: "cognitive" },
      { id: "30m-cognitive-2", category: "cognitive" },
      { id: "30m-cognitive-3", category: "cognitive" },
      { id: "30m-cognitive-4", category: "cognitive" },
      { id: "30m-movement-1", category: "movement" },
      { id: "30m-movement-2", category: "movement" },
      { id: "30m-movement-3", category: "movement" },
      { id: "30m-movement-4", category: "movement" },
    ],
  },
  {
    key: "3y",
    months: 36,
    milestones: [
      { id: "3y-social-1", category: "social" },
      { id: "3y-social-2", category: "social" },
      { id: "3y-language-1", category: "language" },
      { id: "3y-language-2", category: "language" },
      { id: "3y-language-3", category: "language" },
      { id: "3y-language-4", category: "language" },
      { id: "3y-language-5", category: "language" },
      { id: "3y-cognitive-1", category: "cognitive" },
      { id: "3y-cognitive-2", category: "cognitive" },
      { id: "3y-movement-1", category: "movement" },
      { id: "3y-movement-2", category: "movement" },
      { id: "3y-movement-3", category: "movement" },
    ],
  },
  {
    key: "4y",
    months: 48,
    milestones: [
      { id: "4y-social-1", category: "social" },
      { id: "4y-social-2", category: "social" },
      { id: "4y-social-3", category: "social" },
      { id: "4y-social-4", category: "social" },
      { id: "4y-social-5", category: "social" },
      { id: "4y-social-6", category: "social" },
      { id: "4y-language-1", category: "language" },
      { id: "4y-language-2", category: "language" },
      { id: "4y-language-3", category: "language" },
      { id: "4y-language-4", category: "language" },
      { id: "4y-cognitive-1", category: "cognitive" },
      { id: "4y-cognitive-2", category: "cognitive" },
      { id: "4y-cognitive-3", category: "cognitive" },
      { id: "4y-movement-1", category: "movement" },
      { id: "4y-movement-2", category: "movement" },
      { id: "4y-movement-3", category: "movement" },
      { id: "4y-movement-4", category: "movement" },
    ],
  },
  {
    key: "5y",
    months: 60,
    milestones: [
      { id: "5y-social-1", category: "social" },
      { id: "5y-social-2", category: "social" },
      { id: "5y-social-3", category: "social" },
      { id: "5y-language-1", category: "language" },
      { id: "5y-language-2", category: "language" },
      { id: "5y-language-3", category: "language" },
      { id: "5y-language-4", category: "language" },
      { id: "5y-cognitive-1", category: "cognitive" },
      { id: "5y-cognitive-2", category: "cognitive" },
      { id: "5y-cognitive-3", category: "cognitive" },
      { id: "5y-cognitive-4", category: "cognitive" },
      { id: "5y-cognitive-5", category: "cognitive" },
      { id: "5y-cognitive-6", category: "cognitive" },
      { id: "5y-movement-1", category: "movement" },
      { id: "5y-movement-2", category: "movement" },
    ],
  },
];

export function getCurrentAgeGroupKey(birthDate: Date): string | null {
  const now = new Date();
  const ageMs = now.getTime() - birthDate.getTime();
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);

  if (ageMonths < 2) return null;

  const sortedGroups = [...AGE_GROUPS].sort((a, b) => b.months - a.months);
  for (const group of sortedGroups) {
    if (ageMonths >= group.months) {
      return group.key;
    }
  }

  return null;
}

export function getAgeGroupByKey(key: string): AgeGroup | undefined {
  return AGE_GROUPS.find((g) => g.key === key);
}

export function getMilestonesForAge(ageKey: string): MilestoneItem[] {
  const group = getAgeGroupByKey(ageKey);
  return group?.milestones ?? [];
}

export function getMilestonesByCategory(ageKey: string): Record<MilestoneCategory, MilestoneItem[]> {
  const milestones = getMilestonesForAge(ageKey);
  return {
    social: milestones.filter((m) => m.category === "social"),
    language: milestones.filter((m) => m.category === "language"),
    cognitive: milestones.filter((m) => m.category === "cognitive"),
    movement: milestones.filter((m) => m.category === "movement"),
  };
}
