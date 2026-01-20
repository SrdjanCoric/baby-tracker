import AsyncStorage from "@react-native-async-storage/async-storage";
import { isValidThemePreference, type ThemePreference, type ThemeMode } from "@/utils/theme";

const THEME_PREFERENCE_KEY = "@theme_preference";

export type { ThemePreference, ThemeMode };

export const ThemeStorageService = {
  async getThemePreference(): Promise<ThemePreference> {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored && isValidThemePreference(stored)) {
      return stored;
    }
    return "system";
  },

  async setThemePreference(preference: ThemePreference): Promise<void> {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  },

  async clearThemePreference(): Promise<void> {
    await AsyncStorage.removeItem(THEME_PREFERENCE_KEY);
  },
};
