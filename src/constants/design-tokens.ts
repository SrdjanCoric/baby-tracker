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
 * Surface colors matching tailwind config - warm undertones
 */
export const SURFACE_COLORS = {
  light: {
    background: "#FAFAF8",
    secondary: "#F5F3F0",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
  },
  dark: {
    background: "#1A1918",
    secondary: "#1F1E1C",
    card: "#242220",
    cardElevated: "#2A2826",
  },
} as const;

/**
 * Content/text colors matching tailwind config - warm grays
 */
export const CONTENT_COLORS = {
  light: {
    primary: "#2D2A26",
    secondary: "#6B665E",
    tertiary: "#8A857D",
    inverse: "#FFFFFF",
  },
  dark: {
    primary: "#FAF9F7",
    secondary: "#B5B0A8",
    tertiary: "#7A756D",
    inverse: "#2D2A26",
  },
} as const;

/**
 * Border colors matching tailwind config - warm tones
 */
export const BORDER_COLORS = {
  light: {
    default: "#E8E5E0",
    subtle: "#F0EDE8",
  },
  dark: {
    default: "#3D3935",
    subtle: "#4A463F",
  },
} as const;

/**
 * Action/primary colors matching tailwind config - warm sage green
 */
export const ACTION_COLORS = {
  light: {
    primary: "#6B9E6E",
    primaryHover: "#5A8A5D",
    primaryPressed: "#4A754C",
  },
  dark: {
    primary: "#8FC091",
    primaryHover: "#A0CDA2",
    primaryPressed: "#7EB080",
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
  _isDark: boolean = false
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
