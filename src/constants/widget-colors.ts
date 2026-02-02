/**
 * Widget Colors
 *
 * These colors are shared between the iOS widget (Swift) and the React Native app.
 * Keep in sync with: targets/widget/index.swift (WidgetColors struct)
 */

export const WIDGET_COLORS = {
  // Activity accent colors (primary/vibrant)
  accent: {
    feeding: "#8CB369", // Green
    sleep: "#9E8DA9", // Lavender
    diaper: "#E0A099", // Coral/Pink
    pumping: "#7BA3A8", // Teal
    growth: "#6AAB9C", // Mint
    tummyTime: "#D4A574", // Tan/Orange
  },

  // Light mode muted backgrounds
  mutedLight: {
    feeding: "#EEF4E9", // Light green
    sleep: "#F2EFF4", // Light lavender
    diaper: "#FBF0EE", // Light coral
    pumping: "#EDF3F4", // Light teal
    growth: "#EBF4F2", // Light mint
    tummyTime: "#F9F2EA", // Light tan
  },

  // Dark mode muted backgrounds
  mutedDark: {
    feeding: "#2A3327", // Dark green tint
    sleep: "#2D2A31", // Dark lavender tint
    diaper: "#332A28", // Dark coral tint
    pumping: "#272E30", // Dark teal tint
    growth: "#273230", // Dark mint tint
    tummyTime: "#332D26", // Dark tan tint
  },

  // Widget container backgrounds
  background: {
    light: "#F5EDE8", // Warm cream
    dark: "#1C1C1E", // System dark
  },

  // Button backgrounds
  button: {
    light: "#FFFFFF", // White
    dark: "#2C2C2E", // Dark gray
  },
} as const;

export type ActivityType =
  | "feeding"
  | "sleep"
  | "diaper"
  | "pumping"
  | "growth"
  | "tummyTime";

/**
 * Get accent color for an activity type
 */
export function getActivityAccentColor(activity: ActivityType): string {
  return WIDGET_COLORS.accent[activity];
}

/**
 * Get muted background color for an activity type
 */
export function getActivityMutedColor(
  activity: ActivityType,
  isDark: boolean
): string {
  return isDark
    ? WIDGET_COLORS.mutedDark[activity]
    : WIDGET_COLORS.mutedLight[activity];
}

/**
 * Get widget background color
 */
export function getWidgetBackground(isDark: boolean): string {
  return isDark ? WIDGET_COLORS.background.dark : WIDGET_COLORS.background.light;
}
