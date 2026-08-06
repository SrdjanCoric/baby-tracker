import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSleep, useAuth, useBaby, useTimeFormat, useActiveTimers } from "@/contexts";
import { formatDuration, formatTime } from "@/utils/time";
import { useTimerAlertIntegration } from "@/hooks";
import type { SleepType } from "@/constants/activities";
import { determineSleepType } from "@/validators/sleep";
import { SleepMilestoneSuggestionModal, NoBabyScreen } from "@/components";
import { MorningSleepConfirmation } from "@/components/MorningSleepConfirmation";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { exitModal } from "@/navigation";
import { useColorScheme } from "nativewind";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { RunningTimerStartEditor } from "@/components/RunningTimerStartEditor";
import {
  getTimerStartBounds,
  normalizeTimerStartSelection,
  type TimerStartBounds,
} from "@/utils/timer-start-bounds";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_LIGHT = "#A594CF";
const SLEEP_PURPLE_MUTED = "#E8E4F0";
const SLEEP_PURPLE_MUTED_DARK = "#2E2840";
const PAUSED_AMBER = "#D4A017";

export default function SleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { action, onboardingActivity } = useLocalSearchParams<{
    action?: string;
    onboardingActivity?: string;
  }>();
  const { selectedBaby } = useBaby();
  const { session, user } = useAuth();
  const { getLockForActivity } = useActiveTimers();
  const isAuthenticated = !!session?.access_token;
  const {
    activeTimer,
    sleeps,
    startSleep,
    editSleepStartTime,
    stopSleep,
    pauseSleep,
    resumeSleep,
    dailyGoalMinutes,
    currentAgeGroup,
    showMilestoneSuggestion,
    suggestedGoalMinutes,
    acceptMilestoneSuggestion,
    dismissMilestoneSuggestion,
    wakeWindowConfig,
    pendingMorningConfirmations,
    confirmMorningSleep,
  } = useSleep();
  const timerLock = selectedBaby
    ? getLockForActivity(selectedBaby.id, "sleep")
    : null;
  const hasLocalTimerOwnership =
    activeTimer?.lockState === "owned" || activeTimer?.lockState === "offline";
  const timerStarterName =
    timerLock?.startedByName ??
    (hasLocalTimerOwnership ? user?.displayName : null) ??
    t("common.someone");
  const canEditTimerStart = Boolean(
    user?.id &&
      (timerLock ? timerLock.startedBy === user.id : hasLocalTimerOwnership)
  );
  const getTimerStartBoundsForPicker = useCallback(
    () =>
      getTimerStartBounds(
        sleeps,
        new Date(),
        activeTimer?.isPaused ? activeTimer.pausedAt : undefined
      ),
    [activeTimer?.isPaused, activeTimer?.pausedAt, sleeps]
  );

  const napAlert = useTimerAlertIntegration("nap");
  const nightSleepAlert = useTimerAlertIntegration("nightSleep");

  const getAlertForType = useCallback((sleepType: SleepType | undefined) => {
    return sleepType === "night" ? nightSleepAlert : napAlert;
  }, [napAlert, nightSleepAlert]);

  const [tick, setTick] = useState(0);
  const [isConfirmingMorning, setIsConfirmingMorning] = useState(false);

  useEffect(() => {
    if (!activeTimer?.isRunning || activeTimer?.isPaused) {
      return;
    }

    const interval = setInterval(() => {
      setTick(t => t + 1);

      const now = new Date();
      const elapsedMinutes = Math.floor(
        (now.getTime() - activeTimer.startTime.getTime()) / 1000 / 60
      );
      const alert = getAlertForType(activeTimer.sleepType);
      alert.checkAndSendAlert(elapsedMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isRunning, activeTimer?.isPaused, activeTimer?.startTime, activeTimer?.sleepType, getAlertForType]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer?.isRunning) {
      return 0;
    }
    void tick;
    if (activeTimer.isPaused && activeTimer.pausedAt) {
      return Math.floor(
        (activeTimer.pausedAt.getTime() - activeTimer.startTime.getTime()) / 1000
      );
    }
    const now = new Date();
    return Math.floor((now.getTime() - activeTimer.startTime.getTime()) / 1000);
  }, [activeTimer, tick]);

  const handleStartSleep = useCallback(async (customStartTime?: Date) => {
    const timeToCheck = customStartTime ?? new Date();
    const autoType = determineSleepType(timeToCheck, wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour);
    const result = await startSleep(autoType, customStartTime);
    console.log("[SleepScreen] startSleep result:", JSON.stringify(result));
    if (result.success && onboardingActivity === "first") {
      await NewOwnerOnboardingStorageService.completeTimerStarted("sleep");
      router.replace("/(tabs)");
    }
  }, [onboardingActivity, router, startSleep, wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour]);

  const isStoppingRef = useRef(false);
  const handleStopSleep = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      napAlert.resetAlert();
      nightSleepAlert.resetAlert();
      await stopSleep();
      exitModal(router);
    } finally {
      isStoppingRef.current = false;
    }
  }, [napAlert, nightSleepAlert, stopSleep, router]);

  const handlePause = useCallback(async () => {
    await pauseSleep();
  }, [pauseSleep]);

  const handleResume = useCallback(async () => {
    await resumeSleep();
  }, [resumeSleep]);

  const handleLogPastSleep = useCallback(() => {
    router.push(onboardingActivity === "first"
      ? "/sleep/manual?onboardingActivity=first"
      : "/sleep/manual");
  }, [onboardingActivity, router]);

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

  const pendingMorningConfirmation = useMemo(() => {
    const stored = pendingMorningConfirmations?.[0] ?? null;
    const active = activeTimer?.morningClassification === "unresolved"
      ? {
        id: activeTimer.activityId,
        startedAt: activeTimer.startTime.toISOString(),
      }
      : null;
    if (!stored) return active;
    if (!active) return stored;
    return new Date(stored.startedAt).getTime() <= activeTimer!.startTime.getTime()
      ? stored
      : active;
  }, [activeTimer, pendingMorningConfirmations]);

  const handleMorningAnswer = useCallback(async (
    answer: "first_nap" | "night_continuation"
  ) => {
    if (!pendingMorningConfirmation || isConfirmingMorning) return;
    setIsConfirmingMorning(true);
    try {
      await confirmMorningSleep(pendingMorningConfirmation.id, answer);
    } finally {
      setIsConfirmingMorning(false);
    }
  }, [confirmMorningSleep, isConfirmingMorning, pendingMorningConfirmation]);

  useEffect(() => {
    if (!action || !activeTimer?.isRunning) return;
    if (action === "pause" && !activeTimer.isPaused) {
      pauseSleep();
    } else if (action === "resume" && activeTimer.isPaused) {
      resumeSleep();
    }
    router.setParams({ action: undefined });
  }, [action, activeTimer?.isRunning, activeTimer?.isPaused, pauseSleep, resumeSleep, router]);

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
          <ModalCloseButton
            accessibilityLabel={t("common.close")}
            testID="e2e-dismiss-sleep-button"
          />
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
            isPaused={activeTimer?.isPaused ?? false}
            onStop={handleStopSleep}
            onPause={isAuthenticated ? handlePause : undefined}
            onResume={isAuthenticated ? handleResume : undefined}
            startedAt={activeTimer!.startTime}
            starterName={timerStarterName}
            canEdit={canEditTimerStart}
            getBounds={getTimerStartBoundsForPicker}
            onEditStart={editSleepStartTime}
          />
        ) : (
          <SleepStartView
            onStart={handleStartSleep}
            onLogPastSleep={handleLogPastSleep}
            getBounds={getTimerStartBoundsForPicker}
          />
        )}
        {pendingMorningConfirmation && (
          <View className="w-full mt-5">
            <MorningSleepConfirmation
              startedAt={pendingMorningConfirmation.startedAt}
              onFirstNap={() => handleMorningAnswer("first_nap")}
              onBackToSleep={() => handleMorningAnswer("night_continuation")}
              disabled={isConfirmingMorning}
            />
          </View>
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

interface SleepStartViewProps {
  onStart: (customStartTime?: Date) => void;
  onLogPastSleep: () => void;
  getBounds(): TimerStartBounds;
}

function SleepStartView({ onStart, onLogPastSleep, getBounds }: SleepStartViewProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const accent = isDark ? SLEEP_PURPLE_LIGHT : SLEEP_PURPLE;
  const mutedBg = isDark ? SLEEP_PURPLE_MUTED_DARK : SLEEP_PURPLE_MUTED;
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customStartTime, setCustomStartTime] = useState<Date | null>(null);
  const [pickerBounds, setPickerBounds] = useState<TimerStartBounds>(() =>
    getBounds()
  );

  const handleStartPress = useCallback(() => {
    if (customStartTime) {
      onStart(customStartTime);
    } else {
      onStart();
    }
  }, [customStartTime, onStart]);

  const handleStartedEarlierPress = useCallback(() => {
    setPickerBounds(getBounds());
    setShowTimePicker(true);
  }, [getBounds]);

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      if (selectedTime) {
        const currentBounds = getBounds();
        setPickerBounds(currentBounds);
        setCustomStartTime(
          normalizeTimerStartSelection(
            selectedTime,
            currentBounds,
            new Date(),
            Platform.OS
          )
        );
      }
    },
    [getBounds]
  );

  const handleTimeDone = useCallback(() => {
    setShowTimePicker(false);
  }, []);

  const handleClearCustomTime = useCallback(() => {
    setCustomStartTime(null);
  }, []);

  return (
    <View className="items-center w-full">
      {!customStartTime ? (
        <Pressable
          onPress={handleStartedEarlierPress}
          className="mb-6 py-3 px-5 rounded-full flex-row items-center border-2"
          style={{ borderColor: accent, backgroundColor: 'transparent' }}
          accessibilityRole="button"
          accessibilityLabel={t("sleep.startedEarlier")}
        >
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium" style={{ color: accent }}>
            {t("sleep.startedEarlier")}
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row items-center mb-6 py-3 px-5 rounded-full" style={{ backgroundColor: mutedBg }}>
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium mr-2" style={{ color: accent }}>
            {t("sleep.startTime")}: {formatTime(customStartTime, timeFormat)}
          </Text>
          <Pressable
            onPress={handleClearCustomTime}
            className="ml-2"
            accessibilityRole="button"
            accessibilityLabel={t("common.reset")}
          >
            <Text style={{ color: accent }}>✕</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={handleStartPress}
        className="w-48 h-48 rounded-full items-center justify-center mb-6 active:scale-[0.97]"
        style={{ backgroundColor: accent }}
        accessibilityRole="button"
        accessibilityLabel={t("sleep.startSleep")}
        testID="start-sleep-button"
      >
        <Text className="text-4xl">😴</Text>
        <Text className="text-base font-semibold text-white mt-2">
          {t("sleep.startSleep")}
        </Text>
      </Pressable>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mb-6 text-center">
        {t("sleep.autoDetectHint")}
      </Text>

      <Pressable
        onPress={onLogPastSleep}
        className="py-3 px-6 rounded-button-lg active:opacity-70"
        style={{ backgroundColor: mutedBg }}
        accessibilityRole="button"
        accessibilityLabel={t("sleep.logPastSleep")}
      >
        <Text className="text-base font-medium" style={{ color: accent }}>
          {t("sleep.logPastSleep")}
        </Text>
      </Pressable>

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
                <Text className="font-semibold" style={{ color: accent }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          )}
          <DateTimePicker
            value={customStartTime ?? new Date()}
            mode={Platform.OS === "ios" ? "datetime" : "time"}
            display="spinner"
            onChange={handleTimeChange}
            is24Hour={Platform.OS === "android" ? timeFormat === "24h" : undefined}
            minimumDate={pickerBounds.minimumDate}
            maximumDate={pickerBounds.maximumDate}
          />
        </View>
      )}
    </View>
  );
}

