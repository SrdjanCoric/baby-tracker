import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  Switch,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/contexts/notification-context";
import { useAuth } from "@/contexts/auth-context";
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
  const { isAuthenticated } = useAuth();
  const {
    settings,
    permissionStatus,
    isLoading,
    inAppRemindersEnabled,
    activityNotificationsEnabled,
    updateSettings,
    requestPermissions,
    setInAppRemindersEnabled,
    setActivityNotificationsEnabled,
  } = useNotifications();

  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

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

  const handleToggleInAppReminders = useCallback(
    async (enabled: boolean) => {
      await setInAppRemindersEnabled(enabled);
    },
    [setInAppRemindersEnabled]
  );

  const handleToggleShowBabyName = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        // Show privacy warning when enabling
        Alert.alert(
          t("settings.privacySettings"),
          t("settings.showBabyNameDesc"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("common.enable"),
              onPress: async () => {
                await updateSettings({
                  privacy: { ...settings.privacy, showBabyName: true },
                });
              },
            },
          ]
        );
      } else {
        await updateSettings({
          privacy: { ...settings.privacy, showBabyName: false },
        });
      }
    },
    [settings.privacy, updateSettings, t]
  );

  const handleToggleShowActivityDetails = useCallback(
    async (enabled: boolean) => {
      await updateSettings({
        privacy: { ...settings.privacy, showActivityDetails: enabled },
      });
    },
    [settings.privacy, updateSettings]
  );

  const handleToggleActivityNotifications = useCallback(
    async (enabled: boolean) => {
      await setActivityNotificationsEnabled(enabled);
    },
    [setActivityNotificationsEnabled]
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
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("settings.notifications")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {!hasPermission && (
          <View className="mb-6">
            <Pressable
              onPress={handleRequestPermissions}
              className="bg-amber-100 dark:bg-amber-900/30 rounded-card p-4 mb-4"
            >
              <Text className="text-base font-medium text-amber-700 dark:text-amber-400 mb-1">
                {permissionStatus === "denied"
                  ? t("settings.permissionDenied")
                  : t("settings.permissionRequired")}
              </Text>
              <Text className="text-sm text-amber-600 dark:text-amber-300 mb-3">
                {permissionStatus === "denied"
                  ? t("settings.permissionDeniedDesc")
                  : t("settings.permissionRequiredDesc")}
              </Text>
              <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {permissionStatus === "denied"
                  ? t("settings.openSettings")
                  : t("settings.enableNotifications")}
              </Text>
            </Pressable>

            {permissionStatus === "denied" && (
              <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
                <SettingsRow
                  label={t("settings.inAppReminders")}
                  description={t("settings.inAppRemindersDesc")}
                  rightElement={
                    <Switch
                      value={inAppRemindersEnabled}
                      onValueChange={handleToggleInAppReminders}
                    />
                  }
                  isLast
                />
              </View>
            )}
          </View>
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
          <SectionHeader title={t("settings.householdActivity")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <SettingsRow
              label={t("settings.householdActivityLabel")}
              description={
                isAuthenticated
                  ? t("settings.householdActivityDesc")
                  : t("settings.householdActivitySignInRequired")
              }
              rightElement={
                <Switch
                  value={activityNotificationsEnabled}
                  onValueChange={handleToggleActivityNotifications}
                  disabled={!hasPermission || !isAuthenticated}
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

        <View className="mb-6">
          <SectionHeader title={t("settings.privacy")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <SettingsRow
              label={t("settings.showBabyName")}
              description={t("settings.showBabyNameDesc")}
              rightElement={
                <Switch
                  value={settings.privacy.showBabyName}
                  onValueChange={handleToggleShowBabyName}
                />
              }
            />
            <SettingsRow
              label={t("settings.showActivityDetails")}
              description={t("settings.showActivityDetailsDesc")}
              rightElement={
                <Switch
                  value={settings.privacy.showActivityDetails}
                  onValueChange={handleToggleShowActivityDetails}
                />
              }
              isLast
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
