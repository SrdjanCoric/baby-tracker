import { useCallback, useMemo } from "react";
import { Text, View, Switch, Alert, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useDashboardConfig } from "@/contexts";
import { ACTIVITY_CONFIG, ActivityType } from "@/constants/activities";
import { DashboardCardConfig } from "@/services/dashboard-config-storage";

export default function DashboardSettingsScreen() {
  const { t } = useTranslation();
  const { config, setCardVisibility, reorderCards, resetToDefault } = useDashboardConfig();

  const sortedCards = useMemo(
    () => [...config.cards].sort((a, b) => a.order - b.order),
    [config.cards]
  );

  const activityLabels = useMemo(() => ({
    feeding: t("feeding.title"),
    sleep: t("sleep.title"),
    diaper: t("diaper.title"),
    pumping: t("pumping.title"),
    tummyTime: t("tummyTime.title"),
    growth: t("growth.title"),
  }), [t]);

  const handleToggleVisibility = useCallback(
    async (activity: ActivityType, visible: boolean) => {
      await setCardVisibility(activity, visible);
    },
    [setCardVisibility]
  );

  const handleDragEnd = useCallback(
    async ({ data }: { data: DashboardCardConfig[] }) => {
      await reorderCards(data);
    },
    [reorderCards]
  );

  const handleReset = useCallback(() => {
    Alert.alert(
      t("settings.resetDashboard"),
      t("settings.resetDashboardConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.reset"),
          style: "destructive",
          onPress: () => resetToDefault(),
        },
      ]
    );
  }, [t, resetToDefault]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<DashboardCardConfig>) => {
      const activityConfig = ACTIVITY_CONFIG[item.activity];

      return (
        <ScaleDecorator>
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            activeOpacity={0.7}
            disabled={isActive}
            style={[
              styles.item,
              isActive && styles.activeItem,
            ]}
          >
            <Text style={styles.dragHandle}>{"\u2630"}</Text>
            <Text style={styles.activityIcon}>{activityConfig.icon}</Text>
            <Text style={styles.activityLabel}>
              {activityLabels[item.activity]}
            </Text>
            <Pressable
              onPress={() => handleToggleVisibility(item.activity, !item.visible)}
              testID={`toggle-${item.activity}`}
            >
              <Switch
                value={item.visible}
                onValueChange={(value) => handleToggleVisibility(item.activity, value)}
                pointerEvents="none"
              />
            </Pressable>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    },
    [activityLabels, handleToggleVisibility]
  );

  const keyExtractor = useCallback((item: DashboardCardConfig) => item.activity, []);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerHandle} />
          <Text style={styles.headerTitle}>
            {t("settings.customizeDashboard")}
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>
            {t("settings.showHideCards")}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {t("settings.dragToReorder")}
          </Text>

          <View style={styles.listContainer}>
            <DraggableFlatList
              data={sortedCards}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              onDragEnd={handleDragEnd}
            />
          </View>

          <View style={styles.resetButton}>
            <Text onPress={handleReset} style={styles.resetButtonText}>
              {t("settings.resetToDefault")}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  listContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  activeItem: {
    backgroundColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  dragHandle: {
    fontSize: 20,
    color: "#9CA3AF",
    paddingRight: 16,
    paddingVertical: 4,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  activityLabel: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
  },
  resetButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  resetButtonText: {
    textAlign: "center",
    color: "#EF4444",
    fontWeight: "500",
  },
});
