import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  Switch,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/contexts/notification-context";
import { FEEDING_REMINDER_INTERVALS } from "@/constants/notifications";

type SectionHeaderProps = {
  title: string;
};

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3 px-1">
      {title}
    </Text>
  );
}

type SettingsRowProps = {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
};

function SettingsRow({
  label,
  description,
  value,
  onPress,
  rightElement,
  isLast = false,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !rightElement}
      className={`flex-row items-center py-4 px-4 ${
        !isLast
          ? "border-b border-border-subtle dark:border-border-dark-subtle"
          : ""
      } ${onPress ? "active:bg-surface-secondary dark:active:bg-surface-dark-secondary" : ""}`}
    >
      <View className="flex-1">
        <Text className="text-base text-content-primary dark:text-content-dark-primary">
          {label}
        </Text>
        {description && (
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
            {description}
          </Text>
        )}
      </View>
      {value && (
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mr-2">
          {value}
        </Text>
      )}
      {rightElement}
      {onPress && !rightElement && (
        <Text className="text-content-tertiary dark:text-content-dark-tertiary ml-2">
          {"\u{203A}"}
        </Text>
      )}
    </Pressable>
  );
}

type IntervalOption = (typeof FEEDING_REMINDER_INTERVALS)[number];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    settings,
    permissionStatus,
    isLoading,
    updateSettings,
    requestPermissions,
  } = useNotifications();

  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRequestPermissions = useCallback(async () => {
    if (permissionStatus === "denied") {
      if (Platform.OS === "ios") {
        await Linking.openSettings();
      } else {
        await Linking.openSettings();
      }
    } else {
      await requestPermissions();
    }
  }, [permissionStatus, requestPermissions]);

  const handleToggleFeedingReminders = useCallback(
    async (enabled: boolean) => {
      await updateSettings({
        feedingReminders: { ...settings.feedingReminders, enabled },
      });
    },
    [settings.feedingReminders, updateSettings]
  );

  const handleToggleTimerAlerts = useCallback(
    async (enabled: boolean) => {
      await updateSettings({
        timerAlerts: { ...settings.timerAlerts, enabled },
      });
    },
    [settings.timerAlerts, updateSettings]
  );

  const handleToggleQuietHours = useCallback(
    async (enabled: boolean) => {
      await updateSettings({
        quietHours: { ...settings.quietHours, enabled },
      });
    },
    [settings.quietHours, updateSettings]
  );

  const handleSelectInterval = useCallback(
    async (interval: IntervalOption) => {
      await updateSettings({
        feedingReminders: { ...settings.feedingReminders, intervalHours: interval },
      });
      setShowIntervalPicker(false);
    },
    [settings.feedingReminders, updateSettings]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  const hasPermission = permissionStatus === "granted";

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">{"\u{2190}"}</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("settings.notifications")}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {!hasPermission && (
          <Pressable
            onPress={handleRequestPermissions}
            className="bg-warning/10 dark:bg-warning-dark/10 rounded-card p-4 mb-6"
          >
            <Text className="text-base font-medium text-warning dark:text-warning-dark mb-1">
              {permissionStatus === "denied"
                ? t("settings.permissionDenied")
                : t("settings.permissionRequired")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-3">
              {permissionStatus === "denied"
                ? t("settings.permissionDeniedDesc")
                : t("settings.permissionRequiredDesc")}
            </Text>
            <Text className="text-sm font-medium text-primary dark:text-primary-dark">
              {permissionStatus === "denied"
                ? t("settings.openSettings")
                : t("settings.enableNotifications")}
            </Text>
          </Pressable>
        )}

        <View className="mb-6">
          <SectionHeader title={t("settings.feedingReminders")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <SettingsRow
              label={t("settings.feedingReminders")}
              description={t("settings.feedingRemindersDesc")}
              rightElement={
                <Switch
                  value={settings.feedingReminders.enabled}
                  onValueChange={handleToggleFeedingReminders}
                  disabled={!hasPermission}
                />
              }
            />
            {settings.feedingReminders.enabled && (
              <SettingsRow
                label={t("settings.feedingReminderInterval")}
                description={t("settings.feedingReminderIntervalDesc")}
                value={t("settings.hoursInterval", {
                  hours: settings.feedingReminders.intervalHours,
                })}
                onPress={() => setShowIntervalPicker(!showIntervalPicker)}
                isLast={!showIntervalPicker}
              />
            )}
            {settings.feedingReminders.enabled && showIntervalPicker && (
              <View className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary">
                <View className="flex-row flex-wrap gap-2">
                  {FEEDING_REMINDER_INTERVALS.map((interval) => (
                    <Pressable
                      key={interval}
                      onPress={() => handleSelectInterval(interval)}
                      className={`px-4 py-2 rounded-full ${
                        settings.feedingReminders.intervalHours === interval
                          ? "bg-primary dark:bg-primary-dark"
                          : "bg-surface-card dark:bg-surface-dark-card"
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          settings.feedingReminders.intervalHours === interval
                            ? "text-white font-medium"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {t("settings.hoursInterval", { hours: interval })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="mb-6">
          <SectionHeader title={t("settings.timerAlerts")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <SettingsRow
              label={t("settings.timerAlerts")}
              description={t("settings.timerAlertsDesc")}
              rightElement={
                <Switch
                  value={settings.timerAlerts.enabled}
                  onValueChange={handleToggleTimerAlerts}
                  disabled={!hasPermission}
                />
              }
              isLast
            />
          </View>
        </View>

        <View className="mb-6">
          <SectionHeader title={t("settings.quietHours")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <SettingsRow
              label={t("settings.quietHours")}
              description={t("settings.quietHoursDesc")}
              rightElement={
                <Switch
                  value={settings.quietHours.enabled}
                  onValueChange={handleToggleQuietHours}
                  disabled={!hasPermission}
                />
              }
            />
            {settings.quietHours.enabled && (
              <>
                <SettingsRow
                  label={t("settings.quietHoursStartTime")}
                  value={settings.quietHours.startTime}
                />
                <SettingsRow
                  label={t("settings.quietHoursEndTime")}
                  value={settings.quietHours.endTime}
                  isLast
                />
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
