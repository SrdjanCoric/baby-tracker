import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTummyTime, useBaby, useAuth, useTimeFormat } from "@/contexts";
import { formatDuration, formatTime } from "@/utils/time";
import { useTimerAlertIntegration } from "@/hooks";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { exitModal } from "@/navigation";
import { MilestoneSuggestionModal } from "@/components";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

const TUMMY_ORANGE = "#E67E22";
const TUMMY_ORANGE_MUTED = "#FEF3E2";
const TUMMY_ORANGE_DARK = "#D35400";
const PAUSED_AMBER = "#D4A017";

export default function TummyTimeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { action, onboardingActivity } = useLocalSearchParams<{
    action?: string;
    onboardingActivity?: string;
  }>();
  const { selectedBaby } = useBaby();
  const { session } = useAuth();
  const isAuthenticated = !!session?.access_token;
  const {
    activeTimer,
    startTummyTime,
    stopTummyTime,
    pauseTummyTime,
    resumeTummyTime,
    dailyGoalSeconds,
    currentAgeGroup,
    showMilestoneSuggestion,
    suggestedGoalSeconds,
    acceptMilestoneSuggestion,
    dismissMilestoneSuggestion,
  } = useTummyTime();

  const { checkAndSendAlert, resetAlert } = useTimerAlertIntegration("tummyTime");

  const [tick, setTick] = useState(0);

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
      checkAndSendAlert(elapsedMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isRunning, activeTimer?.isPaused, activeTimer?.startTime, checkAndSendAlert]);

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


  const handleStartTummyTime = useCallback(async (customStartTime?: Date) => {
    const result = await startTummyTime(customStartTime);
    if (result.success && onboardingActivity === "first") {
      await NewOwnerOnboardingStorageService.completeTimerStarted("tummyTime");
      router.replace("/(tabs)");
    }
  }, [onboardingActivity, router, startTummyTime]);

  const handlePause = useCallback(async () => {
    await pauseTummyTime();
  }, [pauseTummyTime]);

  const handleResume = useCallback(async () => {
    await resumeTummyTime();
  }, [resumeTummyTime]);

  const isStoppingRef = useRef(false);
  const handleStopTummyTime = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      resetAlert();
      await stopTummyTime();
      exitModal(router);
    } finally {
      isStoppingRef.current = false;
    }
  }, [resetAlert, stopTummyTime, router]);

  const handleLogPastTummyTime = useCallback(() => {
    router.push(onboardingActivity === "first"
      ? "/tummyTime/manual?onboardingActivity=first"
      : "/tummyTime/manual");
  }, [onboardingActivity, router]);

  const handleGoalSettings = useCallback(() => {
    router.push("/tummyTime/settings");
  }, [router]);

  const handleAcceptSuggestion = useCallback(async () => {
    await acceptMilestoneSuggestion();
  }, [acceptMilestoneSuggestion]);

  const handleDismissSuggestion = useCallback(async () => {
    await dismissMilestoneSuggestion();
  }, [dismissMilestoneSuggestion]);

  const handleKeepCurrent = useCallback(() => {
    dismissMilestoneSuggestion();
  }, [dismissMilestoneSuggestion]);

  useEffect(() => {
    if (!action || !activeTimer?.isRunning) return;
    if (action === "pause" && !activeTimer.isPaused) {
      pauseTummyTime();
    } else if (action === "resume" && activeTimer.isPaused) {
      resumeTummyTime();
    }
    router.setParams({ action: undefined });
  }, [action, activeTimer?.isRunning, activeTimer?.isPaused, pauseTummyTime, resumeTummyTime, router]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  const isTimerRunning = activeTimer?.isRunning ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="tummy-time-screen">
      {/* Header with drag handle */}
      <View className="items-center pt-2 pb-3">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <View className="flex-row items-center w-full px-4">
          <ModalCloseButton accessibilityLabel={t("common.close")} />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
              {t("tummyTime.title")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {selectedBaby.name}
            </Text>
          </View>
          <Pressable
            onPress={handleGoalSettings}
            className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
            accessibilityRole="button"
            accessibilityLabel={t("tummyTime.goalSettings")}
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
            onStop={handleStopTummyTime}
            onPause={isAuthenticated ? handlePause : undefined}
            onResume={isAuthenticated ? handleResume : undefined}
          />
        ) : (
          <StartView
            onStart={handleStartTummyTime}
            onLogPast={handleLogPastTummyTime}
          />
        )}
      </View>

      {/* Milestone Suggestion Modal */}
      <MilestoneSuggestionModal
        visible={showMilestoneSuggestion}
        currentGoalSeconds={dailyGoalSeconds}
        suggestedGoalSeconds={suggestedGoalSeconds ?? 0}
        ageGroupLabel={currentAgeGroup?.label ?? ""}
        onAccept={handleAcceptSuggestion}
        onDismiss={handleDismissSuggestion}
        onKeepCurrent={handleKeepCurrent}
      />
    </SafeAreaView>
  );
}


interface StartViewProps {
  onStart: (customStartTime?: Date) => void;
  onLogPast: () => void;
}

