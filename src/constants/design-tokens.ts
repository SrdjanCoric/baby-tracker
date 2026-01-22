/**
 * Design tokens for consistent styling across the app
 * These values mirror the tailwind config but are accessible for inline styles
 */

import { ACTIVITY_CONFIG, type ActivityType } from "./activities";

/**
 * Semantic color tokens for status/trend indicators
 */
export const SEMANTIC_COLORS = {
  success: {
    light: "#22c55e",
    dark: "#4ade80",
  },
  error: {
    light: "#ef4444",
    dark: "#f87171",
  },
  warning: {
    light: "#f59e0b",
    dark: "#fbbf24",
  },
  neutral: {
    light: "#6b7280",
    dark: "#9ca3af",
  },
} as const;

/**
 * Surface colors matching tailwind config
 */
export const SURFACE_COLORS = {
  light: {
    background: "#FAFAFA",
    secondary: "#F5F5F5",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
  },
  dark: {
    background: "#121212",
    secondary: "#1A1A1A",
    card: "#1E1E1E",
    cardElevated: "#252525",
  },
} as const;

/**
 * Content/text colors matching tailwind config
 */
export const CONTENT_COLORS = {
  light: {
    primary: "#1A1A1A",
    secondary: "#6B6B6B",
    tertiary: "#9CA3AF",
    inverse: "#FFFFFF",
  },
  dark: {
    primary: "#FFFFFF",
    secondary: "#A0A0A0",
    tertiary: "#6B6B6B",
    inverse: "#1A1A1A",
  },
} as const;

/**
 * Border colors matching tailwind config
 */
export const BORDER_COLORS = {
  light: {
    default: "#E5E7EB",
    subtle: "#F3F4F6",
  },
  dark: {
    default: "#374151",
    subtle: "#4B5563",
  },
} as const;

/**
 * Action/primary colors matching tailwind config
 */
export const ACTION_COLORS = {
  light: {
    primary: "#2E7D32",
    primaryHover: "#256029",
    primaryPressed: "#1B4D1E",
  },
  dark: {
    primary: "#81C784",
    primaryHover: "#A5D6A7",
    primaryPressed: "#66BB6A",
  },
} as const;

export type ThemeType = "light" | "dark";

/**
 * Get a semantic color for the current theme
 */
export function getSemanticColor(
  type: keyof typeof SEMANTIC_COLORS,
  isDark: boolean
): string {
  return isDark ? SEMANTIC_COLORS[type].dark : SEMANTIC_COLORS[type].light;
}

/**
 * Get activity color with optional dark mode variant
 */
export function getActivityColor(
  activity: ActivityType,
  isDark: boolean = false
): string {
  const config = ACTIVITY_CONFIG[activity];
  return config.accentColor;
}

/**
 * Get activity muted background color
 */
export function getActivityMutedBg(
  activity: ActivityType,
  isDark: boolean
): string {
  const config = ACTIVITY_CONFIG[activity];
  return isDark ? config.mutedBgDark : config.mutedBg;
}

/**
 * Get surface color for the current theme
 */
export function getSurfaceColor(
  type: keyof typeof SURFACE_COLORS.light,
  isDark: boolean
): string {
  return isDark ? SURFACE_COLORS.dark[type] : SURFACE_COLORS.light[type];
}

/**
 * Get content/text color for the current theme
 */
export function getContentColor(
  type: keyof typeof CONTENT_COLORS.light,
  isDark: boolean
): string {
  return isDark ? CONTENT_COLORS.dark[type] : CONTENT_COLORS.light[type];
}

/**
 * Get border color for the current theme
 */
export function getBorderColor(
  type: keyof typeof BORDER_COLORS.light,
  isDark: boolean
): string {
  return isDark ? BORDER_COLORS.dark[type] : BORDER_COLORS.light[type];
}

/**
 * Get action color for the current theme
 */
export function getActionColor(
  type: keyof typeof ACTION_COLORS.light,
  isDark: boolean
): string {
  return isDark ? ACTION_COLORS.dark[type] : ACTION_COLORS.light[type];
}
