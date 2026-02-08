import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  ScrollView,
  Switch,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/contexts/notification-context";
import { useAuth } from "@/contexts/auth-context";
import { useHousehold } from "@/contexts/household-context";
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
  const { isAuthenticated } = useAuth();
  const { members } = useHousehold();
  const isMultiPersonHousehold = members.length > 1;
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
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showSoloHint, setShowSoloHint] = useState(false);
  const [showFeedingHint, setShowFeedingHint] = useState(false);
  const soloHintAnim = useRef(new Animated.Value(0)).current;
  const feedingHintAnim = useRef(new Animated.Value(0)).current;

  const formatInterval = useCallback(
    (interval: number) => {
      return t("settings.hoursInterval", { hours: interval });
    },
    [t]
  );

  const parseTimeToDate = useCallback((timeString: string): Date => {
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, []);

  const handleStartTimeChange = useCallback(
    async (_event: unknown, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowStartTimePicker(false);
      }
      if (selectedTime) {
        const hours = selectedTime.getHours().toString().padStart(2, "0");
        const minutes = selectedTime.getMinutes().toString().padStart(2, "0");
        await updateSettings({
          quietHours: { ...settings.quietHours, startTime: `${hours}:${minutes}` },
        });
      }
    },
    [settings.quietHours, updateSettings]
  );

  const handleEndTimeChange = useCallback(
    async (_event: unknown, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowEndTimePicker(false);
      }
      if (selectedTime) {
        const hours = selectedTime.getHours().toString().padStart(2, "0");
        const minutes = selectedTime.getMinutes().toString().padStart(2, "0");
        await updateSettings({
          quietHours: { ...settings.quietHours, endTime: `${hours}:${minutes}` },
        });
      }
    },
    [settings.quietHours, updateSettings]
  );

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

  const handleSoloRowPress = useCallback(() => {
    const toValue = showSoloHint ? 0 : 1;
    setShowSoloHint(!showSoloHint);
    Animated.timing(soloHintAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showSoloHint, soloHintAnim]);

  const handleFeedingHintPress = useCallback(() => {
    const toValue = showFeedingHint ? 0 : 1;
    setShowFeedingHint(!showFeedingHint);
    Animated.timing(feedingHintAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showFeedingHint, feedingHintAnim]);

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
            {isAuthenticated ? (
              <>
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
                    value={formatInterval(settings.feedingReminders.intervalHours)}
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
                              ? "bg-action-primary dark:bg-action-dark-primary"
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
                            {formatInterval(interval)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View>
                <Pressable
                  onPress={handleFeedingHintPress}
                  className="flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
                >
                  <View className="flex-1">
                    <Text className="text-base text-content-primary dark:text-content-dark-primary">
                      {t("settings.feedingReminders")}
                    </Text>
                  </View>
                  <Switch
                    value={false}
                    disabled
                  />
                </Pressable>
                <Animated.View
                  style={{
                    maxHeight: feedingHintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 60],
                    }),
                    opacity: feedingHintAnim,
                    overflow: "hidden",
                  }}
                >
                  <View className="px-4 pb-3">
                    <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                      {t("settings.feedingRemindersSignInRequired")}
                    </Text>
                  </View>
                </Animated.View>
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
          <SectionHeader title={t("sleep.wakeWindowReminders")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            <SettingsRow
              label={t("sleep.wakeWindowReminders")}
              description={t("sleep.wakeWindowConfigureInSleep")}
              onPress={() => router.push("/sleep/settings")}
              isLast
            />
          </View>
        </View>

        <View className="mb-6">
          <SectionHeader title={t("settings.householdActivity")} />
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            {isAuthenticated && isMultiPersonHousehold ? (
              <SettingsRow
                label={t("settings.householdActivityLabel")}
                description={t("settings.householdActivityDesc")}
                rightElement={
                  <Switch
                    value={activityNotificationsEnabled}
                    onValueChange={handleToggleActivityNotifications}
                    disabled={!hasPermission}
                  />
                }
                isLast
              />
            ) : (
              <View>
                <Pressable
                  onPress={handleSoloRowPress}
                  className="flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
                >
                  <View className="flex-1">
                    <Text className="text-base text-content-primary dark:text-content-dark-primary">
                      {t("settings.householdActivityLabel")}
                    </Text>
                  </View>
                  <Switch
                    value={false}
                    disabled
                  />
                </Pressable>
                <Animated.View
                  style={{
                    maxHeight: soloHintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 60],
                    }),
                    opacity: soloHintAnim,
                    overflow: "hidden",
                  }}
                >
                  <View className="px-4 pb-3">
                    <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                      {!isAuthenticated
                        ? t("settings.householdActivitySignInRequired")
                        : t("settings.householdActivitySoloDesc")}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            )}
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
                  onPress={() => setShowStartTimePicker(true)}
                />
                {showStartTimePicker && (
                  <View className="px-4 py-2 bg-surface-secondary dark:bg-surface-dark-secondary">
                    {Platform.OS === "ios" && (
                      <View className="flex-row justify-end mb-2">
                        <Pressable
                          onPress={() => setShowStartTimePicker(false)}
                          className="py-1 px-2"
                        >
                          <Text className="text-primary dark:text-primary-dark font-medium">
                            {t("common.done")}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                    <DateTimePicker
                      value={parseTimeToDate(settings.quietHours.startTime)}
                      mode="time"
                      is24Hour={true}
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={handleStartTimeChange}
                    />
                  </View>
                )}
                <SettingsRow
                  label={t("settings.quietHoursEndTime")}
                  value={settings.quietHours.endTime}
                  onPress={() => setShowEndTimePicker(true)}
                  isLast={!showEndTimePicker}
                />
                {showEndTimePicker && (
                  <View className="px-4 py-2 bg-surface-secondary dark:bg-surface-dark-secondary">
                    {Platform.OS === "ios" && (
                      <View className="flex-row justify-end mb-2">
                        <Pressable
                          onPress={() => setShowEndTimePicker(false)}
                          className="py-1 px-2"
                        >
                          <Text className="text-primary dark:text-primary-dark font-medium">
                            {t("common.done")}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                    <DateTimePicker
                      value={parseTimeToDate(settings.quietHours.endTime)}
                      mode="time"
                      is24Hour={true}
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={handleEndTimeChange}
                    />
                  </View>
                )}
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
