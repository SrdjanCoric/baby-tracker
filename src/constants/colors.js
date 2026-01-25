/* global module */
/**
 * SINGLE SOURCE OF TRUTH FOR ALL COLORS (JavaScript version for Tailwind)
 *
 * This file mirrors colors.ts for use in tailwind.config.js
 * Keep in sync with colors.ts!
 */

const SURFACE = {
  light: {
    background: "#FBF8F6",
    secondary: "#F5F2F0",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
    muted: "#FEF7F4",
    input: "#FFFFFF",
  },
  dark: {
    background: "#1C1A1D",
    secondary: "#232125",
    card: "#2A2730",
    cardElevated: "#343039",
    muted: "#1E1C1F",
    input: "#252329",
  },
};

const TEXT = {
  light: {
    primary: "#2D2A26",
    secondary: "#5C5752",
    tertiary: "#7A756E",
    muted: "#9A958E",
    inverse: "#FFFFFF",
  },
  dark: {
    primary: "#F5F2F0",
    secondary: "#A8A3A0",
    tertiary: "#6B6668",
    muted: "#7A7577",
    inverse: "#1C1A1D",
  },
};

const ACTION = {
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
};

const BORDER = {
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
};

const ACTIVITY = {
  feeding: {
    accent: "#8CB369",
    accentDark: "#A5C88A",
    muted: "#EEF4E9",
    mutedDark: "#2A2730",
  },
  sleep: {
    accent: "#9E8DA9",
    accentDark: "#B5A7BD",
    muted: "#F2EFF4",
    mutedDark: "#2A2730",
  },
  diaper: {
    accent: "#E0A099",
    accentDark: "#EAB8B2",
    muted: "#FBF0EE",
    mutedDark: "#2A2730",
  },
  pumping: {
    accent: "#7BA3A8",
    accentDark: "#96B8BC",
    muted: "#EDF3F4",
    mutedDark: "#2A2730",
  },
  growth: {
    accent: "#6AAB9C",
    accentDark: "#88BEB0",
    muted: "#EBF4F2",
    mutedDark: "#2A2730",
  },
  tummyTime: {
    accent: "#D4A574",
    accentDark: "#E0B990",
    muted: "#F9F2EA",
    mutedDark: "#2A2730",
  },
};

const SEMANTIC = {
  success: { light: "#22c55e", dark: "#4ade80" },
  error: { light: "#ef4444", dark: "#f87171" },
  warning: { light: "#f59e0b", dark: "#fbbf24" },
  neutral: { light: "#6b7280", dark: "#9ca3af" },
};

module.exports = {
  SURFACE,
  TEXT,
  ACTION,
  BORDER,
  ACTIVITY,
  SEMANTIC,
};
