/**
 * Activity type definitions and configurations
 * Central source of truth for activity-related constants
 */

export type ActivityType = "feeding" | "sleep" | "diaper" | "pumping" | "growth" | "tummyTime";
export type TimerActivityType = "feeding" | "sleep" | "pumping" | "tummyTime";
export type BreastSide = "left" | "right" | "both";
export type DiaperType = "wet" | "dirty" | "mixed";
export type FeedingType = "breast" | "bottle" | "solid";
export type SleepType = "nap" | "night";
export type BottleContentType = "formula" | "breastMilk";
export type SolidAmount = "aLittle" | "some" | "aLot";
export type SolidReaction = "loved" | "meh" | "refused";

export const SOLID_AMOUNTS: SolidAmount[] = ["aLittle", "some", "aLot"];
export const SOLID_REACTIONS: SolidReaction[] = ["loved", "meh", "refused"];

/**
 * Stool color options for diaper tracking
 * Ordered by most common to least common
 */
export const STOOL_COLORS = [
  "yellow",
  "brown",
  "green",
  "orange",
  "black",
  "white",
  "red"
] as const;

export type StoolColor = typeof STOOL_COLORS[number];

/**
 * Activity color configuration for UI theming
 */
export interface ActivityColorConfig {
  icon: string;
  accentColor: string;
  mutedBg: string;
  mutedBgDark: string;
}

/**
 * Activity configuration lookup - soft warm pastel colors
 */
export const ACTIVITY_CONFIG: Record<ActivityType, ActivityColorConfig> = {
  feeding: {
    icon: "🤱",
    accentColor: "#8CB369",
    mutedBg: "#EEF4E9",
    mutedBgDark: "#2A3325",
  },
  sleep: {
    icon: "😴",
    accentColor: "#9E8DA9",
    mutedBg: "#F2EFF4",
    mutedBgDark: "#2A2630",
  },
  diaper: {
    icon: "🚼",
    accentColor: "#E0A099",
    mutedBg: "#FBF0EE",
    mutedBgDark: "#382926",
  },
  pumping: {
    icon: "🫙",
    accentColor: "#7BA3A8",
    mutedBg: "#EDF3F4",
    mutedBgDark: "#252E30",
  },
  growth: {
    icon: "📏",
    accentColor: "#6AAB9C",
    mutedBg: "#EBF4F2",
    mutedBgDark: "#243330",
  },
  tummyTime: {
    icon: "💪",
    accentColor: "#D4A574",
    mutedBg: "#F9F2EA",
    mutedBgDark: "#332B22",
  },
};

/**
 * Timer activities that support side selection (left/right/both)
 */
export const ACTIVITIES_WITH_SIDE_SELECTION: TimerActivityType[] = ["feeding", "pumping"];

/**
 * Checks if an activity type supports timer functionality
 */
export function isTimerActivity(activity: ActivityType): activity is TimerActivityType {
  return ["feeding", "sleep", "pumping", "tummyTime"].includes(activity);
}

/**
 * Checks if an activity type supports side selection
 */
export function supportsSideSelection(activity: TimerActivityType): boolean {
  return ACTIVITIES_WITH_SIDE_SELECTION.includes(activity);
}

/**
 * Gets the config for an activity type
 */
export function getActivityConfig(activity: ActivityType): ActivityColorConfig {
  return ACTIVITY_CONFIG[activity];
}

/**
 * Gets the opposite breast side (for suggesting alternating sides)
 */
export function getOppositeSide(side: BreastSide): BreastSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  return "both";
}

/**
 * Validates that a string is a valid ActivityType
 */
export function isValidActivityType(value: string): value is ActivityType {
  return ["feeding", "sleep", "diaper", "pumping", "growth", "tummyTime"].includes(value);
}

/**
 * Validates that a string is a valid StoolColor
 */
export function isValidStoolColor(value: string): value is StoolColor {
  return STOOL_COLORS.includes(value as StoolColor);
}
