import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_PREFERENCE_KEY = "@language_preference";

export type LanguageCode = "en" | "sr" | "system";

const VALID_LANGUAGES: LanguageCode[] = ["en", "sr", "system"];

function isValidLanguage(value: string): value is LanguageCode {
  return VALID_LANGUAGES.includes(value as LanguageCode);
}

export const LanguageStorageService = {
  async getLanguagePreference(): Promise<LanguageCode> {
    const stored = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    if (stored && isValidLanguage(stored)) {
      return stored;
    }
    return "system";
  },

  async setLanguagePreference(language: LanguageCode): Promise<void> {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, language);
  },

  async clearLanguagePreference(): Promise<void> {
    await AsyncStorage.removeItem(LANGUAGE_PREFERENCE_KEY);
  },
};
