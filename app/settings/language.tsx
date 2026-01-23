import { useCallback } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useLanguage, type LanguageCode } from "@/contexts";

type LanguageOptionConfig = {
  value: LanguageCode;
  icon: string;
};

const LANGUAGE_OPTIONS: LanguageOptionConfig[] = [
  {
    value: "system",
    icon: "\u{1F4F1}",
  },
  {
    value: "en",
    icon: "\u{1F1EC}\u{1F1E7}",
  },
  {
    value: "sr",
    icon: "\u{1F1F7}\u{1F1F8}",
  },
];

const LANGUAGE_LABELS = {
  system: { label: "settings.systemDefault", description: "settings.systemDefaultDesc" },
  en: { label: "settings.english", description: "English" },
  sr: { label: "settings.serbian", description: "Srpski" },
} as const;

export default function LanguageSettingsScreen() {
  const { t } = useTranslation();
  const { language, resolvedLanguage, setLanguage } = useLanguage();

  const handleSelectLanguage = useCallback(
    async (langValue: LanguageCode) => {
      await setLanguage(langValue);
    },
    [setLanguage]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("settings.language")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
            {resolvedLanguage === "sr" ? "Srpski" : "English"}
          </Text>
        </View>

        <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
          {t("settings.language")}
        </Text>

        <View className="gap-3">
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = language === option.value;
            const labels = LANGUAGE_LABELS[option.value];
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelectLanguage(option.value)}
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
                    {labels.description}
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
