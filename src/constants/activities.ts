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
 * Activity configuration lookup
 */
export const ACTIVITY_CONFIG: Record<ActivityType, ActivityColorConfig> = {
  feeding: {
    icon: "🤱",
    accentColor: "#88B04B",
    mutedBg: "#E8F0E0",
    mutedBgDark: "#2A3D1F",
  },
  sleep: {
    icon: "😴",
    accentColor: "#6B5B95",
    mutedBg: "#E8E4F0",
    mutedBgDark: "#2D2640",
  },
  diaper: {
    icon: "🚼",
    accentColor: "#D4837D",
    mutedBg: "#FDF0EF",
    mutedBgDark: "#3D2525",
  },
  pumping: {
    icon: "🫙",
    accentColor: "#7B9BC9",
    mutedBg: "#E8EDF5",
    mutedBgDark: "#252D3D",
  },
  growth: {
    icon: "📏",
    accentColor: "#009B77",
    mutedBg: "#E0F5EF",
    mutedBgDark: "#1A332D",
  },
  tummyTime: {
    icon: "💪",
    accentColor: "#E67E22",
    mutedBg: "#FEF3E2",
    mutedBgDark: "#3D2E1A",
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
