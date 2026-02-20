import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  getWidgetConfiguration,
  saveWidgetConfiguration,
  type WidgetConfiguration,
} from "@/services/widget-data-service";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import type { TFunction } from "i18next";

const ALL_ACTIVITIES: ActivityType[] = [
  "feeding",
  "sleep",
  "diaper",
  "pumping",
  "tummyTime",
];

interface ActivityItem {
  key: ActivityType;
  enabled: boolean;
}

type WidgetSection =
  | "smallWidget"
  | "quickLog"
  | "summary"
  | "lockScreen"
  | "watch";

function getActivityLabels(t: TFunction): Partial<Record<ActivityType, string>> {
  return {
    feeding: t("widget.activityFeeding"),
    sleep: t("widget.activitySleep"),
    diaper: t("widget.activityDiaper"),
    pumping: t("widget.activityPumping"),
    tummyTime: t("widget.activityTummyTime"),
  };
}

function getSectionTitles(t: TFunction): Record<WidgetSection, string> {
  return {
    smallWidget: t("widget.sectionSmallWidget"),
    quickLog: t("widget.sectionQuickLog"),
    summary: t("widget.sectionSummary"),
    lockScreen: t("widget.sectionLockScreen"),
    watch: t("widget.sectionAppleWatch"),
  };
}

function getSectionDescriptions(t: TFunction): Record<WidgetSection, string> {
  return {
    smallWidget: t("widget.descChooseActivity"),
    quickLog: t("widget.descSelectReorder4"),
    summary: t("widget.descSelectReorder4"),
    lockScreen: t("widget.descSelectUpTo2"),
    watch: t("widget.descSelectReorder4"),
  };
}

