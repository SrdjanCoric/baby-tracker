import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  Pressable,
  Text,
  View,
  TextInput,
  ScrollView,
  Switch,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSleep, useBaby, useTheme, useHousehold, useTimeFormat } from "@/contexts";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notification-context";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { formatHourValue } from "@/utils/time";
import { getPresetPillsForAge, generateSlotsForNapCount, getDefaultWakeWindowConfig } from "@/utils/sleepGoals";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_LIGHT = "#B5A7BD";
const SLEEP_PURPLE_MUTED = "#E8E4F0";
const SLEEP_PURPLE_DARK = "#574A7B";
const SLEEP_PURPLE_MUTED_DARK = "#362E42";

const QUICK_GOALS_HOURS = [11, 12, 13, 14, 15, 16];
const NAP_COUNT_OPTIONS = [1, 2, 3, 4, 5];
const NAP_CONTINUATION_OPTIONS = [10, 15, 20, 30];

export default function SleepSettingsScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { timeFormat } = useTimeFormat();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { isAuthenticated } = useAuth();
  const { members } = useHousehold();
  const isMultiCaregiver = members.length > 1;
  const {
    settings,
    permissionStatus,
    updateSettings,
    requestPermissions,
    syncWakeWindowPreferenceForBaby,
  } = useNotifications();
  const {
    dailyGoalMinutes,
    goalSource,
    currentAgeGroup,
    wakeWindowConfig,
    setCustomGoal,
    resetToAgeBasedGoal,
    setCustomWakeWindows,
    resetToAgeBasedWakeWindows,
    setNapCount: setContextNapCount,
    setDayNightBoundary,
    setNapContinuationMinutes: setContextNapContinuation,
  } = useSleep();

  const currentGoalHours = dailyGoalMinutes / 60;
  const [customHours, setCustomHours] = useState(currentGoalHours.toString());
  const [isSettingCustom, setIsSettingCustom] = useState(false);
  const [expandedSlotIndex, setExpandedSlotIndex] = useState<number | null>(null);
  const [customDurationInput, setCustomDurationInput] = useState("");
  const [durationError, setDurationError] = useState("");
  const [showReminderHint, setShowReminderHint] = useState(false);
  const reminderHintAnim = useRef(new Animated.Value(0)).current;

  const dayStartHour = wakeWindowConfig?.dayStartHour ?? 6;
  const dayEndHour = wakeWindowConfig?.dayEndHour ?? 19;
  const napContinuationMinutes = wakeWindowConfig?.napContinuationMinutes ?? 15;

  const confirmHouseholdChange = useCallback(
    (onConfirm: () => void, options?: { title?: string; message?: string }) => {
      if (!isMultiCaregiver) {
        onConfirm();
        return;
      }
      Alert.alert(
        options?.title ?? t("sleep.householdSettingsTitle"),
        options?.message ?? t("sleep.householdSettingsConfirm"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: onConfirm },
        ]
      );
    },
    [isMultiCaregiver, t]
  );

  const hasPermission = permissionStatus === "granted";
  const hasBirthDate = !!selectedBaby?.birthDate;
  const birthDate = selectedBaby?.birthDate ? new Date(selectedBaby.birthDate) : undefined;
  const presetPills = birthDate ? getPresetPillsForAge(birthDate) : [60, 90, 120, 150, 180];

  const goalConfirmOptions = {
    title: t("sleep.householdGoalTitle"),
    message: t("sleep.householdGoalConfirm"),
  };

  const handleSelectQuickGoal = useCallback(
    (hours: number) => {
      confirmHouseholdChange(async () => {
        await setCustomGoal(hours * 60);
      }, goalConfirmOptions);
    },
    [setCustomGoal, confirmHouseholdChange, goalConfirmOptions]
  );

  const handleUseAgeBased = useCallback(() => {
    confirmHouseholdChange(async () => {
      await resetToAgeBasedGoal();
    }, goalConfirmOptions);
  }, [resetToAgeBasedGoal, confirmHouseholdChange, goalConfirmOptions]);

  const handleSetCustomGoal = useCallback(() => {
    const hours = parseFloat(customHours);
    if (isNaN(hours) || hours < 8 || hours > 20) {
      return;
    }
    confirmHouseholdChange(async () => {
      await setCustomGoal(hours * 60);
      setIsSettingCustom(false);
    }, goalConfirmOptions);
  }, [customHours, setCustomGoal, confirmHouseholdChange, goalConfirmOptions]);

  const formatGoalDisplay = (minutes: number) => {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) {
      return `${hours} hours`;
    }
    return `${hours.toFixed(1)} hours`;
  };

  const handleToggleReminders = useCallback(
    async (enabled: boolean) => {
      if (enabled && permissionStatus !== "granted") {
        const granted = await requestPermissions();
        if (!granted) return;
      }
      await updateSettings({
        wakeWindowReminders: { ...settings.wakeWindowReminders, enabled },
      });
      if (selectedBaby?.id && wakeWindowConfig) {
        await syncWakeWindowPreferenceForBaby(
          selectedBaby.id,
          wakeWindowConfig.napCount,
          wakeWindowConfig.slots,
          wakeWindowConfig.source,
          enabled,
          wakeWindowConfig.dayStartHour,
          wakeWindowConfig.dayEndHour,
          wakeWindowConfig.napContinuationMinutes
        );
      }
    },
    [settings.wakeWindowReminders, updateSettings, permissionStatus, requestPermissions, selectedBaby?.id, wakeWindowConfig, syncWakeWindowPreferenceForBaby]
  );

  const handleSelectNapCount = useCallback(
    (count: number) => {
      confirmHouseholdChange(async () => {
        await setContextNapCount(count);
        if (selectedBaby?.id && selectedBaby?.birthDate) {
          const newSlots = generateSlotsForNapCount(count, new Date(selectedBaby.birthDate));
          await syncWakeWindowPreferenceForBaby(
            selectedBaby.id,
            count,
            newSlots,
            "age_based",
            settings.wakeWindowReminders.enabled,
            dayStartHour,
            dayEndHour,
            napContinuationMinutes
          );
        }
      });
    },
    [confirmHouseholdChange, setContextNapCount, selectedBaby?.id, selectedBaby?.birthDate, syncWakeWindowPreferenceForBaby, settings.wakeWindowReminders.enabled, dayStartHour, dayEndHour, napContinuationMinutes]
  );

  const handleSlotDurationChange = useCallback(
    (slotIndex: number, durationMinutes: number) => {
      if (!wakeWindowConfig || !selectedBaby?.id) return;
      confirmHouseholdChange(async () => {
        const updatedSlots = wakeWindowConfig.slots.map(slot =>
          slot.slotIndex === slotIndex
            ? { ...slot, durationMinutes }
            : slot
        );
        await setCustomWakeWindows(updatedSlots);
        setExpandedSlotIndex(null);
        await syncWakeWindowPreferenceForBaby(
          selectedBaby.id,
          wakeWindowConfig.napCount,
          updatedSlots,
          "custom",
          settings.wakeWindowReminders.enabled,
          dayStartHour,
          dayEndHour,
          napContinuationMinutes
        );
      });
    },
    [confirmHouseholdChange, wakeWindowConfig, setCustomWakeWindows, selectedBaby?.id, syncWakeWindowPreferenceForBaby, settings.wakeWindowReminders.enabled, dayStartHour, dayEndHour, napContinuationMinutes]
  );

  const handleCustomDuration = useCallback(
    async (slotIndex: number) => {
      setDurationError("");
      const minutes = parseInt(customDurationInput, 10);
      const minMinutes = __DEV__ ? 1 : 15;
      if (isNaN(minutes) || minutes < minMinutes || minutes > 480) {
        setDurationError(t("sleep.customMinutesError", { min: minMinutes }));
        return;
      }
      await handleSlotDurationChange(slotIndex, minutes);
      setCustomDurationInput("");
      Keyboard.dismiss();
    },
    [customDurationInput, handleSlotDurationChange, t]
  );

  const handleResetWakeWindows = useCallback(() => {
    confirmHouseholdChange(async () => {
      await resetToAgeBasedWakeWindows();
      if (selectedBaby?.id && selectedBaby?.birthDate) {
        const defaultConfig = getDefaultWakeWindowConfig(new Date(selectedBaby.birthDate));
        await syncWakeWindowPreferenceForBaby(
          selectedBaby.id,
          defaultConfig.napCount,
          defaultConfig.slots,
          defaultConfig.source,
          settings.wakeWindowReminders.enabled,
          defaultConfig.dayStartHour,
          defaultConfig.dayEndHour,
          defaultConfig.napContinuationMinutes
        );
      }
    });
  }, [confirmHouseholdChange, resetToAgeBasedWakeWindows, selectedBaby?.id, selectedBaby?.birthDate, syncWakeWindowPreferenceForBaby, settings.wakeWindowReminders.enabled]);

  const handleReminderHintPress = useCallback(() => {
    const toValue = showReminderHint ? 0 : 1;
    setShowReminderHint(!showReminderHint);
    Animated.timing(reminderHintAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [showReminderHint, reminderHintAnim]);

  const handleRequestPermissions = useCallback(async () => {
    if (permissionStatus === "denied") {
      await Linking.openSettings();
    } else {
      await requestPermissions();
    }
  }, [permissionStatus, requestPermissions]);

  const formatHour = (hour: number) => formatHourValue(hour, timeFormat);

  const handleDayStartPickerChange = useCallback(async (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    const hour = selectedDate.getHours();
    if (hour >= dayEndHour) return;
    await setDayNightBoundary(hour, dayEndHour);
    if (selectedBaby?.id && wakeWindowConfig) {
      await syncWakeWindowPreferenceForBaby(
        selectedBaby.id,
        wakeWindowConfig.napCount,
        wakeWindowConfig.slots,
        wakeWindowConfig.source,
        settings.wakeWindowReminders.enabled,
        hour,
        dayEndHour,
        napContinuationMinutes
      );
    }
  }, [setDayNightBoundary, dayEndHour, selectedBaby?.id, wakeWindowConfig, syncWakeWindowPreferenceForBaby, settings.wakeWindowReminders.enabled, napContinuationMinutes]);

  const handleNightStartPickerChange = useCallback(async (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    const hour = selectedDate.getHours();
    if (hour <= dayStartHour) return;
    await setDayNightBoundary(dayStartHour, hour);
    if (selectedBaby?.id && wakeWindowConfig) {
      await syncWakeWindowPreferenceForBaby(
        selectedBaby.id,
        wakeWindowConfig.napCount,
        wakeWindowConfig.slots,
        wakeWindowConfig.source,
        settings.wakeWindowReminders.enabled,
        dayStartHour,
        hour,
        napContinuationMinutes
      );
    }
  }, [setDayNightBoundary, dayStartHour, selectedBaby?.id, wakeWindowConfig, syncWakeWindowPreferenceForBaby, settings.wakeWindowReminders.enabled, napContinuationMinutes]);

  const handleNapContinuationChange = useCallback((minutes: number) => {
    confirmHouseholdChange(async () => {
      await setContextNapContinuation(minutes);
      if (selectedBaby?.id && wakeWindowConfig) {
        await syncWakeWindowPreferenceForBaby(
          selectedBaby.id,
          wakeWindowConfig.napCount,
          wakeWindowConfig.slots,
          wakeWindowConfig.source,
          settings.wakeWindowReminders.enabled,
          dayStartHour,
          dayEndHour,
          minutes
        );
      }
    });
  }, [confirmHouseholdChange, setContextNapContinuation, selectedBaby?.id, wakeWindowConfig, syncWakeWindowPreferenceForBaby, settings.wakeWindowReminders.enabled, dayStartHour, dayEndHour]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle"
        testID="dismiss-keyboard"
      >
        <View className={`w-10 h-1 rounded-full mb-2 ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("sleep.settingsTitle")}
        </Text>
      </Pressable>

      <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
        {/* Current Goal Display */}
        <View
          className="rounded-card p-4 mb-6"
          style={{ backgroundColor: isDark ? SLEEP_PURPLE_MUTED_DARK : SLEEP_PURPLE_MUTED }}
        >
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
            {t("sleep.currentGoal")}
          </Text>
          <Text
            className="text-3xl font-bold mb-2"
            style={{ color: isDark ? SLEEP_PURPLE_LIGHT : SLEEP_PURPLE }}
          >
            {formatGoalDisplay(dailyGoalMinutes)}
          </Text>
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
            {goalSource === "custom"
              ? t("sleep.customGoalNote")
              : currentAgeGroup
                ? t("sleep.basedOnGuidelines", {
                    ageGroup: currentAgeGroup.label,
                  })
                : t("sleep.ageBasedGoal")}
          </Text>
        </View>

        {/* Age Group Info */}
        {currentAgeGroup && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
              {t("sleep.ageGroup")}
            </Text>
            <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4">
              <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-1">
                {currentAgeGroup.label}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {t("sleep.recommendedRange", {
                  min: currentAgeGroup.totalSleepHoursMin,
                  max: currentAgeGroup.totalSleepHoursMax,
                })}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
                {t("sleep.napsPerDay", {
                  min: currentAgeGroup.napsMin,
                  max: currentAgeGroup.napsMax,
                })}
              </Text>
            </View>
          </View>
        )}

        {/* Quick Goal Selection */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("sleep.quickGoals")}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_GOALS_HOURS.map((hours) => {
              const isSelected = dailyGoalMinutes === hours * 60;
              return (
                <Pressable
                  key={hours}
                  onPress={() => handleSelectQuickGoal(hours)}
                  className={`px-5 py-3 rounded-button-lg ${
                    isSelected
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  } active:opacity-80`}
                  style={isSelected ? { backgroundColor: SLEEP_PURPLE } : undefined}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    className={`text-base font-medium ${
                      isSelected
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    {t("sleep.goalHours", { hours })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom Goal Input */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("sleep.customHours")}
          </Text>
          <View className="flex-row items-center gap-3">
            <TextInput
              value={customHours}
              onChangeText={setCustomHours}
              onFocus={() => setIsSettingCustom(true)}
              keyboardType="decimal-pad"
              maxLength={4}
              className="flex-1 bg-surface-secondary dark:bg-surface-dark-secondary rounded-input px-4 py-3 text-lg text-content-primary dark:text-content-dark-primary"
              accessibilityLabel={t("sleep.customHours")}
            />
            <Pressable
              onPress={handleSetCustomGoal}
              disabled={!isSettingCustom}
              className={`px-6 py-3 rounded-button-lg ${
                isSettingCustom ? "" : "opacity-50"
              }`}
              style={{ backgroundColor: SLEEP_PURPLE }}
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-white">
                {t("common.save")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Use Age-Based Goal Button */}
        {goalSource === "custom" && currentAgeGroup && (
          <Pressable
            onPress={handleUseAgeBased}
            className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 active:opacity-80 mb-6"
            accessibilityRole="button"
          >
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-1">
              {t("sleep.useAgeBasedGoal")}
            </Text>
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
              {t("sleep.recommendedRange", {
                min: currentAgeGroup.totalSleepHoursMin,
                max: currentAgeGroup.totalSleepHoursMax,
              })}
            </Text>
          </Pressable>
        )}

        {hasBirthDate && (
          <>
            {/* Divider */}
            <View className="h-px bg-border-subtle dark:bg-border-dark-subtle mb-6" />

            {/* Day & Night Hours */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
                {t("sleep.dayNightBoundary")}
              </Text>

              <View className="flex-row h-2 rounded-full overflow-hidden mb-4">
                <View
                  style={{
                    flex: dayStartHour,
                    backgroundColor: isDark ? SLEEP_PURPLE_DARK : SLEEP_PURPLE,
                  }}
                />
                <View
                  style={{
                    flex: dayEndHour - dayStartHour,
                    backgroundColor: isDark ? SLEEP_PURPLE_LIGHT : SLEEP_PURPLE_MUTED,
                  }}
                />
                <View
                  style={{
                    flex: 24 - dayEndHour,
                    backgroundColor: isDark ? SLEEP_PURPLE_DARK : SLEEP_PURPLE,
                  }}
                />
              </View>

              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Text className="text-base mr-2">{"\u2600\uFE0F"}</Text>
                  <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                    {t("sleep.dayStartsAt")}
                  </Text>
                </View>
                <DateTimePicker
                  value={(() => { const d = new Date(); d.setHours(dayStartHour, 0, 0, 0); return d; })()}
                  mode="time"
                  display="compact"
                  onChange={handleDayStartPickerChange}
                  style={{ alignSelf: "flex-start" }}
                />
              </View>

              <View className="mb-3">
                <View className="flex-row items-center mb-2">
                  <Text className="text-base mr-2">{"\uD83C\uDF19"}</Text>
                  <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                    {t("sleep.nightStartsAt")}
                  </Text>
                </View>
                <DateTimePicker
                  value={(() => { const d = new Date(); d.setHours(dayEndHour, 0, 0, 0); return d; })()}
                  mode="time"
                  display="compact"
                  onChange={handleNightStartPickerChange}
                  style={{ alignSelf: "flex-start" }}
                />
              </View>

              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                {t("sleep.dayNightExplainer")}
              </Text>
            </View>

            {/* Nap Continuation */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
                {t("sleep.napContinuation")}
              </Text>
              <View className="flex-row gap-2 mb-3">
                {NAP_CONTINUATION_OPTIONS.map((minutes) => {
                  const isSelected = napContinuationMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => handleNapContinuationChange(minutes)}
                      className={`flex-1 py-3 items-center rounded-button-lg ${
                        isSelected ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      } active:opacity-80`}
                      style={isSelected ? { backgroundColor: SLEEP_PURPLE } : undefined}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          isSelected
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {`${minutes}m`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                {t("sleep.napContinuationDesc")}
              </Text>
            </View>
          </>
        )}

        {/* Divider before reminders section */}
        <View className="h-px bg-border-subtle dark:bg-border-dark-subtle mb-6" />

        {/* Section A: Nap Reminder Toggle */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
            {t("sleep.wakeWindowReminders")}
          </Text>

          {!hasPermission && (
            <Pressable
              onPress={handleRequestPermissions}
              className="bg-amber-100 dark:bg-amber-900/30 rounded-card p-4 mb-3"
            >
              <Text className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                {permissionStatus === "denied"
                  ? t("settings.permissionDenied")
                  : t("settings.permissionRequired")}
              </Text>
              <Text className="text-xs text-amber-600 dark:text-amber-300">
                {permissionStatus === "denied"
                  ? t("settings.permissionDeniedDesc")
                  : t("settings.permissionRequiredDesc")}
              </Text>
            </Pressable>
          )}

          <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
            {isAuthenticated ? (
              <View className="flex-row items-center py-4 px-4">
                <View className="flex-1">
                  <Text className="text-base text-content-primary dark:text-content-dark-primary">
                    {t("sleep.napReminders")}
                  </Text>
                  <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
                    {t("sleep.napRemindersDesc")}
                  </Text>
                </View>
                <Switch
                  value={settings.wakeWindowReminders.enabled}
                  onValueChange={handleToggleReminders}
                  disabled={!hasBirthDate}
                />
              </View>
            ) : (
              <View>
                <Pressable
                  onPress={handleReminderHintPress}
                  className="flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
                >
                  <View className="flex-1">
                    <Text className="text-base text-content-primary dark:text-content-dark-primary">
                      {t("sleep.napReminders")}
                    </Text>
                  </View>
                  <Switch value={false} disabled />
                </Pressable>
                <Animated.View
                  style={{
                    maxHeight: reminderHintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 60],
                    }),
                    opacity: reminderHintAnim,
                    overflow: "hidden",
                  }}
                >
                  <View className="px-4 pb-3">
                    <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                      {t("sleep.napRemindersSignInRequired")}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            )}
          </View>
        </View>

        {settings.wakeWindowReminders.enabled && isMultiCaregiver && (
          <View className="bg-blue-50 dark:bg-blue-900/20 rounded-card p-4 mb-6">
            <Text className="text-sm text-blue-700 dark:text-blue-300">
              {t("sleep.wakeWindowHouseholdWarning")}
            </Text>
          </View>
        )}

        {/* Birthdate prompt (when no birthdate) */}
        {!hasBirthDate && (
          <View
            className="rounded-card p-4 mb-6"
            style={{ backgroundColor: isDark ? SLEEP_PURPLE_MUTED_DARK : SLEEP_PURPLE_MUTED }}
          >
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-3">
              {t("sleep.setBirthDatePrompt")}
            </Text>
            <Pressable
              onPress={() => router.push(`/baby/${selectedBaby.id}`)}
              className="py-3 px-4 rounded-button-lg items-center active:opacity-80"
              style={{ backgroundColor: SLEEP_PURPLE }}
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-white">
                {t("sleep.setBirthDate")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Section B: Nap Count Selector */}
        {settings.wakeWindowReminders.enabled && wakeWindowConfig && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
              {t("sleep.napCount")}
            </Text>
            {currentAgeGroup && (
              <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-3 mb-3">
                <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                  {t("sleep.napCountRecommendation", {
                    min: currentAgeGroup.napsMin,
                    max: currentAgeGroup.napsMax,
                    ageGroup: currentAgeGroup.label,
                  })}
                </Text>
              </View>
            )}
            <View className="flex-row gap-2">
              {NAP_COUNT_OPTIONS.map((count) => {
                const isSelected = wakeWindowConfig.napCount === count;
                return (
                  <Pressable
                    key={count}
                    onPress={() => handleSelectNapCount(count)}
                    className={`flex-1 py-3 items-center rounded-button-lg ${
                      isSelected ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                    } active:opacity-80`}
                    style={isSelected ? { backgroundColor: SLEEP_PURPLE } : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      className={`text-base font-medium ${
                        isSelected ? "text-white" : "text-content-primary dark:text-content-dark-primary"
                      }`}
                    >
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Educational Info Card */}
        {settings.wakeWindowReminders.enabled && currentAgeGroup && wakeWindowConfig && (
          <View
            className="rounded-card p-4 mb-6"
            style={{ backgroundColor: isDark ? SLEEP_PURPLE_MUTED_DARK : SLEEP_PURPLE_MUTED }}
          >
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
              {t("sleep.wakeWindowExplainer")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {t("sleep.wakeWindowGuidelines", {
                ageGroup: currentAgeGroup.label,
                min: currentAgeGroup.wakeWindowMinMinutes,
                max: currentAgeGroup.wakeWindowMaxMinutes,
              })}
            </Text>
          </View>
        )}

        {/* Section C: Wake Window Slots */}
        {settings.wakeWindowReminders.enabled && wakeWindowConfig && wakeWindowConfig.slots.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-3">
              {t("sleep.wakeWindows")}
            </Text>
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-card">
              {wakeWindowConfig.slots.map((slot, index) => {
                const isExpanded = expandedSlotIndex === slot.slotIndex;
                const isLast = index === wakeWindowConfig.slots.length - 1;
                const isBedtime = slot.label === "bedtime";
                const icon = isBedtime ? "\u{1F319}" : "\u{2600}\u{FE0F}";

                return (
                  <View key={slot.slotIndex}>
                    <Pressable
                      onPress={() => setExpandedSlotIndex(isExpanded ? null : slot.slotIndex)}
                      className={`flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary ${
                        !isLast && !isExpanded ? "border-b border-border-subtle dark:border-border-dark-subtle" : ""
                      }`}
                    >
                      <Text className="text-lg mr-3">{icon}</Text>
                      <View className="flex-1">
                        <Text className="text-base text-content-primary dark:text-content-dark-primary">
                          {isBedtime
                            ? t("sleep.slotBedtime")
                            : t("sleep.slotNap", { number: slot.slotIndex + 1 })}
                        </Text>
                      </View>
                      <Text className="text-base font-medium" style={{ color: isDark ? SLEEP_PURPLE_LIGHT : SLEEP_PURPLE }}>
                        {formatDuration(slot.durationMinutes)}
                      </Text>
                      <Text className="text-content-tertiary dark:text-content-dark-tertiary ml-2">
                        {isExpanded ? "\u{25B2}" : "\u{25BC}"}
                      </Text>
                    </Pressable>

                    {isExpanded && (
                      <View className={`px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary ${
                        !isLast ? "border-b border-border-subtle dark:border-border-dark-subtle" : ""
                      }`}>
                        <View className="flex-row flex-wrap gap-2 mb-3">
                          {presetPills.map((preset) => {
                            const isPresetSelected = slot.durationMinutes === preset;
                            return (
                              <Pressable
                                key={preset}
                                onPress={() => handleSlotDurationChange(slot.slotIndex, preset)}
                                className={`px-4 py-2 rounded-full ${
                                  isPresetSelected ? "" : "bg-surface-card dark:bg-surface-dark-card"
                                }`}
                                style={isPresetSelected ? { backgroundColor: SLEEP_PURPLE } : undefined}
                              >
                                <Text
                                  className={`text-sm ${
                                    isPresetSelected ? "text-white font-medium" : "text-content-primary dark:text-content-dark-primary"
                                  }`}
                                >
                                  {formatDuration(preset)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View className="flex-row items-center gap-2">
                          <TextInput
                            value={customDurationInput}
                            onChangeText={(text) => { setCustomDurationInput(text); setDurationError(""); }}
                            keyboardType="number-pad"
                            maxLength={3}
                            placeholder={t("sleep.customMinutes")}
                            className="flex-1 bg-surface-card dark:bg-surface-dark-card rounded-input px-3 py-2 text-sm text-content-primary dark:text-content-dark-primary"
                          />
                          <Pressable
                            onPress={() => handleCustomDuration(slot.slotIndex)}
                            className="px-4 py-2 rounded-button-lg"
                            style={{ backgroundColor: SLEEP_PURPLE }}
                          >
                            <Text className="text-sm font-medium text-white">
                              {t("common.save")}
                            </Text>
                          </Pressable>
                        </View>
                        {durationError ? (
                          <Text className="text-xs text-red-500 mt-1">{durationError}</Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Section D: Reset to Defaults */}
        {settings.wakeWindowReminders.enabled && wakeWindowConfig?.source === "custom" && (
          <Pressable
            onPress={handleResetWakeWindows}
            className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 active:opacity-80 mb-6"
            accessibilityRole="button"
          >
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-1">
              {t("sleep.resetWakeWindows")}
            </Text>
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
              {t("sleep.resetWakeWindowsDesc")}
            </Text>
          </Pressable>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
