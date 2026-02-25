import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const SLEEP_PURPLE = "#6B5B95";

interface NapReminderWarningModalProps {
  visible: boolean;
  onEnable: () => void;
  onCancel: () => void;
}

export function NapReminderWarningModal({
  visible,
  onEnable,
  onCancel,
}: NapReminderWarningModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center bg-black/50 px-6">
        <View className="bg-surface dark:bg-surface-dark rounded-card-lg w-full max-w-sm p-6">
          <View className="items-center mb-4">
            <Text className="text-5xl">{"\uD83D\uDC76"}</Text>
          </View>

          <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-3">
            {t("sleep.napReminderWarningTitle")}
          </Text>

          <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-6">
            {t("sleep.napReminderWarningMessage")}
          </Text>

          <View className="gap-3">
            <Pressable
              onPress={onEnable}
              className="py-4 rounded-button-lg items-center active:opacity-80"
              style={{ backgroundColor: SLEEP_PURPLE }}
              accessibilityRole="button"
            >
              <Text className="text-base font-semibold text-white">
                {t("sleep.napReminderWarningEnable")}
              </Text>
            </Pressable>

            <Pressable
              onPress={onCancel}
              className="py-4 rounded-button-lg items-center bg-surface-secondary dark:bg-surface-dark-secondary active:opacity-80"
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
                {t("common.cancel")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
