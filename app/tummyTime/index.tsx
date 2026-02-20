import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTummyTime, useBaby, useAuth } from "@/contexts";
import { formatDuration, getDateLocale } from "@/utils/time";
import { useTimerAlertIntegration } from "@/hooks";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { MilestoneSuggestionModal } from "@/components";
import Svg, { Circle } from "react-native-svg";

const TUMMY_ORANGE = "#E67E22";
const TUMMY_ORANGE_MUTED = "#FEF3E2";
const TUMMY_ORANGE_DARK = "#D35400";
const PAUSED_AMBER = "#D4A017";

export default function TummyTimeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { session } = useAuth();
  const isAuthenticated = !!session?.access_token;
  const {
    activeTimer,
    startTummyTime,
    stopTummyTime,
    pauseTummyTime,
    resumeTummyTime,
    getTodaysTotalSeconds,
    getDailyProgress,
    dailyGoalSeconds,
    goalSource,
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
        (now.getTime() - activeTimer.startTime.getTime() - activeTimer.totalPausedMs) / 1000 / 60
      );
      checkAndSendAlert(elapsedMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isRunning, activeTimer?.isPaused, activeTimer?.startTime, activeTimer?.totalPausedMs, checkAndSendAlert]);

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

  const todaysTotal = useMemo(() => {
    void tick;
    return getTodaysTotalSeconds() + (activeTimer?.isRunning ? elapsedSeconds : 0);
  }, [getTodaysTotalSeconds, activeTimer?.isRunning, elapsedSeconds, tick]);

  const progress = useMemo(() => {
    const baseProgress = getDailyProgress();
    if (!activeTimer?.isRunning) return baseProgress;
    const currentProgress = (todaysTotal / dailyGoalSeconds) * 100;
    return Math.min(100, Math.round(currentProgress));
  }, [getDailyProgress, activeTimer?.isRunning, todaysTotal, dailyGoalSeconds]);

  const handleStartTummyTime = useCallback(async (customStartTime?: Date) => {
    await startTummyTime(customStartTime);
  }, [startTummyTime]);

  const handlePause = useCallback(async () => {
    await pauseTummyTime();
  }, [pauseTummyTime]);

  const handleResume = useCallback(async () => {
    await resumeTummyTime();
  }, [resumeTummyTime]);

  const handleStopTummyTime = useCallback(async () => {
    resetAlert();
    await stopTummyTime();
    router.back();
  }, [resetAlert, stopTummyTime, router]);

  const handleLogPastTummyTime = useCallback(() => {
    router.push("/tummyTime/manual");
  }, [router]);

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
          <View className="w-touch" />
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
            todaysTotal={todaysTotal}
            progress={progress}
            dailyGoalSeconds={dailyGoalSeconds}
            isPaused={activeTimer?.isPaused ?? false}
            onStop={handleStopTummyTime}
            onPause={isAuthenticated ? handlePause : undefined}
            onResume={isAuthenticated ? handleResume : undefined}
          />
        ) : (
          <StartView
            todaysTotal={todaysTotal}
            progress={progress}
            dailyGoalSeconds={dailyGoalSeconds}
            goalSource={goalSource}
            currentAgeGroup={currentAgeGroup}
            onStart={handleStartTummyTime}
            onLogPast={handleLogPastTummyTime}
            onGoalSettings={handleGoalSettings}
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

interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
}

