/**
 * SINGLE SOURCE OF TRUTH FOR ALL COLORS
 *
 * DO NOT define colors anywhere else.
 * All components, activities, and configs import from here.
 */

export const SURFACE = {
  light: {
    background: "#F5EDE8",
    secondary: "#EFE7E2",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
    muted: "#FEF7F4",
    input: "#FFFFFF",
  },
  dark: {
    background: "#1E1B19",
    secondary: "#252220",
    card: "#2D2A28",
    cardElevated: "#363330",
    muted: "#201D1B",
    input: "#282523",
  },
} as const;

export const TEXT = {
  light: {
    primary: "#2D2A26",
    secondary: "#5C5752",
    tertiary: "#7A756E",
    muted: "#9A958E",
    inverse: "#FFFFFF",
  },
  dark: {
    primary: "#F5F2F0",
    secondary: "#B8B3B0",
    tertiary: "#8A8588",
    muted: "#9A9598",
    inverse: "#1C1A1D",
  },
} as const;

export const ACTION = {
  light: {
    primary: "#6B9E6E",
    primaryHover: "#5A8A5D",
    primaryPressed: "#4A754C",
  },
  dark: {
    primary: "#5A9A5D",
    primaryHover: "#4A8A4D",
    primaryPressed: "#3A7A3D",
  },
} as const;

export const BORDER = {
  light: {
    default: "#E5E2DE",
    subtle: "#EDEAE6",
    strong: "#D5D1CC",
  },
  dark: {
    default: "#3A363D",
    subtle: "#2F2C32",
    strong: "#4A464F",
  },
} as const;

export const ACTIVITY = {
  feeding: {
    accent: "#8CB369",
    accentDark: "#A5C88A",
    button: "#6A9A4D",
    buttonDark: "#5A8A4D",
    muted: "#EEF4E9",
    mutedDark: "#2A2730",
  },
  sleep: {
    accent: "#9E8DA9",
    accentDark: "#B5A7BD",
    button: "#7A6B85",
    buttonDark: "#6A5B75",
    muted: "#F2EFF4",
    mutedDark: "#2A2730",
  },
  diaper: {
    accent: "#E0A099",
    accentDark: "#EAB8B2",
    button: "#B8706A",
    buttonDark: "#7A4A44",
    muted: "#FBF0EE",
    mutedDark: "#2A2730",
  },
  pumping: {
    accent: "#7BA3A8",
    accentDark: "#96B8BC",
    button: "#5A8589",
    buttonDark: "#4A7579",
    muted: "#EDF3F4",
    mutedDark: "#2A2730",
  },
  growth: {
    accent: "#6AAB9C",
    accentDark: "#88BEB0",
    button: "#4A8A7A",
    buttonDark: "#3A7A6A",
    muted: "#EBF4F2",
    mutedDark: "#2A2730",
  },
  tummyTime: {
    accent: "#D4A574",
    accentDark: "#E0B990",
    button: "#B8844E",
    buttonDark: "#A8743E",
    muted: "#F9F2EA",
    mutedDark: "#2A2730",
  },
  milestones: {
    accent: "#C9A55C",
    accentDark: "#DABB78",
    button: "#A88A3E",
    buttonDark: "#8A7232",
    muted: "#F9F4E8",
    mutedDark: "#2A2730",
  },
} as const;

export const SEMANTIC = {
  success: { light: "#22c55e", dark: "#4ade80" },
  error: { light: "#ef4444", dark: "#f87171" },
  warning: { light: "#f59e0b", dark: "#fbbf24" },
  neutral: { light: "#6b7280", dark: "#9ca3af" },
} as const;

export type ActivityColorKey = keyof typeof ACTIVITY;
export type ThemeMode = "light" | "dark";

export function getButtonTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? TEXT.dark.inverse : "#FFFFFF";
}

export function getActivityButtonColor(
  activity: ActivityColorKey,
  isDark: boolean
): string {
  const config = ACTIVITY[activity];
  return isDark ? config.buttonDark : config.accent;
}
