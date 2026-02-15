import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSleep } from "@/contexts";
import { useBaby } from "@/contexts";
import { formatDuration } from "@/utils/time";
import { useTimerAlertIntegration } from "@/hooks";
import type { SleepType } from "@/constants/activities";
import { determineSleepType } from "@/validators/sleep";
import { SleepMilestoneSuggestionModal, NoBabyScreen } from "@/components";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";
const SLEEP_PURPLE_DARK = "#574A7B";
const PAUSED_AMBER = "#D4A017";

export default function SleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const {
    activeTimer,
    startSleep,
    stopSleep,
    changeSleepType,
    pauseSleep,
    resumeSleep,
    dailyGoalMinutes,
    currentAgeGroup,
    showMilestoneSuggestion,
    suggestedGoalMinutes,
    acceptMilestoneSuggestion,
    dismissMilestoneSuggestion,
    wakeWindowConfig,
  } = useSleep();

  const napAlert = useTimerAlertIntegration("nap");
  const nightSleepAlert = useTimerAlertIntegration("nightSleep");

  const getAlertForType = useCallback((sleepType: SleepType | undefined) => {
    return sleepType === "night" ? nightSleepAlert : napAlert;
  }, [napAlert, nightSleepAlert]);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeTimer?.isRunning || activeTimer?.isPaused) {
      return;
    }

    const interval = setInterval(() => {
      setTick(t => t + 1);

      const now = new Date();
      const elapsedMinutes = Math.floor(
        (now.getTime() - activeTimer.startTime.getTime() - activeTimer.totalPausedMs) / 1000 / 60
      );
      const alert = getAlertForType(activeTimer.sleepType);
      alert.checkAndSendAlert(elapsedMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isRunning, activeTimer?.isPaused, activeTimer?.startTime, activeTimer?.totalPausedMs, activeTimer?.sleepType, getAlertForType]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer?.isRunning) {
      return 0;
    }
    void tick;
    if (activeTimer.isPaused && activeTimer.pausedAt) {
      return Math.floor(
        (activeTimer.pausedAt.getTime() - activeTimer.startTime.getTime() - activeTimer.totalPausedMs) / 1000
      );
    }
    const now = new Date();
    return Math.floor((now.getTime() - activeTimer.startTime.getTime() - activeTimer.totalPausedMs) / 1000);
  }, [activeTimer, tick]);

  const suggestedType = useMemo(() => {
    return determineSleepType(new Date(), wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour);
  }, [wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour]);

  const handleStartSleep = useCallback(async (sleepType: SleepType, customStartTime?: Date) => {
    await startSleep(sleepType, customStartTime);
  }, [startSleep]);

  const handleStopSleep = useCallback(async () => {
    napAlert.resetAlert();
    nightSleepAlert.resetAlert();
    await stopSleep();
    router.back();
  }, [napAlert, nightSleepAlert, stopSleep, router]);

  const handleTypeChange = useCallback((sleepType: SleepType) => {
    changeSleepType(sleepType);
  }, [changeSleepType]);

  const handlePause = useCallback(async () => {
    await pauseSleep();
  }, [pauseSleep]);

  const handleResume = useCallback(async () => {
    await resumeSleep();
  }, [resumeSleep]);

  const handleLogPastSleep = useCallback(() => {
    router.push("/sleep/manual");
  }, [router]);

  const handleSettings = useCallback(() => {
    router.push("/sleep/settings");
  }, [router]);

  const handleAcceptMilestone = useCallback(async () => {
    await acceptMilestoneSuggestion();
  }, [acceptMilestoneSuggestion]);

  const handleDismissMilestone = useCallback(async () => {
    await dismissMilestoneSuggestion(true);
  }, [dismissMilestoneSuggestion]);

  const handleKeepCurrentGoal = useCallback(async () => {
    await dismissMilestoneSuggestion(false);
  }, [dismissMilestoneSuggestion]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  const isTimerRunning = activeTimer?.isRunning ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="sleep-screen">
      {/* Header with drag handle */}
      <View className="items-center pt-2 pb-3">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <View className="flex-row items-center w-full px-4">
          <View className="w-touch" />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
              {t("sleep.title")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {selectedBaby.name}
            </Text>
          </View>
          <Pressable
            onPress={handleSettings}
            className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
            accessibilityRole="button"
            accessibilityLabel={t("sleep.goalSettings")}
            testID="settings-button"
          >
            <Text className="text-xl">⚙️</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {isTimerRunning ? (
          <RunningTimerView
            elapsedSeconds={elapsedSeconds}
            sleepType={activeTimer?.sleepType ?? "nap"}
            isPaused={activeTimer?.isPaused ?? false}
            onTypeChange={handleTypeChange}
            onStop={handleStopSleep}
            onPause={handlePause}
            onResume={handleResume}
          />
        ) : (
          <SleepTypeSelectionView
            suggestedType={suggestedType}
            onSelectType={handleStartSleep}
            onLogPastSleep={handleLogPastSleep}
          />
        )}
      </View>

      <SleepMilestoneSuggestionModal
        visible={showMilestoneSuggestion}
        currentGoalMinutes={dailyGoalMinutes}
        suggestedGoalMinutes={suggestedGoalMinutes ?? dailyGoalMinutes}
        ageGroupLabel={currentAgeGroup?.label ?? ""}
        onAccept={handleAcceptMilestone}
        onDismiss={handleDismissMilestone}
        onKeepCurrent={handleKeepCurrentGoal}
      />
    </SafeAreaView>
  );
}

