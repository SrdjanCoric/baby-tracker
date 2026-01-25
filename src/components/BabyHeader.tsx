import { Pressable, Text, View, Platform } from "react-native";
import { forwardRef, useCallback } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBaby } from "@/contexts";
import { BabySelector } from "./BabySelector";

const isAndroid = Platform.OS === "android";

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
          className={`flex-row items-center justify-between ${isAndroid ? "px-3 py-2" : "px-4 py-3"}`}
        >
          <Pressable
            onPress={handleAddBaby}
            className="flex-row items-center active:opacity-70 flex-1"
            accessibilityRole="button"
            accessibilityLabel={t("baby.addFirstBaby")}
          >
            <View className={`${isAndroid ? "w-10 h-10 mr-2" : "w-12 h-12 mr-3"} rounded-full bg-action-primary/20 dark:bg-action-dark-primary/30 items-center justify-center flex-shrink-0`}>
              <Text className={`${isAndroid ? "text-xl" : "text-2xl"} text-action-primary dark:text-action-dark-primary font-bold`}>+</Text>
            </View>
            <Text
              className={`${isAndroid ? "text-base" : "text-lg"} font-semibold text-action-primary dark:text-action-dark-primary`}
              numberOfLines={1}
            >
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
              <Text className="text-2xl">⚙️</Text>
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
              <Text className="text-2xl">⚙️</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }
);

BabyHeader.displayName = "BabyHeader";

export { BabyHeader, type BabyHeaderProps };
