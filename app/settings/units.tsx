import { useCallback } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useUnits } from "@/contexts";

type UnitSystem = "metric" | "imperial";

type UnitOptionConfig = {
  value: UnitSystem;
  icon: string;
  label: string;
  description: string;
};

const UNIT_OPTIONS: UnitOptionConfig[] = [
  {
    value: "metric",
    icon: "\u{1F30D}",
    label: "settings.metric",
    description: "kg, cm, ml",
  },
  {
    value: "imperial",
    icon: "\u{1F1FA}\u{1F1F8}",
    label: "settings.imperial",
    description: "lbs, in, oz",
  },
];

export default function UnitsSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { unitSystem, setUnitSystem } = useUnits();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSelectUnit = useCallback(
    async (system: UnitSystem) => {
      await setUnitSystem(system);
      router.back();
    },
    [setUnitSystem, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">{"\u{2190}"}</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("settings.units")}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="gap-3">
          {UNIT_OPTIONS.map((option) => {
            const isSelected = unitSystem === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelectUnit(option.value)}
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
                    {option.value === "metric" ? t("settings.metric") : t("settings.imperial")}
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
