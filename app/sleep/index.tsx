import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSleep } from "@/contexts";
import { useBaby } from "@/contexts";
import { formatDuration } from "@/utils/time";
import type { SleepType } from "@/constants/activities";
import { determineSleepType } from "@/validators/sleep";

const SLEEP_PURPLE = "#6B5B95";
const SLEEP_PURPLE_MUTED = "#E8E4F0";
const SLEEP_PURPLE_DARK = "#574A7B";

export default function SleepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const {
    activeTimer,
    startSleep,
    stopSleep,
    changeSleepType,
  } = useSleep();

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

  const suggestedType = useMemo(() => {
    return determineSleepType(new Date());
  }, []);

  const handleStartSleep = useCallback(async (sleepType: SleepType) => {
    await startSleep(sleepType);
  }, [startSleep]);

  const handleStopSleep = useCallback(async () => {
    await stopSleep();
    router.back();
  }, [stopSleep, router]);

  const handleTypeChange = useCallback((sleepType: SleepType) => {
    changeSleepType(sleepType);
  }, [changeSleepType]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLogPastSleep = useCallback(() => {
    router.push("/sleep/manual");
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
            {t("sleep.title")}
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
            sleepType={activeTimer?.sleepType ?? "nap"}
            onTypeChange={handleTypeChange}
            onStop={handleStopSleep}
          />
        ) : (
          <SleepTypeSelectionView
            suggestedType={suggestedType}
            onSelectType={handleStartSleep}
            onLogPastSleep={handleLogPastSleep}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

interface SleepTypeSelectionViewProps {
  suggestedType: SleepType;
  onSelectType: (sleepType: SleepType) => void;
  onLogPastSleep: () => void;
}

function SleepTypeSelectionView({ suggestedType, onSelectType, onLogPastSleep }: SleepTypeSelectionViewProps) {
  const { t } = useTranslation();

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
      <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-12 text-center">
        {t("sleep.selectTypeToStart")}
      </Text>

      {/* Sleep Type Selection Buttons */}
      <View className="flex-row gap-4 mb-6 w-full">
        <SleepTypeButton
          type="nap"
          label={t("sleep.nap")}
          icon="💤"
          isSuggested={suggestedType === "nap"}
          onPress={() => onSelectType("nap")}
        />
        <SleepTypeButton
          type="night"
          label={t("sleep.night")}
          icon="🌙"
          isSuggested={suggestedType === "night"}
          onPress={() => onSelectType("night")}
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

function SleepTypeButton({ type: _type, label, icon, isSuggested, onPress }: SleepTypeButtonProps) {
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
  onTypeChange: (sleepType: SleepType) => void;
  onStop: () => void;
}

function RunningTimerView({
  elapsedSeconds,
  sleepType,
  onTypeChange,
  onStop
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="items-center w-full">
      {/* Activity indicator */}
      <View className="flex-row items-center mb-4">
        <Text className="text-4xl mr-3">😴</Text>
        <Text style={{ color: SLEEP_PURPLE }} className="text-lg font-semibold">
          {t("sleep.sleeping")}
        </Text>
      </View>

      {/* Sleep type selector (compact for running state) */}
      <View
        className="flex-row rounded-pill p-1 mb-8"
        style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
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

      {/* Timer display - Hero element */}
      <View
        className="px-12 py-8 rounded-card-lg mb-8"
        style={{ backgroundColor: SLEEP_PURPLE_MUTED }}
      >
        <Text
          className="text-timer-xl text-center font-bold tracking-tight"
          style={{ color: SLEEP_PURPLE }}
          accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
        >
          {formattedTime}
        </Text>
      </View>

      {/* Pulsing status indicator */}
      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: SLEEP_PURPLE }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {t("sleep.timerRunning")}
        </Text>
      </View>

      {/* Stop button - Large and prominent */}
      <Pressable
        onPress={onStop}
        className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
        style={{ backgroundColor: SLEEP_PURPLE }}
        accessibilityRole="button"
        accessibilityLabel={t("sleep.wakeUp")}
      >
        <Text className="text-3xl text-white">⏹</Text>
      </Pressable>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
        {t("sleep.tapToStop")}
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