interface SleepTypeSelectionViewProps {
  suggestedType: SleepType;
  onSelectType: (sleepType: SleepType, customStartTime?: Date) => void;
  onLogPastSleep: () => void;
}

function SleepTypeSelectionView({ suggestedType, onSelectType, onLogPastSleep }: SleepTypeSelectionViewProps) {
  const { t } = useTranslation();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customStartTime, setCustomStartTime] = useState<Date | null>(null);

  const handleTypePress = useCallback((type: SleepType) => {
    if (customStartTime) {
      onSelectType(type, customStartTime);
    } else {
      onSelectType(type);
    }
  }, [customStartTime, onSelectType]);

  const handleStartedEarlierPress = useCallback(() => {
    setShowTimePicker(true);
  }, []);

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      if (selectedTime) {
        const now = new Date();
        const clampedTime = selectedTime > now ? now : selectedTime;
        setCustomStartTime(clampedTime);
      }
    },
    []
  );

  // Start of yesterday (midnight)
  const yesterdayStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const handleTimeDone = useCallback(() => {
    setShowTimePicker(false);
  }, []);

  const handleClearCustomTime = useCallback(() => {
    setCustomStartTime(null);
  }, []);

  const formatCustomTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <View className="items-center w-full">
      {/* Illustration/Icon */}
      <View
        className="w-32 h-32 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
      >
        <Text className="text-6xl">😴</Text>
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
        {t("sleep.startSleep")}
      </Text>
      <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-6 text-center">
        {t("sleep.selectTypeToStart")}
      </Text>

      {/* Started Earlier Button */}
      {!customStartTime ? (
        <Pressable
          onPress={handleStartedEarlierPress}
          className="mb-6 py-3 px-5 rounded-full flex-row items-center border-2"
          style={{ borderColor: SLEEP_PURPLE, backgroundColor: 'transparent' }}
          accessibilityRole="button"
          accessibilityLabel={t("sleep.startedEarlier")}
        >
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium" style={{ color: SLEEP_PURPLE }}>
            {t("sleep.startedEarlier")}
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row items-center mb-6 py-3 px-5 rounded-full" style={{ backgroundColor: SLEEP_PURPLE_MUTED }}>
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium mr-2" style={{ color: SLEEP_PURPLE_DARK }}>
            {t("sleep.startTime")}: {formatCustomTime(customStartTime)}
          </Text>
          <Pressable
            onPress={handleClearCustomTime}
            className="ml-2"
            accessibilityRole="button"
            accessibilityLabel={t("common.reset")}
          >
            <Text style={{ color: SLEEP_PURPLE }}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Sleep Type Selection Buttons */}
      <View className="flex-row gap-4 mb-6 w-full">
        <SleepTypeButton
          type="nap"
          label={t("sleep.nap")}
          icon="💤"
          isSuggested={suggestedType === "nap"}
          onPress={() => handleTypePress("nap")}
        />
        <SleepTypeButton
          type="night"
          label={t("sleep.night")}
          icon="🌙"
          isSuggested={suggestedType === "night"}
          onPress={() => handleTypePress("night")}
        />
      </View>

      {/* Suggestion hint */}
      <View className="flex-row items-center mt-8">
        <View
          className="w-2 h-2 rounded-full mr-2"
          style={{ backgroundColor: SLEEP_PURPLE }}
        />
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
          {t("sleep.autoDetectHint")}
        </Text>
      </View>

      {/* Log Past Sleep Link */}
      <Pressable
        onPress={onLogPastSleep}
        className="mt-8 py-3 px-6 rounded-button-lg active:opacity-70"
        style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
        accessibilityRole="button"
        accessibilityLabel={t("sleep.logPastSleep")}
      >
        <Text className="text-base font-medium" style={{ color: SLEEP_PURPLE }}>
          {t("sleep.logPastSleep")}
        </Text>
      </Pressable>

      {/* Time Picker */}
      {showTimePicker && (
        <View className="absolute bottom-0 left-0 right-0 bg-surface dark:bg-surface-dark">
          {Platform.OS === "ios" && (
            <View className="flex-row justify-end px-4 py-2 border-t border-border dark:border-border-dark">
              <Pressable
                onPress={handleTimeDone}
                className="py-2 px-4"
                accessibilityRole="button"
                accessibilityLabel={t("common.done")}
              >
                <Text className="font-semibold" style={{ color: SLEEP_PURPLE }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          )}
          <DateTimePicker
            value={customStartTime ?? new Date()}
            mode="datetime"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
            minimumDate={yesterdayStart}
            maximumDate={new Date()}
          />
        </View>
      )}
    </View>
  );
}