interface RunningTimerViewProps {
  elapsedSeconds: number;
  isPaused: boolean;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
  startedAt: Date;
  starterName: string;
  canEdit: boolean;
  getBounds(): TimerStartBounds;
  onEditStart: (startedAt: Date) => Promise<void>;
}

function RunningTimerView({
  elapsedSeconds,
  isPaused,
  onStop,
  onPause,
  onResume,
  startedAt,
  starterName,
  canEdit,
  getBounds,
  onEditStart,
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const accent = isDark ? SLEEP_PURPLE_LIGHT : SLEEP_PURPLE;
  const mutedBg = isDark ? SLEEP_PURPLE_MUTED_DARK : SLEEP_PURPLE_MUTED;
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="items-center w-full">
      <View className="flex-row items-center mb-8">
        <Text className="text-4xl mr-3">😴</Text>
        <Text style={{ color: accent }} className="text-lg font-semibold">
          {t("sleep.sleeping")}
        </Text>
      </View>

      <View
        className="px-12 py-8 rounded-card-lg mb-8"
        style={{ backgroundColor: mutedBg }}
      >
        <Text
          className="text-timer-xl text-center font-bold tracking-tight"
          style={{ color: isPaused ? PAUSED_AMBER : accent, opacity: isPaused ? 0.5 : 1 }}
          accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
        >
          {formattedTime}
        </Text>
      </View>

      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: isPaused ? PAUSED_AMBER : accent }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {isPaused ? t("common.timerPaused") : t("sleep.timerRunning")}
        </Text>
      </View>

      <RunningTimerStartEditor
        startLabel={t("sleep.startTime")}
        startedAt={startedAt}
        starterName={starterName}
        canEdit={canEdit}
        getBounds={getBounds}
        timeFormat={timeFormat}
        accentColor={accent}
        mutedBackgroundColor={mutedBg}
        onEdit={onEditStart}
      />

      <View className="flex-row items-center gap-6">
        {onPause && onResume && (
          <Pressable
            onPress={isPaused ? onResume : onPause}
            className="w-16 h-16 rounded-full items-center justify-center active:scale-95 border-2"
            style={{ borderColor: accent, backgroundColor: isPaused ? accent : "transparent" }}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? t("common.resumeTimer") : t("common.pauseTimer")}
          >
            <Text className="text-2xl" style={{ color: isPaused ? "#FFFFFF" : accent }}>
              {isPaused ? "▶" : "⏸"}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: accent }}
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
