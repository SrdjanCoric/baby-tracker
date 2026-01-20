export type ThemePreference = "light" | "dark" | "night" | "system";
export type ThemeMode = "light" | "dark" | "night";

const VALID_THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "night", "system"];
const VALID_THEME_MODES: ThemeMode[] = ["light", "dark", "night"];

export function isValidThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && VALID_THEME_PREFERENCES.includes(value as ThemePreference);
}

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && VALID_THEME_MODES.includes(value as ThemeMode);
}

export function resolveThemeMode(
  preference: ThemePreference,
  systemColorScheme: ThemeMode | null | undefined
): ThemeMode {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (preference === "night") return "night";
  return systemColorScheme ?? "light";
}

export function isNightModeEnabled(mode: ThemeMode): boolean {
  return mode === "night";
}

export function shouldAutoEnableNightMode(hour?: number): boolean {
  const currentHour = hour ?? new Date().getHours();
  return currentHour >= 22 || currentHour < 5;
}
