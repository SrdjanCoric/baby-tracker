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
  {
    value: "es",
    icon: "\u{1F30E}",
  },
  {
    value: "es-ES",
    icon: "\u{1F1EA}\u{1F1F8}",
  },
  {
    value: "fr",
    icon: "\u{1F1EB}\u{1F1F7}",
  },
  {
    value: "pt-PT",
    icon: "\u{1F1F5}\u{1F1F9}",
  },
  {
    value: "pt-BR",
    icon: "\u{1F1E7}\u{1F1F7}",
  },
  {
    value: "de",
    icon: "\u{1F1E9}\u{1F1EA}",
  },
  {
    value: "it",
    icon: "\u{1F1EE}\u{1F1F9}",
  },
];

const LANGUAGE_LABELS = {
  system: { label: "settings.systemDefault", description: "settings.systemDefaultDesc" },
  en: { label: "settings.english", description: "English" },
  sr: { label: "settings.serbian", description: "Srpski" },
  es: { label: "settings.spanishLatam", description: "Español (Latinoamérica)" },
  "es-ES": { label: "settings.spanishSpain", description: "Español (España)" },
  fr: { label: "settings.french", description: "Français" },
  "pt-PT": { label: "settings.portuguesePT", description: "Português (Portugal)" },
  "pt-BR": { label: "settings.portugueseBR", description: "Português (Brasil)" },
  de: { label: "settings.german", description: "Deutsch" },
  it: { label: "settings.italian", description: "Italiano" },
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
            {resolvedLanguage === "sr" ? "Srpski" : resolvedLanguage === "es" ? "Español (Latinoamérica)" : resolvedLanguage === "es-ES" ? "Español (España)" : resolvedLanguage === "fr" ? "Français" : resolvedLanguage === "pt-BR" ? "Português (Brasil)" : resolvedLanguage === "pt-PT" ? "Português (Portugal)" : resolvedLanguage === "de" ? "Deutsch" : resolvedLanguage === "it" ? "Italiano" : "English"}
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
                testID={`language-${option.value}`}
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
