import { Pressable, Text, View } from "react-native";
import { forwardRef, useCallback } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBaby } from "@/contexts";
import { BabySelector } from "./BabySelector";

interface BabyHeaderProps {
  onSettingsPress?: () => void;
  testID?: string;
}

const BabyHeader = forwardRef<View, BabyHeaderProps>(
  ({ onSettingsPress, testID }, ref) => {
    const { t } = useTranslation();
    const { selectedBaby, isLoading } = useBaby();

    const handleAddBaby = useCallback(() => {
      router.push("/baby/add");
    }, []);

    const handleEditBaby = useCallback(() => {
      if (selectedBaby) {
        router.push(`/baby/${selectedBaby.id}`);
      }
    }, [selectedBaby]);

    if (isLoading) {
      return (
        <View
          ref={ref}
          testID={testID}
          className="flex-row items-center justify-between px-4 py-3"
        >
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 mr-3" />
            <View>
              <View className="w-24 h-5 rounded bg-gray-200 dark:bg-gray-700 mb-1" />
              <View className="w-16 h-4 rounded bg-gray-100 dark:bg-gray-800" />
            </View>
          </View>
        </View>
      );
    }

    if (!selectedBaby) {
      return (
        <View
          ref={ref}
          testID={testID}
          className="flex-row items-center justify-between px-4 py-3"
        >
          <Pressable
            onPress={handleAddBaby}
            className="flex-row items-center flex-1 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t("baby.addFirstBaby")}
          >
            <View className="w-12 h-12 rounded-full bg-action-primary/10 dark:bg-action-dark-primary/20 items-center justify-center mr-3">
              <Text className="text-2xl">➕</Text>
            </View>
            <Text className="text-lg font-semibold text-action-primary dark:text-action-dark-primary">
              {t("baby.addBaby")}
            </Text>
          </Pressable>

          {onSettingsPress && (
            <Pressable
              onPress={onSettingsPress}
              className="w-11 h-11 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center active:scale-95"
              accessibilityRole="button"
              accessibilityLabel={t("navigation.settings")}
            >
              <Text className="text-xl">⚙️</Text>
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <View
        ref={ref}
        testID={testID}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-1">
          <BabySelector onAddBaby={handleAddBaby} />
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={handleEditBaby}
            className="w-11 h-11 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center active:scale-95"
            accessibilityRole="button"
            accessibilityLabel={t("baby.editBaby")}
          >
            <Text className="text-lg">✏️</Text>
          </Pressable>

          {onSettingsPress && (
            <Pressable
              onPress={onSettingsPress}
              className="w-11 h-11 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center active:scale-95"
              accessibilityRole="button"
              accessibilityLabel={t("navigation.settings")}
            >
              <Text className="text-xl">⚙️</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }
);

BabyHeader.displayName = "BabyHeader";

export { BabyHeader, type BabyHeaderProps };
