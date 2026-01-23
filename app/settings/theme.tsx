import { useCallback } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme, type ThemePreference } from "@/contexts/theme-context";

type ThemeOptionConfig = {
  value: ThemePreference;
  icon: string;
};

const THEME_OPTIONS: ThemeOptionConfig[] = [
  {
    value: "system",
    icon: "\u{1F4F1}",
  },
  {
    value: "light",
    icon: "\u{2600}\u{FE0F}",
  },
  {
    value: "dark",
    icon: "\u{1F319}",
  },
];

const THEME_LABELS = {
  system: { label: "settings.systemDefault", description: "settings.systemDefaultDesc" },
  light: { label: "settings.lightMode", description: "settings.lightModeDesc" },
  dark: { label: "settings.darkMode", description: "settings.darkModeDesc" },
} as const;

export default function ThemeSettingsScreen() {
  const { t } = useTranslation();
  const { preference, resolvedMode, setThemePreference } = useTheme();

  const handleSelectTheme = useCallback(
    async (themeValue: ThemePreference) => {
      await setThemePreference(themeValue);
    },
    [setThemePreference]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("settings.appearance")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
            {t("settings.currentlyUsing", { mode: resolvedMode })}
          </Text>
        </View>

        <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
          {t("settings.theme")}
        </Text>

        <View className="gap-3">
          {THEME_OPTIONS.map((option) => {
            const isSelected = preference === option.value;
            const labels = THEME_LABELS[option.value];
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelectTheme(option.value)}
                className={`rounded-card p-4 flex-row items-center ${
                  isSelected
                    ? "bg-primary/10 dark:bg-primary-dark/10 border-2 border-primary dark:border-primary-dark"
                    : "bg-surface-secondary dark:bg-surface-dark-secondary border-2 border-transparent"
                } active:opacity-80`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text className="text-2xl mr-4">{option.icon}</Text>
                <View className="flex-1">
                  <Text
                    className={`text-base font-medium ${
                      isSelected
                        ? "text-primary dark:text-primary-dark"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    {t(labels.label)}
                  </Text>
                  <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
                    {t(labels.description)}
                  </Text>
                </View>
                {isSelected && (
                  <Text className="text-xl text-primary dark:text-primary-dark">
                    {"\u{2713}"}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
