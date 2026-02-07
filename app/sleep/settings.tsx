import { useCallback, useState } from "react";
import { Pressable, Text, View, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSleep, useBaby } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";

const QUICK_GOALS_HOURS = [11, 12, 13, 14, 15, 16];

export default function SleepSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const {
    dailyGoalMinutes,
    goalSource,
    currentAgeGroup,
    setCustomGoal,
    resetToAgeBasedGoal,
  } = useSleep();

  const currentGoalHours = dailyGoalMinutes / 60;
  const [customHours, setCustomHours] = useState(currentGoalHours.toString());
  const [isSettingCustom, setIsSettingCustom] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSelectQuickGoal = useCallback(
    async (hours: number) => {
      await setCustomGoal(hours * 60);
    },
    [setCustomGoal]
  );

  const handleUseAgeBased = useCallback(async () => {
    await resetToAgeBasedGoal();
  }, [resetToAgeBasedGoal]);

  const handleSetCustomGoal = useCallback(async () => {
    const hours = parseFloat(customHours);
    if (isNaN(hours) || hours < 8 || hours > 20) {
      return;
    }
    await setCustomGoal(hours * 60);
    setIsSettingCustom(false);
  }, [customHours, setCustomGoal]);

  const formatGoalDisplay = (minutes: number) => {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) {
      return `${hours} hours`;
    }
    return `${hours.toFixed(1)} hours`;
  };

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">←</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("sleep.goalSettingsTitle")}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {/* Current Goal Display */}
        <View
          className="rounded-card p-4 mb-6"
          style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
        >
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
            {t("sleep.currentGoal")}
          </Text>
          <Text
            className="text-3xl font-bold mb-2"
            style={{ color: SLEEP_PURPLE }}
          >
            {formatGoalDisplay(dailyGoalMinutes)}
          </Text>
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
            {goalSource === "custom"
              ? t("sleep.customGoalNote")
              : currentAgeGroup
                ? t("sleep.basedOnGuidelines", {
                    ageGroup: currentAgeGroup.label,
                  })
                : t("sleep.ageBasedGoal")}
          </Text>
        </View>

        {/* Age Group Info */}
        {currentAgeGroup && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
              {t("sleep.ageGroup")}
            </Text>
            <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-1">
                {currentAgeGroup.label}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {t("sleep.recommendedRange", {
                  min: currentAgeGroup.totalSleepHoursMin,
                  max: currentAgeGroup.totalSleepHoursMax,
                })}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
                {t("sleep.napsPerDay", {
                  min: currentAgeGroup.napsMin,
                  max: currentAgeGroup.napsMax,
                })}
              </Text>
            </View>
          </View>
        )}

        {/* Quick Goal Selection */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("sleep.quickGoals")}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_GOALS_HOURS.map((hours) => {
              const isSelected = dailyGoalMinutes === hours * 60;
              return (
                <Pressable
                  key={hours}
                  onPress={() => handleSelectQuickGoal(hours)}
                  className={`px-5 py-3 rounded-button-lg ${
                    isSelected
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  } active:opacity-80`}
                  style={isSelected ? { backgroundColor: SLEEP_PURPLE } : undefined}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    className={`text-base font-medium ${
                      isSelected
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    {t("sleep.goalHours", { hours })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom Goal Input */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("sleep.customHours")}
          </Text>
          <View className="flex-row items-center gap-3">
            <TextInput
              value={customHours}
              onChangeText={setCustomHours}
              onFocus={() => setIsSettingCustom(true)}
              keyboardType="decimal-pad"
              maxLength={4}
              className="flex-1 bg-surface-secondary dark:bg-surface-dark-secondary rounded-input px-4 py-3 text-lg text-content-primary dark:text-content-dark-primary"
              accessibilityLabel={t("sleep.customHours")}
            />
            <Pressable
              onPress={handleSetCustomGoal}
              disabled={!isSettingCustom}
              className={`px-6 py-3 rounded-button-lg ${
                isSettingCustom ? "" : "opacity-50"
              }`}
              style={{ backgroundColor: SLEEP_PURPLE }}
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-white">
                {t("common.save")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Use Age-Based Goal Button */}
        {goalSource === "custom" && currentAgeGroup && (
          <Pressable
            onPress={handleUseAgeBased}
            className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-1">
              {t("sleep.useAgeBasedGoal")}
            </Text>
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
              {t("sleep.recommendedRange", {
                min: currentAgeGroup.totalSleepHoursMin,
                max: currentAgeGroup.totalSleepHoursMax,
              })}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