function ProgressRing({ progress, size, strokeWidth }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      {/* Background circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={TUMMY_ORANGE_MUTED}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      {/* Progress circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={progress >= 100 ? "#4CAF50" : TUMMY_ORANGE}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

interface StartViewProps {
  todaysTotal: number;
  progress: number;
  dailyGoalSeconds: number;
  goalSource: "age_based" | "custom";
  currentAgeGroup: { label: string; rationale: string } | null;
  onStart: (customStartTime?: Date) => void;
  onLogPast: () => void;
  onGoalSettings: () => void;
}

function StartView({
  todaysTotal,
  progress,
  dailyGoalSeconds,
  goalSource,
  currentAgeGroup,
  onStart,
  onLogPast,
  onGoalSettings,
}: StartViewProps) {
  const { t } = useTranslation();
  const isGoalComplete = progress >= 100;
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

  const formatCustomTime = (date: Date): string => {
    return date.toLocaleTimeString(getDateLocale(), {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <View className="items-center w-full">
      {/* Progress Ring with Icon */}
      <View className="relative items-center justify-center mb-8">
        <ProgressRing progress={progress} size={180} strokeWidth={12} />
        <View className="absolute items-center justify-center">
          <Text className="text-5xl mb-1">💪</Text>
          <Text
            className="text-2xl font-bold"
            style={{ color: isGoalComplete ? "#4CAF50" : TUMMY_ORANGE }}
          >
            {progress}%
          </Text>
        </View>
      </View>

      {/* Goal Status */}
      {isGoalComplete ? (
        <View className="items-center mb-6">
          <Text className="text-xl font-bold text-green-600 mb-1">
            {t("tummyTime.goalComplete")}
          </Text>
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
            {formatDuration(todaysTotal)} {t("tummyTime.today")}
          </Text>
        </View>
      ) : (
        <View className="items-center mb-6">
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-1">
            {t("tummyTime.todaysProgress")}
          </Text>
          <Pressable onPress={onGoalSettings} className="items-center active:opacity-70">
            <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary text-center">
              {formatDuration(todaysTotal)} / {formatDuration(dailyGoalSeconds)}
            </Text>
            {goalSource === "age_based" && currentAgeGroup ? (
              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary text-center mt-1">
                {t("tummyTime.basedOnGuidelines", { ageGroup: currentAgeGroup.label })}
              </Text>
            ) : goalSource === "custom" ? (
              <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary text-center mt-1">
                {t("tummyTime.customGoalNote")}
              </Text>
            ) : null}
          </Pressable>
        </View>
      )}

      {/* Started Earlier Button */}
      {!customStartTime ? (
        <Pressable
          onPress={handleStartedEarlierPress}
          className="mb-6 py-3 px-5 rounded-full flex-row items-center border-2"
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
        <View className="flex-row items-center mb-6 py-3 px-5 rounded-full" style={{ backgroundColor: TUMMY_ORANGE_MUTED }}>
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium mr-2" style={{ color: TUMMY_ORANGE_DARK }}>
            {t("tummyTime.startTime")}: {formatCustomTime(customStartTime)}
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
        className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
        style={{ backgroundColor: TUMMY_ORANGE }}
        accessibilityRole="button"
        accessibilityLabel={t("tummyTime.startTummyTime")}
        testID="start-timer-button"
      >
        <Text className="text-3xl text-white">▶</Text>
      </Pressable>

      {/* Log Past Tummy Time Link */}
      <Pressable
        onPress={onLogPast}
        className="mt-8 py-3 px-6 rounded-button-lg active:opacity-70"
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
  todaysTotal: number;
  progress: number;
  dailyGoalSeconds: number;
  isPaused: boolean;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

function RunningTimerView({
  elapsedSeconds,
  todaysTotal,
  progress,
  dailyGoalSeconds,
  isPaused,
  onStop,
  onPause,
  onResume,
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);
  const isGoalComplete = progress >= 100;

  return (
    <View className="items-center w-full">
      <View className="flex-row items-center mb-4">
        <Text className="text-4xl mr-3">💪</Text>
        <Text style={{ color: TUMMY_ORANGE }} className="text-lg font-semibold">
          {t("tummyTime.inProgress")}
        </Text>
      </View>

      <View className="relative items-center justify-center mb-4">
        <ProgressRing progress={progress} size={200} strokeWidth={14} />
        <View className="absolute items-center justify-center">
          <Text
            className="text-4xl font-bold tracking-tight"
            style={{ color: isPaused ? PAUSED_AMBER : TUMMY_ORANGE, opacity: isPaused ? 0.5 : 1 }}
            accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
          >
            {formattedTime}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
            {t("tummyTime.thisSession")}
          </Text>
        </View>
      </View>

      <View
        className="px-6 py-3 rounded-card mb-6"
        style={{ backgroundColor: TUMMY_ORANGE_MUTED }}
      >
        {isGoalComplete ? (
          <Text className="text-base font-medium text-green-600 text-center">
            🎉 {t("tummyTime.goalComplete")}
          </Text>
        ) : (
          <Text
            className="text-base text-center"
            style={{ color: TUMMY_ORANGE_DARK }}
          >
            {t("tummyTime.todaysProgress")}: {formatDuration(todaysTotal)} / {formatDuration(dailyGoalSeconds)}
          </Text>
        )}
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