export default function WidgetConfigScreen() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WidgetConfiguration | null>(null);
  const [activeSection, setActiveSection] = useState<WidgetSection | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const activityLabels = getActivityLabels(t);
  const sectionTitles = getSectionTitles(t);
  const sectionDescriptions = getSectionDescriptions(t);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const savedConfig = await getWidgetConfiguration();
    setConfig(savedConfig);
  };

  const saveConfig = async () => {
    if (!config) return;
    await saveWidgetConfiguration(config);
    setHasChanges(false);
    Alert.alert(t("common.success"), t("widget.saved"));
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        t("widget.unsavedChangesTitle"),
        t("widget.unsavedChangesMessage"),
        [
          { text: t("widget.discard"), style: "destructive", onPress: () => router.back() },
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.save"), onPress: async () => {
              await saveConfig();
              router.back();
            }
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const updateSmallWidgetActivity = (activity: ActivityType) => {
    if (!config) return;
    setConfig({ ...config, smallWidgetActivity: activity });
    setHasChanges(true);
  };

  const updateQuickLogActivities = (activities: ActivityType[]) => {
    if (!config || activities.length !== 4) return;
    setConfig({
      ...config,
      quickLogActivities: activities as [ActivityType, ActivityType, ActivityType, ActivityType],
    });
    setHasChanges(true);
  };

  const updateSummaryActivities = (activities: ActivityType[]) => {
    if (!config || activities.length !== 4) return;
    setConfig({
      ...config,
      summaryActivities: activities as [ActivityType, ActivityType, ActivityType, ActivityType],
    });
    setHasChanges(true);
  };

  const updateLockScreenActivities = (activities: ActivityType[]) => {
    if (!config) return;
    setConfig({ ...config, lockScreenActivities: activities.slice(0, 2) });
    setHasChanges(true);
  };

  const updateWatchActivities = (activities: ActivityType[]) => {
    if (!config || activities.length !== 4) return;
    setConfig({
      ...config,
      watchActivities: activities as [ActivityType, ActivityType, ActivityType, ActivityType],
    });
    setHasChanges(true);
  };

  if (!config) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  if (Platform.OS !== "ios") {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
        <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
          <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("widget.configuration")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📱</Text>
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary text-center mb-2">
            {t("widget.iosOnlyTitle")}
          </Text>
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t("widget.iosOnlyMessage")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
        <View className="flex-row items-center pt-2 pb-3 px-4 border-b border-border-subtle dark:border-border-dark-subtle">
          <Pressable onPress={handleBack} className="mr-4">
            <Text className="text-action-primary dark:text-action-dark-primary text-base">
              {t("common.back")}
            </Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary text-center">
              {t("widget.configuration")}
            </Text>
          </View>
          <Pressable onPress={saveConfig} disabled={!hasChanges}>
            <Text
              className={`text-base ${
                hasChanges
                  ? "text-action-primary dark:text-action-dark-primary font-semibold"
                  : "text-content-tertiary dark:text-content-dark-tertiary"
              }`}
            >
              {t("common.save")}
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {activeSection === null ? (
            <>
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-4 px-2">
                {t("widget.description")}
              </Text>

              <SectionCard
                title={sectionTitles.smallWidget}
                description={sectionDescriptions.smallWidget}
                icon="📱"
                onPress={() => setActiveSection("smallWidget")}
                preview={
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                    {ACTIVITY_CONFIG[config.smallWidgetActivity].icon} {activityLabels[config.smallWidgetActivity]}
                  </Text>
                }
              />

              <SectionCard
                title={sectionTitles.quickLog}
                description={sectionDescriptions.quickLog}
                icon="⚡"
                onPress={() => setActiveSection("quickLog")}
                preview={
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                    {config.quickLogActivities.map(a => ACTIVITY_CONFIG[a].icon).join(" ")}
                  </Text>
                }
              />

              <SectionCard
                title={sectionTitles.summary}
                description={sectionDescriptions.summary}
                icon="📊"
                onPress={() => setActiveSection("summary")}
                preview={
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                    {config.summaryActivities.map(a => ACTIVITY_CONFIG[a].icon).join(" ")}
                  </Text>
                }
              />

              <SectionCard
                title={sectionTitles.lockScreen}
                description={sectionDescriptions.lockScreen}
                icon="🔒"
                onPress={() => setActiveSection("lockScreen")}
                preview={
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                    {config.lockScreenActivities.map(a => ACTIVITY_CONFIG[a].icon).join(" ")}
                  </Text>
                }
              />

              <SectionCard
                title={sectionTitles.watch}
                description={sectionDescriptions.watch}
                icon="⌚"
                onPress={() => setActiveSection("watch")}
                preview={
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                    {config.watchActivities.map(a => ACTIVITY_CONFIG[a].icon).join(" ")}
                  </Text>
                }
              />

              <View className="h-8" />
            </>
          ) : activeSection === "smallWidget" ? (
            <SingleActivitySelector
              title={sectionTitles.smallWidget}
              description={sectionDescriptions.smallWidget}
              selectedActivity={config.smallWidgetActivity}
              onSelect={updateSmallWidgetActivity}
              onBack={() => setActiveSection(null)}
              activityLabels={activityLabels}
            />
          ) : activeSection === "quickLog" ? (
            <MultiActivitySelector
              title={sectionTitles.quickLog}
              description={sectionDescriptions.quickLog}
              selectedActivities={[...config.quickLogActivities]}
              maxActivities={4}
              onUpdate={updateQuickLogActivities}
              onBack={() => setActiveSection(null)}
              activityLabels={activityLabels}
            />
          ) : activeSection === "summary" ? (
            <MultiActivitySelector
              title={sectionTitles.summary}
              description={sectionDescriptions.summary}
              selectedActivities={[...config.summaryActivities]}
              maxActivities={4}
              onUpdate={updateSummaryActivities}
              onBack={() => setActiveSection(null)}
              activityLabels={activityLabels}
            />
          ) : activeSection === "lockScreen" ? (
            <MultiActivitySelector
              title={sectionTitles.lockScreen}
              description={sectionDescriptions.lockScreen}
              selectedActivities={[...config.lockScreenActivities]}
              maxActivities={2}
              onUpdate={updateLockScreenActivities}
              onBack={() => setActiveSection(null)}
              activityLabels={activityLabels}
            />
          ) : activeSection === "watch" ? (
            <MultiActivitySelector
              title={sectionTitles.watch}
              description={sectionDescriptions.watch}
              selectedActivities={[...config.watchActivities]}
              maxActivities={4}
              onUpdate={updateWatchActivities}
              onBack={() => setActiveSection(null)}
              activityLabels={activityLabels}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

interface SectionCardProps {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
  preview: React.ReactNode;
}

function SectionCard({ title, description, icon, onPress, preview }: SectionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4 mb-3 active:opacity-80"
    >
      <View className="flex-row items-center mb-2">
        <Text className="text-2xl mr-3">{icon}</Text>
        <View className="flex-1">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
            {title}
          </Text>
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
            {description}
          </Text>
        </View>
        <Text className="text-content-tertiary dark:text-content-dark-tertiary text-lg">
          ›
        </Text>
      </View>
      <View className="ml-10">{preview}</View>
    </Pressable>
  );
}

interface SingleActivitySelectorProps {
  title: string;
  description: string;
  selectedActivity: ActivityType;
  onSelect: (activity: ActivityType) => void;
  onBack: () => void;
  activityLabels: Partial<Record<ActivityType, string>>;
}

function SingleActivitySelector({
  title,
  description,
  selectedActivity,
  onSelect,
  onBack,
  activityLabels,
}: SingleActivitySelectorProps) {
  const { t } = useTranslation();

  return (
    <View>
      <Pressable onPress={onBack} className="flex-row items-center mb-4">
        <Text className="text-action-primary dark:text-action-dark-primary mr-2">
          ‹
        </Text>
        <Text className="text-action-primary dark:text-action-dark-primary">
          {t("common.back")}
        </Text>
      </Pressable>

      <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-1">
        {title}
      </Text>
      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-4">
        {description}
      </Text>

      {ALL_ACTIVITIES.map(activity => (
        <Pressable
          key={activity}
          onPress={() => onSelect(activity)}
          className={`flex-row items-center p-4 mb-2 rounded-card ${
            selectedActivity === activity
              ? "bg-action-primary/10 dark:bg-action-dark-primary/10"
              : "bg-surface-card dark:bg-surface-dark-card"
          }`}
        >
          <Text className="text-2xl mr-3">{ACTIVITY_CONFIG[activity].icon}</Text>
          <Text className="flex-1 text-base text-content-primary dark:text-content-dark-primary">
            {activityLabels[activity]}
          </Text>
          {selectedActivity === activity && (
            <Text className="text-action-primary dark:text-action-dark-primary text-xl">
              ✓
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

interface MultiActivitySelectorProps {
  title: string;
  description: string;
  selectedActivities: ActivityType[];
  maxActivities: number;
  onUpdate: (activities: ActivityType[]) => void;
  onBack: () => void;
  activityLabels: Partial<Record<ActivityType, string>>;
}

function MultiActivitySelector({
  title,
  description,
  selectedActivities,
  maxActivities,
  onUpdate,
  onBack,
  activityLabels,
}: MultiActivitySelectorProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ActivityItem[]>(() =>
    ALL_ACTIVITIES.map(key => ({
      key,
      enabled: selectedActivities.includes(key),
    }))
  );

  useEffect(() => {
    const enabled = items.filter(i => i.enabled).map(i => i.key);
    if (enabled.length === maxActivities) {
      onUpdate(enabled);
    }
  }, [items, maxActivities, onUpdate]);

  const toggleActivity = (activity: ActivityType) => {
    setItems(prev => {
      const current = prev.find(i => i.key === activity);
      if (!current) return prev;

      const enabledCount = prev.filter(i => i.enabled).length;

      if (current.enabled) {
        if (enabledCount <= maxActivities) {
          return prev;
        }
        return prev.map(i =>
          i.key === activity ? { ...i, enabled: false } : i
        );
      } else {
        if (enabledCount >= maxActivities) {
          return prev;
        }
        return prev.map(i =>
          i.key === activity ? { ...i, enabled: true } : i
        );
      }
    });
  };

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ActivityItem>) => (
      <ScaleDecorator>
        <Pressable
          onLongPress={item.enabled ? drag : undefined}
          disabled={isActive}
          className={`flex-row items-center p-4 mb-2 rounded-card ${
            isActive
              ? "bg-action-primary/20 dark:bg-action-dark-primary/20"
              : item.enabled
                ? "bg-surface-card dark:bg-surface-dark-card"
                : "bg-surface-secondary dark:bg-surface-dark-secondary opacity-60"
          }`}
        >
          {item.enabled && (
            <Text className="text-content-tertiary dark:text-content-dark-tertiary mr-3">
              ☰
            </Text>
          )}
          <Text className="text-2xl mr-3">{ACTIVITY_CONFIG[item.key].icon}</Text>
          <Text
            className={`flex-1 text-base ${
              item.enabled
                ? "text-content-primary dark:text-content-dark-primary"
                : "text-content-tertiary dark:text-content-dark-tertiary"
            }`}
          >
            {activityLabels[item.key]}
          </Text>
          <Pressable
            onPress={() => toggleActivity(item.key)}
            className="p-2"
          >
            <View
              className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                item.enabled
                  ? "bg-action-primary dark:bg-action-dark-primary border-action-primary dark:border-action-dark-primary"
                  : "border-content-tertiary dark:border-content-dark-tertiary"
              }`}
            >
              {item.enabled && (
                <Text className="text-white text-xs font-bold">✓</Text>
              )}
            </View>
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    ),
    [toggleActivity, activityLabels]
  );

  const onDragEnd = useCallback(
    ({ data }: { data: ActivityItem[] }) => {
      setItems(data);
    },
    []
  );

  const enabledCount = items.filter(i => i.enabled).length;

  return (
    <View className="flex-1">
      <Pressable onPress={onBack} className="flex-row items-center mb-4">
        <Text className="text-action-primary dark:text-action-dark-primary mr-2">
          ‹
        </Text>
        <Text className="text-action-primary dark:text-action-dark-primary">
          {t("common.back")}
        </Text>
      </Pressable>

      <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-1">
        {title}
      </Text>
      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
        {description}
      </Text>
      <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mb-4">
        {enabledCount}/{maxActivities} {t("widget.selectedReorder")}
      </Text>

      <DraggableFlatList
        data={items}
        onDragEnd={onDragEnd}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        scrollEnabled={false}
      />
    </View>
  );
}
