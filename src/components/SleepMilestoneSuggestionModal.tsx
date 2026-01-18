import { useCallback } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";

interface SleepMilestoneSuggestionModalProps {
  visible: boolean;
  currentGoalMinutes: number;
  suggestedGoalMinutes: number;
  ageGroupLabel: string;
  onAccept: () => void;
  onDismiss: () => void;
  onKeepCurrent: () => void;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours}h`;
  }
  return `${hours.toFixed(1)}h`;
}

export function SleepMilestoneSuggestionModal({
  visible,
  currentGoalMinutes,
  suggestedGoalMinutes,
  ageGroupLabel,
  onAccept,
  onDismiss,
  onKeepCurrent,
}: SleepMilestoneSuggestionModalProps) {
  const { t } = useTranslation();

  const handleAccept = useCallback(() => {
    onAccept();
  }, [onAccept]);

  const handleKeepCurrent = useCallback(() => {
    onKeepCurrent();
  }, [onKeepCurrent]);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center bg-black/50 px-6">
        <View className="bg-surface dark:bg-surface-dark rounded-card-lg w-full max-w-sm p-6">
          {/* Icon */}
          <View className="items-center mb-4">
            <Text className="text-5xl">😴</Text>
          </View>

          {/* Title */}
          <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-3">
            {t("sleep.milestoneSuggestionTitle")}
          </Text>

          {/* Message */}
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
            {t("sleep.milestoneSuggestionMessage", {
              ageGroup: ageGroupLabel,
            })}
          </Text>

          {/* Goal Comparison */}
          <View className="flex-row justify-between mb-6">
            <View className="flex-1 items-center p-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-card mr-2">
              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mb-1">
                {t("sleep.currentGoalLabel")}
              </Text>
              <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
                {formatHours(currentGoalMinutes)}
              </Text>
            </View>
            <View
              className="flex-1 items-center p-3 rounded-card ml-2"
              style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
            >
              <Text
                className="text-xs mb-1"
                style={{ color: SLEEP_PURPLE }}
              >
                {t("sleep.suggestedGoalLabel")}
              </Text>
              <Text
                className="text-lg font-semibold"
                style={{ color: SLEEP_PURPLE }}
              >
                {formatHours(suggestedGoalMinutes)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Pressable
              onPress={handleAccept}
              className="py-4 rounded-button-lg items-center active:opacity-80"
              style={{ backgroundColor: SLEEP_PURPLE }}
              accessibilityRole="button"
            >
              <Text className="text-base font-semibold text-white">
                {t("sleep.updateGoal")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleKeepCurrent}
              className="py-4 rounded-button-lg items-center bg-surface-secondary dark:bg-surface-dark-secondary active:opacity-80"
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
                {t("sleep.keepCurrentGoal")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDismiss}
              className="py-2 items-center"
              accessibilityRole="button"
            >
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {t("sleep.dismissSuggestion")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