function StartView({
  onStart,
  onLogPast,
}: StartViewProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customStartTime, setCustomStartTime] = useState<Date | null>(null);

  const handleStartPress = useCallback(() => {
    if (customStartTime) {
      onStart(customStartTime);
    } else {
      onStart();
    }
  }, [customStartTime, onStart]);

  const handleStartedEarlierPress = useCallback(() => {
    setShowTimePicker(true);
  }, []);

  const yesterdayStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      if (selectedTime) {
        const now = new Date();
        let finalTime: Date;
        if (Platform.OS === "android") {
          finalTime = new Date();
          finalTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds(), 0);
          if (finalTime > now) {
            finalTime.setDate(finalTime.getDate() - 1);
          }
          if (finalTime < yesterdayStart) {
            finalTime = new Date(yesterdayStart);
          }
        } else {
          finalTime = selectedTime > now ? now : selectedTime;
        }
        setCustomStartTime(finalTime);
      }
    },
    [yesterdayStart]
  );

  const handleTimeDone = useCallback(() => {
    setShowTimePicker(false);
  }, []);

  const handleClearCustomTime = useCallback(() => {
    setCustomStartTime(null);
  }, []);

  return (
    <View className="items-center w-full">
      {/* Started Earlier Button */}
      {!customStartTime ? (
        <Pressable
          onPress={handleStartedEarlierPress}
          className="mb-8 py-3 px-5 rounded-full flex-row items-center border-2"
          style={{ borderColor: TUMMY_ORANGE, backgroundColor: 'transparent' }}
          accessibilityRole="button"
          accessibilityLabel={t("tummyTime.startedEarlier")}
        >
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium" style={{ color: TUMMY_ORANGE }}>
            {t("tummyTime.startedEarlier")}
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row items-center mb-8 py-3 px-5 rounded-full" style={{ backgroundColor: TUMMY_ORANGE_MUTED }}>
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium mr-2" style={{ color: TUMMY_ORANGE_DARK }}>
            {t("tummyTime.startTime")}: {formatTime(customStartTime, timeFormat)}
          </Text>
          <Pressable
            onPress={handleClearCustomTime}
            className="ml-2"
            accessibilityRole="button"
            accessibilityLabel={t("common.reset")}
          >
            <Text style={{ color: TUMMY_ORANGE }}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Start Button */}
      <Pressable
        onPress={handleStartPress}
        className="w-48 h-48 rounded-full items-center justify-center mb-8 active:scale-[0.97]"
        style={{ backgroundColor: TUMMY_ORANGE }}
        accessibilityRole="button"
        accessibilityLabel={t("tummyTime.startTummyTime")}
        testID="start-timer-button"
      >
        <Text className="text-4xl">💪</Text>
        <Text className="text-base font-semibold text-white mt-2 text-center px-4">
          {t("tummyTime.startTummyTime")}
        </Text>
      </Pressable>

      {/* Log Past Tummy Time Link */}
      <Pressable
        onPress={onLogPast}
        className="mt-4 py-3 px-6 rounded-button-lg active:opacity-70"
        style={{ backgroundColor: TUMMY_ORANGE_MUTED }}
        accessibilityRole="button"
        accessibilityLabel={t("tummyTime.logPastTummyTime")}
      >
        <Text className="text-base font-medium" style={{ color: TUMMY_ORANGE }}>
          {t("tummyTime.logPastTummyTime")}
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
                <Text className="font-semibold" style={{ color: TUMMY_ORANGE }}>
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
            minimumDate={Platform.OS === "ios" ? yesterdayStart : undefined}
            maximumDate={Platform.OS === "ios" ? new Date() : undefined}
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
}

function RunningTimerView({
  elapsedSeconds,
  isPaused,
  onStop,
  onPause,
  onResume,
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="items-center w-full">
      <View className="flex-row items-center mb-8">
        <Text className="text-4xl mr-3">💪</Text>
        <Text style={{ color: TUMMY_ORANGE }} className="text-lg font-semibold">
          {t("tummyTime.inProgress")}
        </Text>
      </View>

      <View
        className="px-12 py-8 rounded-card-lg mb-8"
        style={{ backgroundColor: TUMMY_ORANGE_MUTED }}
      >
        <Text
          className="text-timer-xl text-center font-bold tracking-tight"
          style={{ color: isPaused ? PAUSED_AMBER : TUMMY_ORANGE, opacity: isPaused ? 0.5 : 1 }}
          accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
        >
          {formattedTime}
        </Text>
      </View>

      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: isPaused ? PAUSED_AMBER : TUMMY_ORANGE }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {isPaused ? t("common.timerPaused") : t("tummyTime.timerRunning")}
        </Text>
      </View>

      <View className="flex-row items-center gap-6">
        {onPause && onResume && (
          <Pressable
            onPress={isPaused ? onResume : onPause}
            className="w-16 h-16 rounded-full items-center justify-center active:scale-95 border-2"
            style={{ borderColor: TUMMY_ORANGE, backgroundColor: isPaused ? TUMMY_ORANGE : "transparent" }}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? t("common.resumeTimer") : t("common.pauseTimer")}
          >
            <Text className="text-2xl" style={{ color: isPaused ? "#FFFFFF" : TUMMY_ORANGE }}>
              {isPaused ? "▶" : "⏸"}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: TUMMY_ORANGE }}
          accessibilityRole="button"
          accessibilityLabel={t("tummyTime.stopTummyTime")}
          testID="stop-timer-button"
        >
          <Text className="text-3xl text-white">⏹</Text>
        </Pressable>
      </View>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
        {isPaused ? t("common.tapToResume") : t("tummyTime.tapToStop")}
      </Text>
    </View>
  );
}
