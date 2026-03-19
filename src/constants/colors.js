/* global module */
/**
 * SINGLE SOURCE OF TRUTH FOR ALL COLORS (JavaScript version for Tailwind)
 *
 * This file mirrors colors.ts for use in tailwind.config.js
 * Keep in sync with colors.ts!
 */

const SURFACE = {
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
    secondary: "#B8B3B0",
    tertiary: "#8A8588",
    muted: "#9A9598",
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
    primary: "#5A9A5D",
    primaryHover: "#4A8A4D",
    primaryPressed: "#3A7A3D",
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
    button: "#6A9A4D",
    buttonDark: "#5A8A4D",
    muted: "#EEF4E9",
    mutedDark: "#253025",
  },
  sleep: {
    accent: "#9E8DA9",
    accentDark: "#B5A7BD",
    button: "#7A6B85",
    buttonDark: "#6A5B75",
    muted: "#F2EFF4",
    mutedDark: "#2E2840",
  },
  diaper: {
    accent: "#E0A099",
    accentDark: "#EAB8B2",
    button: "#B8706A",
    buttonDark: "#7A4A44",
    muted: "#FBF0EE",
    mutedDark: "#302525",
  },
  pumping: {
    accent: "#7BA3A8",
    accentDark: "#96B8BC",
    button: "#5A8589",
    buttonDark: "#4A7579",
    muted: "#EDF3F4",
    mutedDark: "#252A30",
  },
  growth: {
    accent: "#6AAB9C",
    accentDark: "#88BEB0",
    button: "#4A8A7A",
    buttonDark: "#3A7A6A",
    muted: "#EBF4F2",
    mutedDark: "#253028",
  },
  tummyTime: {
    accent: "#D4A574",
    accentDark: "#E0B990",
    button: "#B8844E",
    buttonDark: "#A8743E",
    muted: "#F9F2EA",
    mutedDark: "#302A22",
  },
  milestones: {
    accent: "#C9A55C",
    accentDark: "#DABB78",
    button: "#A88A3E",
    buttonDark: "#8A7232",
    muted: "#F9F4E8",
    mutedDark: "#302C22",
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
