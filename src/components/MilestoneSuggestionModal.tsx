import { useCallback } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatDuration } from "@/utils/time";

const TUMMY_ORANGE = "#E67E22";
const TUMMY_ORANGE_MUTED = "#FEF3E2";

interface MilestoneSuggestionModalProps {
  visible: boolean;
  currentGoalSeconds: number;
  suggestedGoalSeconds: number;
  ageGroupLabel: string;
  onAccept: () => void;
  onDismiss: () => void;
  onKeepCurrent: () => void;
}

export function MilestoneSuggestionModal({
  visible,
  currentGoalSeconds,
  suggestedGoalSeconds,
  ageGroupLabel,
  onAccept,
  onDismiss,
  onKeepCurrent,
}: MilestoneSuggestionModalProps) {
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
            <Text className="text-5xl">🎉</Text>
          </View>

          {/* Title */}
          <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-3">
            {t("tummyTime.milestoneSuggestionTitle")}
          </Text>

          {/* Message */}
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
            {t("tummyTime.milestoneSuggestionMessage", {
              ageGroup: ageGroupLabel,
            })}
          </Text>

          {/* Goal Comparison */}
          <View className="flex-row justify-between mb-6">
            <View className="flex-1 items-center p-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-card mr-2">
              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mb-1">
                {t("tummyTime.currentGoalLabel")}
              </Text>
              <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
                {formatDuration(currentGoalSeconds)}
              </Text>
            </View>
            <View
              className="flex-1 items-center p-3 rounded-card ml-2"
              style={{ backgroundColor: TUMMY_ORANGE_MUTED }}
            >
              <Text
                className="text-xs mb-1"
                style={{ color: TUMMY_ORANGE }}
              >
                {t("tummyTime.suggestedGoalLabel")}
              </Text>
              <Text
                className="text-lg font-semibold"
                style={{ color: TUMMY_ORANGE }}
              >
                {formatDuration(suggestedGoalSeconds)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Pressable
              onPress={handleAccept}
              className="py-4 rounded-button-lg items-center active:opacity-80"
              style={{ backgroundColor: TUMMY_ORANGE }}
              accessibilityRole="button"
            >
              <Text className="text-base font-semibold text-white">
                {t("tummyTime.updateGoal")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleKeepCurrent}
              className="py-4 rounded-button-lg items-center bg-surface-secondary dark:bg-surface-dark-secondary active:opacity-80"
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
                {t("tummyTime.keepCurrentGoal")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDismiss}
              className="py-2 items-center"
              accessibilityRole="button"
            >
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {t("tummyTime.dismissSuggestion")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
