import { Pressable, Text, View, Platform, useColorScheme } from "react-native";
import { forwardRef, useCallback } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBaby } from "@/contexts";
import { BabySelector } from "./BabySelector";

const isAndroid = Platform.OS === "android";

interface BabyHeaderProps {
  onSettingsPress?: () => void;
  tipsExpanded?: boolean;
  hasTips?: boolean;
  tipsViewed?: boolean;
  onTipToggle?: () => void;
  testID?: string;
}

const BabyHeader = forwardRef<View, BabyHeaderProps>(
  ({ onSettingsPress, tipsExpanded = false, hasTips = false, tipsViewed = false, onTipToggle, testID }, ref) => {
    const { t } = useTranslation();
    const { selectedBaby, isLoading } = useBaby();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

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
            testID="add-baby-button"
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
              testID="settings-button"
            >
              <Text className="text-2xl">⚙️</Text>
            </Pressable>
          )}
        </View>
      );
    }

    const tipBulbBg = tipsExpanded
      ? isDark ? "rgba(224,185,144,0.2)" : "rgba(212,165,116,0.15)"
      : isDark ? "rgba(224,185,144,0.1)" : "rgba(212,165,116,0.1)";

    const tipDotColor = isDark ? "#E0B990" : "#D4A574";
    const tipDotBorder = isDark ? "#121110" : "#F5EDE8";

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
          {onTipToggle && (
            <Pressable
              onPress={onTipToggle}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tipBulbBg,
              }}
              accessibilityRole="button"
              accessibilityLabel={t("tips.toggle")}
              testID="tip-toggle-button"
            >
              <Text style={{ fontSize: 18 }}>💡</Text>
              {hasTips && !tipsViewed && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: tipDotColor,
                    borderWidth: 1.5,
                    borderColor: tipDotBorder,
                  }}
                />
              )}
            </Pressable>
          )}

          <Pressable
            onPress={handleEditBaby}
            className="w-11 h-11 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center active:scale-95"
            accessibilityRole="button"
            accessibilityLabel={t("baby.editBaby")}
            testID="edit-baby-button"
          >
            <Text className="text-lg">✏️</Text>
          </Pressable>

          {onSettingsPress && (
            <Pressable
              onPress={onSettingsPress}
              className="w-11 h-11 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center active:scale-95"
              accessibilityRole="button"
              accessibilityLabel={t("navigation.settings")}
              testID="settings-button"
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
