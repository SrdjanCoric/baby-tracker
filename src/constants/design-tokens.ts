/**
 * Design tokens for consistent styling across the app
 * Re-exports colors from colors.ts for backward compatibility
 */

import { ACTIVITY_CONFIG, type ActivityType } from "./activities";
import {
  SURFACE,
  TEXT,
  ACTION,
  BORDER,
  SEMANTIC,
  ACTIVITY,
  getButtonTextColor,
  getActivityButtonColor,
  type ThemeMode,
} from "./colors";

export { SURFACE, TEXT, ACTION, BORDER, SEMANTIC, ACTIVITY, getButtonTextColor, getActivityButtonColor };

export const SURFACE_COLORS = SURFACE;
export const CONTENT_COLORS = TEXT;
export const ACTION_COLORS = ACTION;
export const BORDER_COLORS = BORDER;
export const SEMANTIC_COLORS = SEMANTIC;

export type ThemeType = ThemeMode;

export function getSemanticColor(
  type: keyof typeof SEMANTIC,
  isDark: boolean
): string {
  return isDark ? SEMANTIC[type].dark : SEMANTIC[type].light;
}

export function getActivityColor(
  activity: ActivityType,
  _isDark: boolean = false
): string {
  const config = ACTIVITY_CONFIG[activity];
  return config.accentColor;
}

export function getActivityMutedBg(
  activity: ActivityType,
  isDark: boolean
): string {
  const config = ACTIVITY_CONFIG[activity];
  return isDark ? config.mutedBgDark : config.mutedBg;
}

export function getSurfaceColor(
  type: keyof typeof SURFACE.light,
  isDark: boolean
): string {
  return isDark ? SURFACE.dark[type] : SURFACE.light[type];
}

export function getContentColor(
  type: keyof typeof TEXT.light,
  isDark: boolean
): string {
  return isDark ? TEXT.dark[type] : TEXT.light[type];
}

export function getBorderColor(
  type: keyof typeof BORDER.light,
  isDark: boolean
): string {
  return isDark ? BORDER.dark[type] : BORDER.light[type];
}

export function getActionColor(
  type: keyof typeof ACTION.light,
  isDark: boolean
): string {
  return isDark ? ACTION.dark[type] : ACTION.light[type];
}
