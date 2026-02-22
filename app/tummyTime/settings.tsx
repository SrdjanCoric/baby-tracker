import { useCallback, useState } from "react";
import { Alert, Keyboard, Pressable, Text, View, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTummyTime, useBaby, useHousehold } from "@/contexts";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { formatDuration } from "@/utils/time";
import { isBabySixMonthsOrOlder } from "@/utils/tummyTimeGoals";

const TUMMY_ORANGE = "#E67E22";
const TUMMY_ORANGE_MUTED = "#FEF3E2";

const QUICK_GOALS_MINUTES = [15, 30, 45, 60];

export default function TummyTimeSettingsScreen() {
  const { t } = useTranslation();
  const { selectedBaby } = useBaby();
  const { members } = useHousehold();
  const isMultiCaregiver = members.length > 1;
  const {
    dailyGoalSeconds,
    goalSource,
    currentAgeGroup,
    setCustomGoal,
    resetToAgeBasedGoal,
  } = useTummyTime();

  const [customMinutes, setCustomMinutes] = useState(
    Math.round(dailyGoalSeconds / 60).toString()
  );
  const [isSettingCustom, setIsSettingCustom] = useState(false);

  const confirmHouseholdChange = useCallback(
    (onConfirm: () => void) => {
      if (!isMultiCaregiver) {
        onConfirm();
        return;
      }
      Alert.alert(
        t("tummyTime.householdGoalTitle"),
        t("tummyTime.householdGoalConfirm"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: onConfirm },
        ]
      );
    },
    [isMultiCaregiver, t]
  );

  const handleSelectQuickGoal = useCallback(
    (minutes: number) => {
      confirmHouseholdChange(async () => {
        await setCustomGoal(minutes * 60);
      });
    },
    [setCustomGoal, confirmHouseholdChange]
  );

  const handleUseAgeBased = useCallback(() => {
    confirmHouseholdChange(async () => {
      await resetToAgeBasedGoal();
    });
  }, [resetToAgeBasedGoal, confirmHouseholdChange]);

  const handleSetCustomGoal = useCallback(() => {
    const minutes = parseInt(customMinutes, 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 120) {
      return;
    }
    confirmHouseholdChange(async () => {
      await setCustomGoal(minutes * 60);
      setIsSettingCustom(false);
    });
  }, [customMinutes, setCustomGoal, confirmHouseholdChange]);

  const birthDate = selectedBaby?.birthDate
    ? new Date(selectedBaby.birthDate)
    : undefined;
  const showSixMonthsNote =
    birthDate && isBabySixMonthsOrOlder(birthDate);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header with drag handle */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center pt-2 pb-3"
        testID="dismiss-keyboard"
      >
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("tummyTime.goalSettingsTitle")}
        </Text>
      </Pressable>

      <ScrollView className="flex-1 px-4 py-4">
        {/* Current Goal Display */}
        <View
          className="rounded-card p-4 mb-6"
          style={{ backgroundColor: TUMMY_ORANGE_MUTED }}
        >
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
            {t("tummyTime.currentGoal")}
          </Text>
          <Text
            className="text-3xl font-bold mb-2"
            style={{ color: TUMMY_ORANGE }}
          >
            {formatDuration(dailyGoalSeconds)}
          </Text>
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
            {goalSource === "custom"
              ? t("tummyTime.customGoalNote")
              : currentAgeGroup
                ? t("tummyTime.basedOnGuidelines", {
                    ageGroup: currentAgeGroup.label,
                  })
                : t("tummyTime.ageBasedGoal")}
          </Text>
        </View>

        {/* Six Months Note */}
        {showSixMonthsNote && (
          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-card p-4 mb-6">
            <Text className="text-sm text-amber-800 dark:text-amber-200">
              {t("tummyTime.sixMonthsNote")}
            </Text>
          </View>
        )}

        {/* Age Group Info */}
        {currentAgeGroup && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
              {t("tummyTime.ageGroup")}
            </Text>
            <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-1">
                {currentAgeGroup.label}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {currentAgeGroup.rationale}
              </Text>
            </View>
          </View>
        )}

        {/* Quick Goal Selection */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("tummyTime.quickGoals")}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_GOALS_MINUTES.map((minutes) => {
              const isSelected = dailyGoalSeconds === minutes * 60;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => handleSelectQuickGoal(minutes)}
                  className={`px-6 py-3 rounded-button-lg ${
                    isSelected
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  } active:opacity-80`}
                  style={isSelected ? { backgroundColor: TUMMY_ORANGE } : undefined}
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
                    {t("tummyTime.goalMinutes", { minutes })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom Goal Input */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("tummyTime.customMinutes")}
          </Text>
          <View className="flex-row items-center gap-3">
            <TextInput
              value={customMinutes}
              onChangeText={setCustomMinutes}
              onFocus={() => setIsSettingCustom(true)}
              keyboardType="number-pad"
              maxLength={3}
              className="flex-1 bg-surface-secondary dark:bg-surface-dark-secondary rounded-input px-4 py-3 text-lg text-content-primary dark:text-content-dark-primary"
              accessibilityLabel={t("tummyTime.customMinutes")}
            />
            <Pressable
              onPress={handleSetCustomGoal}
              disabled={!isSettingCustom}
              className={`px-6 py-3 rounded-button-lg ${
                isSettingCustom ? "" : "opacity-50"
              }`}
              style={{ backgroundColor: TUMMY_ORANGE }}
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
              {t("tummyTime.useAgeBasedGoal")}
            </Text>
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
              {t("tummyTime.goalMinutes", {
                minutes: Math.round(currentAgeGroup.defaultGoalSeconds / 60),
              })}{" "}
              - {currentAgeGroup.rationale}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
