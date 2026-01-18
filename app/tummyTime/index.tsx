import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTummyTime, useBaby } from "@/contexts";
import { formatDuration } from "@/utils/time";
import Svg, { Circle } from "react-native-svg";

const TUMMY_ORANGE = "#E67E22";
const TUMMY_ORANGE_MUTED = "#FEF3E2";
const TUMMY_ORANGE_DARK = "#D35400";

export default function TummyTimeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const {
    activeTimer,
    startTummyTime,
    stopTummyTime,
    getTodaysTotalSeconds,
    getDailyProgress,
    dailyGoalSeconds,
  } = useTummyTime();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeTimer?.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isRunning]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer?.isRunning) {
      return 0;
    }
    void tick;
    const now = new Date();
    return Math.floor((now.getTime() - activeTimer.startTime.getTime()) / 1000);
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

  const handleStartTummyTime = useCallback(async () => {
    await startTummyTime();
  }, [startTummyTime]);

  const handleStopTummyTime = useCallback(async () => {
    await stopTummyTime();
    router.back();
  }, [stopTummyTime, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLogPastTummyTime = useCallback(() => {
    router.push("/tummyTime/manual");
  }, [router]);

  if (!selectedBaby) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.noBabySelected")}
        </Text>
      </SafeAreaView>
    );
  }

  const isTimerRunning = activeTimer?.isRunning ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">←</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("tummyTime.title")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {selectedBaby.name}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {isTimerRunning ? (
          <RunningTimerView
            elapsedSeconds={elapsedSeconds}
            todaysTotal={todaysTotal}
            progress={progress}
            dailyGoalSeconds={dailyGoalSeconds}
            onStop={handleStopTummyTime}
          />
        ) : (
          <StartView
            todaysTotal={todaysTotal}
            progress={progress}
            dailyGoalSeconds={dailyGoalSeconds}
            onStart={handleStartTummyTime}
            onLogPast={handleLogPastTummyTime}
          />
        )}
      </View>
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
  onStart: () => void;
  onLogPast: () => void;
}

function StartView({
  todaysTotal,
  progress,
  dailyGoalSeconds,
  onStart,
  onLogPast,
}: StartViewProps) {
  const { t } = useTranslation();
  const isGoalComplete = progress >= 100;

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
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary">
            {formatDuration(todaysTotal)} / {formatDuration(dailyGoalSeconds)}
          </Text>
        </View>
      )}

      {/* Title */}
      <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
        {t("tummyTime.startTummyTime")}
      </Text>
      <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-8 text-center">
        {t("tummyTime.tapToStart")}
      </Text>

      {/* Start Button */}
      <Pressable
        onPress={onStart}
        className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
        style={{ backgroundColor: TUMMY_ORANGE }}
        accessibilityRole="button"
        accessibilityLabel={t("tummyTime.startTummyTime")}
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
    </View>
  );
}

interface RunningTimerViewProps {
  elapsedSeconds: number;
  todaysTotal: number;
  progress: number;
  dailyGoalSeconds: number;
  onStop: () => void;
}

function RunningTimerView({
  elapsedSeconds,
  todaysTotal,
  progress,
  dailyGoalSeconds,
  onStop,
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);
  const isGoalComplete = progress >= 100;

  return (
    <View className="items-center w-full">
      {/* Activity indicator */}
      <View className="flex-row items-center mb-4">
        <Text className="text-4xl mr-3">💪</Text>
        <Text style={{ color: TUMMY_ORANGE }} className="text-lg font-semibold">
          {t("tummyTime.inProgress")}
        </Text>
      </View>

      {/* Progress Ring with Timer */}
      <View className="relative items-center justify-center mb-4">
        <ProgressRing progress={progress} size={200} strokeWidth={14} />
        <View className="absolute items-center justify-center">
          <Text
            className="text-4xl font-bold tracking-tight"
            style={{ color: TUMMY_ORANGE }}
            accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
          >
            {formattedTime}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
            {t("tummyTime.thisSession")}
          </Text>
        </View>
      </View>

      {/* Today's Progress */}
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

      {/* Pulsing status indicator */}
      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: TUMMY_ORANGE }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {t("tummyTime.timerRunning")}
        </Text>
      </View>

      {/* Stop button - Large and prominent */}
      <Pressable
        onPress={onStop}
        className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
        style={{ backgroundColor: TUMMY_ORANGE }}
        accessibilityRole="button"
        accessibilityLabel={t("tummyTime.stopTummyTime")}
      >
        <Text className="text-3xl text-white">⏹</Text>
      </Pressable>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
        {t("tummyTime.tapToStop")}
      </Text>
    </View>
  );
}
