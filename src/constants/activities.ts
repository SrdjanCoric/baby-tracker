/**
 * Activity type definitions and configurations
 * Central source of truth for activity-related constants
 */

import { ACTIVITY } from "./colors";

export type ActivityType = "feeding" | "sleep" | "diaper" | "pumping" | "growth" | "tummyTime" | "milestones";
export type TimerActivityType = "feeding" | "sleep" | "pumping" | "tummyTime";
export type BreastSide = "left" | "right" | "both";
export type DiaperType = "wet" | "dirty" | "mixed" | "dry";
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
  accentColorDark: string;
  mutedBg: string;
  mutedBgDark: string;
}

/**
 * Activity configuration lookup - imports from colors.ts (single source of truth)
 */
export const ACTIVITY_CONFIG: Record<ActivityType, ActivityColorConfig> = {
  feeding: {
    icon: "🤱",
    accentColor: ACTIVITY.feeding.accent,
    accentColorDark: ACTIVITY.feeding.accentDark,
    mutedBg: ACTIVITY.feeding.muted,
    mutedBgDark: ACTIVITY.feeding.mutedDark,
  },
  sleep: {
    icon: "😴",
    accentColor: ACTIVITY.sleep.accent,
    accentColorDark: ACTIVITY.sleep.accentDark,
    mutedBg: ACTIVITY.sleep.muted,
    mutedBgDark: ACTIVITY.sleep.mutedDark,
  },
  diaper: {
    icon: "🚼",
    accentColor: ACTIVITY.diaper.accent,
    accentColorDark: ACTIVITY.diaper.accentDark,
    mutedBg: ACTIVITY.diaper.muted,
    mutedBgDark: ACTIVITY.diaper.mutedDark,
  },
  pumping: {
    icon: "🫙",
    accentColor: ACTIVITY.pumping.accent,
    accentColorDark: ACTIVITY.pumping.accentDark,
    mutedBg: ACTIVITY.pumping.muted,
    mutedBgDark: ACTIVITY.pumping.mutedDark,
  },
  growth: {
    icon: "📏",
    accentColor: ACTIVITY.growth.accent,
    accentColorDark: ACTIVITY.growth.accentDark,
    mutedBg: ACTIVITY.growth.muted,
    mutedBgDark: ACTIVITY.growth.mutedDark,
  },
  tummyTime: {
    icon: "💪",
    accentColor: ACTIVITY.tummyTime.accent,
    accentColorDark: ACTIVITY.tummyTime.accentDark,
    mutedBg: ACTIVITY.tummyTime.muted,
    mutedBgDark: ACTIVITY.tummyTime.mutedDark,
  },
  milestones: {
    icon: "⭐",
    accentColor: ACTIVITY.milestones.accent,
    accentColorDark: ACTIVITY.milestones.accentDark,
    mutedBg: ACTIVITY.milestones.muted,
    mutedBgDark: ACTIVITY.milestones.mutedDark,
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
  return ["feeding", "sleep", "diaper", "pumping", "growth", "tummyTime", "milestones"].includes(value);
}

/**
 * Validates that a string is a valid StoolColor
 */
export function isValidStoolColor(value: string): value is StoolColor {
  return STOOL_COLORS.includes(value as StoolColor);
}
