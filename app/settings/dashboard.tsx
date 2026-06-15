import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useDashboardConfig } from "@/contexts";
import { ACTIVITY_CONFIG, ActivityType } from "@/constants/activities";

export default function DashboardSettingsScreen() {
  const { t } = useTranslation();
  const { config, setCardVisibility, resetToDefault } = useDashboardConfig();
  const [showMinimumToast, setShowMinimumToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const sortedCards = useMemo(
    () => [...config.cards].sort((a, b) => a.order - b.order),
    [config.cards]
  );

  const showToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setShowMinimumToast(true);
    toastTimer.current = setTimeout(() => setShowMinimumToast(false), 2500);
  }, []);

  const handleToggleVisibility = useCallback(
    async (activity: ActivityType, visible: boolean) => {
      const accepted = await setCardVisibility(activity, visible);
      if (!accepted) {
        showToast();
      }
    },
    [setCardVisibility, showToast]
  );

  const handleReset = useCallback(() => {
    Alert.alert(t("settings.resetDashboard"), t("settings.resetDashboardConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.reset"),
        style: "destructive",
        onPress: () => resetToDefault(),
      },
    ]);
  }, [t, resetToDefault]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="dashboard-settings">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("settings.customizeDashboard")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider px-4 mb-2">
          {t("settings.showHideCards")}
        </Text>

        <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden mb-6">
          {sortedCards.map((card, index) => (
            <View key={card.activity}>
              {index > 0 && <View className="h-px bg-gray-200 dark:bg-gray-700 ml-14" />}
              <View className="flex-row items-center py-3 px-4">
                <Text className="text-xl mr-3">{ACTIVITY_CONFIG[card.activity].icon}</Text>
                <Text className="flex-1 text-base text-content-primary dark:text-content-dark-primary">
                  {t(`${card.activity}.title`)}
                </Text>
                <Pressable
                  onPress={() => handleToggleVisibility(card.activity, !card.visible)}
                  testID={`toggle-${card.activity}`}
                >
                  <Switch
                    value={card.visible}
                    onValueChange={(value) => handleToggleVisibility(card.activity, value)}
                    pointerEvents="none"
                  />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleReset}
          className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4 active:opacity-80"
          accessibilityRole="button"
          testID="reset-dashboard"
        >
          <Text className="text-center font-medium text-red-500">
            {t("settings.resetToDefault")}
          </Text>
        </Pressable>

        <View className="h-8" />
      </ScrollView>

      {showMinimumToast && (
        <View
          className="absolute bottom-10 left-4 right-4 bg-gray-900/90 dark:bg-gray-100/90 rounded-card px-4 py-3"
          testID="minimum-one-toast"
        >
          <Text className="text-center text-sm text-white dark:text-gray-900">
            {t("settings.minimumOneCard")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
