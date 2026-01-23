export type ThemePreference = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";

const VALID_THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];
const VALID_THEME_MODES: ThemeMode[] = ["light", "dark"];

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
  return systemColorScheme ?? "light";
}
