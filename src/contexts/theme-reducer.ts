import { resolveThemeMode, type ThemePreference, type ThemeMode } from "@/utils/theme";

export type { ThemePreference, ThemeMode };

export interface ThemeState {
  preference: ThemePreference;
  resolvedMode: ThemeMode;
  systemColorScheme: ThemeMode | null;
  isLoading: boolean;
}

export type ThemeAction =
  | { type: "SET_PREFERENCE"; payload: ThemePreference }
  | { type: "SET_SYSTEM_COLOR_SCHEME"; payload: ThemeMode | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "INITIALIZE"; payload: { preference: ThemePreference; systemColorScheme: ThemeMode | null } };

export const initialThemeState: ThemeState = {
  preference: "system",
  resolvedMode: "light",
  systemColorScheme: null,
  isLoading: true,
};

export function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case "SET_PREFERENCE": {
      const preference = action.payload;
      const resolvedMode = resolveThemeMode(preference, state.systemColorScheme);
      return { ...state, preference, resolvedMode };
    }

    case "SET_SYSTEM_COLOR_SCHEME": {
      const systemColorScheme = action.payload;
      const resolvedMode = resolveThemeMode(state.preference, systemColorScheme);
      return { ...state, systemColorScheme, resolvedMode };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "INITIALIZE": {
      const { preference, systemColorScheme } = action.payload;
      const resolvedMode = resolveThemeMode(preference, systemColorScheme);
      return {
        preference,
        resolvedMode,
        systemColorScheme,
        isLoading: false,
      };
    }

    default:
      return state;
  }
}
