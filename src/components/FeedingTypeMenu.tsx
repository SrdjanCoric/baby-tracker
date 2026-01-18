import { useCallback } from "react";
import { Modal, Pressable, Text, View, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

export type FeedingMenuOption = "breastfeed" | "bottle" | "solids" | "manual";

interface FeedingTypeMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: FeedingMenuOption) => void;
}

export function FeedingTypeMenu({ visible, onClose, onSelect }: FeedingTypeMenuProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleSelect = useCallback((option: FeedingMenuOption) => {
    onSelect(option);
    onClose();
  }, [onSelect, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable
          className={`rounded-t-3xl px-6 pt-4 pb-8 ${isDark ? "bg-surface-dark" : "bg-surface"}`}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className={`w-10 h-1 rounded-full self-center mb-4 ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />

          {/* Title */}
          <Text className={`text-lg font-semibold text-center mb-6 ${isDark ? "text-content-dark-primary" : "text-content-primary"}`}>
            {t("feeding.startFeeding")}
          </Text>

          {/* Options */}
          <View className="gap-3">
            <FeedingOption
              emoji="🤱"
              label={t("feeding.breastfeeding")}
              description={t("feeding.selectSideToStart")}
              onPress={() => handleSelect("breastfeed")}
            />
            <FeedingOption
              emoji="🍼"
              label={t("feeding.bottleFeeding")}
              description={t("feeding.enterAmount")}
              onPress={() => handleSelect("bottle")}
            />
            <FeedingOption
              emoji="🥣"
              label={t("feeding.solidFood")}
              description={t("feeding.logSolidFood")}
              onPress={() => handleSelect("solids")}
            />
            <FeedingOption
              emoji="📝"
              label={t("feeding.logPastFeeding")}
              description={t("feeding.logPastFeedingDesc")}
              onPress={() => handleSelect("manual")}
            />
          </View>

          {/* Cancel button */}
          <Pressable
            onPress={onClose}
            className={`mt-4 py-4 items-center rounded-button-lg ${isDark ? "active:bg-gray-800" : "active:bg-gray-100"}`}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Text className={`text-base font-medium ${isDark ? "text-content-dark-secondary" : "text-content-secondary"}`}>
              {t("common.cancel")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface FeedingOptionProps {
  emoji: string;
  label: string;
  description: string;
  onPress: () => void;
}

function FeedingOption({ emoji, label, description, onPress }: FeedingOptionProps) {
  // Text colors are always dark because background (FEEDING_GREEN_MUTED) is always light
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center p-4 rounded-card-lg active:scale-[0.98]"
      style={{ backgroundColor: FEEDING_GREEN_MUTED }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        className="w-14 h-14 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: FEEDING_GREEN }}
      >
        <Text className="text-2xl">{emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold" style={{ color: FEEDING_GREEN_DARK }}>
          {label}
        </Text>
        <Text className="text-sm" style={{ color: "#4A6B2A" }}>
          {description}
        </Text>
      </View>
      <Text className="text-xl" style={{ color: FEEDING_GREEN }}>→</Text>
    </Pressable>
  );
}
