import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

export function DiscardTimerLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={t("common.discardTimer")}
      style={{ marginTop: 26, paddingVertical: 8, paddingHorizontal: 12 }}
    >
      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
        ✕ {t("common.discardTimer")}
      </Text>
    </Pressable>
  );
}
