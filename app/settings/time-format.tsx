import { useCallback } from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTimeFormat } from "@/contexts";
import type { TimeFormat } from "@/contexts";

type TimeFormatOptionConfig = {
  value: TimeFormat;
  icon: string;
  label: string;
  description: string;
};

const TIME_FORMAT_OPTIONS: TimeFormatOptionConfig[] = [
  {
    value: "12h",
    icon: "\u{1F550}",
    label: "settings.12hour",
    description: "1:30 PM",
  },
  {
    value: "24h",
    icon: "\u{1F551}",
    label: "settings.24hour",
    description: "13:30",
  },
];

export default function TimeFormatSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { timeFormat, setTimeFormat } = useTimeFormat();

  const handleSelect = useCallback(
    async (format: TimeFormat) => {
      await setTimeFormat(format);
      router.back();
    },
    [setTimeFormat, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("settings.timeFormat")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="gap-3">
          {TIME_FORMAT_OPTIONS.map((option) => {
            const isSelected = timeFormat === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                className={`rounded-card p-4 flex-row items-center ${
                  isSelected
                    ? "bg-primary/10 dark:bg-primary-dark/10 border-2 border-primary dark:border-primary-dark"
                    : "bg-surface-secondary dark:bg-surface-dark-secondary border-2 border-transparent"
                } active:opacity-80`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                testID={`time-format-${option.value}`}
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
                    {option.value === "12h" ? t("settings.12hour") : t("settings.24hour")}
                  </Text>
                  <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
                    {option.description}
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