interface SleepTypeButtonProps {
  type: SleepType;
  label: string;
  icon: string;
  isSuggested: boolean;
  onPress: () => void;
}

function SleepTypeButton({ type, label, icon, isSuggested, onPress }: SleepTypeButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-6 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSuggested ? SLEEP_PURPLE : SLEEP_PURPLE_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
      testID={`type-${type}`}
    >
      {/* Icon */}
      <Text className="text-4xl mb-2">
        {icon}
      </Text>

      {/* Label */}
      <Text
        className="text-base font-medium mb-1"
        style={{ color: isSuggested ? "#FFFFFF" : SLEEP_PURPLE_DARK }}
      >
        {label}
      </Text>

      {/* Suggested badge */}
      {isSuggested && (
        <View className="bg-white/20 px-3 py-1 rounded-pill mt-2">
          <Text className="text-xs font-semibold text-white">
            {t("feeding.suggested")}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface RunningTimerViewProps {
  elapsedSeconds: number;
  sleepType: SleepType;
  isPaused: boolean;
  onTypeChange: (sleepType: SleepType) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

function RunningTimerView({
  elapsedSeconds,
  sleepType,
  isPaused,
  onTypeChange,
  onStop,
  onPause,
  onResume,
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="items-center w-full">
      <View className="flex-row items-center mb-4">
        <Text className="text-4xl mr-3">😴</Text>
        <Text style={{ color: SLEEP_PURPLE }} className="text-lg font-semibold">
          {t("sleep.sleeping")}
        </Text>
      </View>

      <View
        className="flex-row rounded-pill p-1 mb-8"
        style={{ backgroundColor: SLEEP_PURPLE_MUTED, opacity: isPaused ? 0.4 : 1 }}
        pointerEvents={isPaused ? "none" : "auto"}
      >
        <CompactTypeButton
          label="💤"
          fullLabel={t("sleep.nap")}
          isSelected={sleepType === "nap"}
          onPress={() => onTypeChange("nap")}
        />
        <CompactTypeButton
          label="🌙"
          fullLabel={t("sleep.night")}
          isSelected={sleepType === "night"}
          onPress={() => onTypeChange("night")}
        />
      </View>

      <View
        className="px-12 py-8 rounded-card-lg mb-8"
        style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
      >
        <Text
          className="text-timer-xl text-center font-bold tracking-tight"
          style={{ color: isPaused ? PAUSED_AMBER : SLEEP_PURPLE, opacity: isPaused ? 0.5 : 1 }}
          accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
        >
          {formattedTime}
        </Text>
      </View>

      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: isPaused ? PAUSED_AMBER : SLEEP_PURPLE }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {isPaused ? t("common.timerPaused") : t("sleep.timerRunning")}
        </Text>
      </View>

      <View className="flex-row items-center gap-6">
        <Pressable
          onPress={isPaused ? onResume : onPause}
          className="w-16 h-16 rounded-full items-center justify-center active:scale-95 border-2"
          style={{ borderColor: SLEEP_PURPLE, backgroundColor: isPaused ? SLEEP_PURPLE : "transparent" }}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? t("common.resumeTimer") : t("common.pauseTimer")}
        >
          <Text className="text-2xl" style={{ color: isPaused ? "#FFFFFF" : SLEEP_PURPLE }}>
            {isPaused ? "▶" : "⏸"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: SLEEP_PURPLE }}
          accessibilityRole="button"
          accessibilityLabel={t("sleep.wakeUp")}
          testID="stop-timer-button"
        >
          <Text className="text-3xl text-white">⏹</Text>
        </Pressable>
      </View>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
        {isPaused ? t("common.tapToResume") : t("sleep.tapToStop")}
      </Text>
    </View>
  );
}

interface CompactTypeButtonProps {
  label: string;
  fullLabel: string;
  isSelected: boolean;
  onPress: () => void;
}

function CompactTypeButton({ label, fullLabel, isSelected, onPress }: CompactTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[80px] min-h-[48px] rounded-pill items-center justify-center px-4 active:scale-95"
      style={isSelected ? { backgroundColor: SLEEP_PURPLE } : undefined}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text className={`text-2xl ${isSelected ? "" : ""}`}>
        {label}
      </Text>
    </Pressable>
  );
}
