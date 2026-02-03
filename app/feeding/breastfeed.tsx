import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFeeding } from "@/contexts";
import { useBaby } from "@/contexts";
import { formatDuration } from "@/utils/time";
import { useNotificationIntegration, useTimerAlertIntegration } from "@/hooks";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import type { BreastSide } from "@/constants/activities";

const FEEDING_GREEN = "#88B04B";
const FEEDING_GREEN_MUTED = "#E8F0E0";
const FEEDING_GREEN_DARK = "#6A9030";

export default function BreastfeedingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const {
    activeTimer,
    suggestedSide,
    startBreastfeeding,
    stopBreastfeeding,
    changeSide,
  } = useFeeding();
  const { scheduleReminderAfterFeeding } = useNotificationIntegration();
  const { checkAndSendAlert, resetAlert } = useTimerAlertIntegration("breastfeeding");

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeTimer?.isRunning) {
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
  }, [activeTimer?.isRunning, activeTimer?.startTime, checkAndSendAlert]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer?.isRunning) {
      return 0;
    }
    // tick is used to trigger recalculation every second
    void tick;
    const now = new Date();
    return Math.floor((now.getTime() - activeTimer.startTime.getTime()) / 1000);
  }, [activeTimer, tick]);

  const { leftSeconds, rightSeconds } = useMemo(() => {
    if (!activeTimer?.isRunning) {
      return { leftSeconds: 0, rightSeconds: 0 };
    }
    void tick;
    const now = new Date();
    const currentSideElapsed = Math.floor(
      (now.getTime() - activeTimer.currentSideStartedAt.getTime()) / 1000
    );

    let left = activeTimer.leftAccumulatedSeconds;
    let right = activeTimer.rightAccumulatedSeconds;

    if (activeTimer.side === "left") {
      left += currentSideElapsed;
    } else if (activeTimer.side === "right") {
      right += currentSideElapsed;
    } else if (activeTimer.side === "both") {
      left += currentSideElapsed;
      right += currentSideElapsed;
    }

    return { leftSeconds: left, rightSeconds: right };
  }, [activeTimer, tick]);

  const handleStartFeeding = useCallback(async (side: BreastSide) => {
    await startBreastfeeding(side);
  }, [startBreastfeeding]);

  const handleStopFeeding = useCallback(async () => {
    resetAlert();
    await stopBreastfeeding();
    await scheduleReminderAfterFeeding();
    router.back();
  }, [resetAlert, stopBreastfeeding, scheduleReminderAfterFeeding, router]);

  const handleSideChange = useCallback((side: BreastSide) => {
    changeSide(side);
  }, [changeSide]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLogPast = useCallback(() => {
    router.push("/feeding/manual?type=breastfeed");
  }, [router]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
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
            {t("feeding.breastfeeding")}
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
            side={activeTimer?.side}
            leftSeconds={leftSeconds}
            rightSeconds={rightSeconds}
            onSideChange={handleSideChange}
            onStop={handleStopFeeding}
          />
        ) : (
          <SideSelectionView
            suggestedSide={suggestedSide}
            onSelectSide={handleStartFeeding}
            onLogPast={handleLogPast}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

interface SideSelectionViewProps {
  suggestedSide: BreastSide;
  onSelectSide: (side: BreastSide) => void;
  onLogPast: () => void;
}

function SideSelectionView({ suggestedSide, onSelectSide, onLogPast }: SideSelectionViewProps) {
  const { t } = useTranslation();

  return (
    <View className="items-center w-full">
      {/* Illustration/Icon */}
      <View
        className="w-32 h-32 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: FEEDING_GREEN_MUTED }}
      >
        <Text className="text-6xl">🤱</Text>
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
        {t("feeding.startBreastfeeding")}
      </Text>
      <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-12 text-center">
        {t("feeding.selectSideToStart")}
      </Text>

      {/* Side Selection Buttons */}
      <View className="flex-row gap-4 mb-6 w-full">
        <SideStartButton
          side="left"
          label={t("feeding.leftSide")}
          shortLabel="L"
          isSuggested={suggestedSide === "left"}
          onPress={() => onSelectSide("left")}
        />
        <SideStartButton
          side="right"
          label={t("feeding.rightSide")}
          shortLabel="R"
          isSuggested={suggestedSide === "right"}
          onPress={() => onSelectSide("right")}
        />
      </View>

      {/* Both Sides Option */}
      <Pressable
        onPress={() => onSelectSide("both")}
        className="py-4 px-8 rounded-button-lg active:scale-[0.98]"
        style={{ backgroundColor: FEEDING_GREEN_MUTED }}
        accessibilityRole="button"
        accessibilityLabel={t("feeding.bothSides")}
      >
        <Text style={{ color: FEEDING_GREEN }} className="text-base font-semibold">
          {t("feeding.bothSides")}
        </Text>
      </Pressable>

      {/* Suggestion hint */}
      {suggestedSide !== "both" && (
        <View className="flex-row items-center mt-8">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: FEEDING_GREEN }}
          />
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
            {t("feeding.suggestedSideHint", { side: suggestedSide === "left" ? t("feeding.left") : t("feeding.right") })}
          </Text>
        </View>
      )}

      {/* Log Past Button */}
      <Pressable
        onPress={onLogPast}
        className="mt-8 py-3 px-6 rounded-button-lg active:opacity-70"
        style={{ backgroundColor: FEEDING_GREEN_MUTED }}
        accessibilityRole="button"
        accessibilityLabel={t("feeding.logPastBreastfeeding")}
      >
        <Text className="text-base font-medium" style={{ color: FEEDING_GREEN }}>
          {t("feeding.logPastBreastfeeding")}
        </Text>
      </Pressable>
    </View>
  );
}

interface SideStartButtonProps {
  side: "left" | "right";
  label: string;
  shortLabel: string;
  isSuggested: boolean;
  onPress: () => void;
}

function SideStartButton({ side: _side, label, shortLabel, isSuggested, onPress }: SideStartButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-6 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSuggested ? FEEDING_GREEN : FEEDING_GREEN_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
    >
      {/* Large letter indicator */}
      <Text
        className="text-4xl font-bold mb-2"
        style={{ color: isSuggested ? "#FFFFFF" : FEEDING_GREEN }}
      >
        {shortLabel}
      </Text>

      {/* Side label */}
      <Text
        className="text-base font-medium mb-1"
        style={{ color: isSuggested ? "#FFFFFF" : FEEDING_GREEN_DARK }}
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
  side?: BreastSide;
  leftSeconds: number;
  rightSeconds: number;
  onSideChange: (side: BreastSide) => void;
  onStop: () => void;
}

function RunningTimerView({
  elapsedSeconds,
  side,
  leftSeconds,
  rightSeconds,
  onSideChange,
  onStop
}: RunningTimerViewProps) {
  const { t } = useTranslation();
  const formattedTime = formatDuration(elapsedSeconds);
  const hasMultipleSides = leftSeconds > 0 && rightSeconds > 0;

  return (
    <View className="items-center w-full">
      {/* Activity indicator */}
      <View className="flex-row items-center mb-4">
        <Text className="text-4xl mr-3">🤱</Text>
        <Text style={{ color: FEEDING_GREEN }} className="text-lg font-semibold">
          {t("feeding.breastfeeding")}
        </Text>
      </View>

      {/* Side selector (compact for running state) */}
      <View
        className="flex-row rounded-pill p-1 mb-8"
        style={{ backgroundColor: FEEDING_GREEN_MUTED }}
      >
        <CompactSideButton
          label="L"
          fullLabel={t("feeding.left")}
          isSelected={side === "left"}
          onPress={() => onSideChange("left")}
        />
        <CompactSideButton
          label="B"
          fullLabel={t("feeding.both")}
          isSelected={side === "both"}
          onPress={() => onSideChange("both")}
        />
        <CompactSideButton
          label="R"
          fullLabel={t("feeding.right")}
          isSelected={side === "right"}
          onPress={() => onSideChange("right")}
        />
      </View>

      {/* Timer display - Hero element */}
      <View
        className="px-12 py-8 rounded-card-lg mb-4"
        style={{ backgroundColor: FEEDING_GREEN_MUTED }}
      >
        <Text
          className="text-timer-xl text-center font-bold tracking-tight"
          style={{ color: FEEDING_GREEN }}
          accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
        >
          {formattedTime}
        </Text>
      </View>

      {/* Per-side duration display */}
      {(leftSeconds > 0 || rightSeconds > 0 || hasMultipleSides) && (
        <View className="flex-row items-center justify-center mb-6 gap-6">
          <View className="items-center">
            <Text
              className="text-xs uppercase font-semibold mb-1"
              style={{ color: side === "left" || side === "both" ? FEEDING_GREEN : "#888" }}
            >
              {t("feeding.left")}
            </Text>
            <Text
              className="text-xl font-bold"
              style={{ color: side === "left" || side === "both" ? FEEDING_GREEN : "#888" }}
            >
              {formatDuration(leftSeconds, "short")}
            </Text>
          </View>
          <View className="items-center">
            <Text
              className="text-xs uppercase font-semibold mb-1"
              style={{ color: side === "right" || side === "both" ? FEEDING_GREEN : "#888" }}
            >
              {t("feeding.right")}
            </Text>
            <Text
              className="text-xl font-bold"
              style={{ color: side === "right" || side === "both" ? FEEDING_GREEN : "#888" }}
            >
              {formatDuration(rightSeconds, "short")}
            </Text>
          </View>
        </View>
      )}

      {/* Pulsing status indicator */}
      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: FEEDING_GREEN }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {t("feeding.timerRunning")}
        </Text>
      </View>

      {/* Stop button - Large and prominent */}
      <Pressable
        onPress={onStop}
        className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
        style={{ backgroundColor: FEEDING_GREEN }}
        accessibilityRole="button"
        accessibilityLabel={t("common.stopTimer")}
      >
        <Text className="text-3xl text-white">⏹</Text>
      </Pressable>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
        {t("feeding.tapToStop")}
      </Text>
    </View>
  );
}

interface CompactSideButtonProps {
  label: string;
  fullLabel: string;
  isSelected: boolean;
  onPress: () => void;
}

function CompactSideButton({ label, fullLabel, isSelected, onPress }: CompactSideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[64px] min-h-[48px] rounded-pill items-center justify-center px-4 active:scale-95"
      style={isSelected ? { backgroundColor: FEEDING_GREEN } : undefined}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className={`text-base font-semibold ${isSelected ? "text-white" : ""}`}
        style={!isSelected ? { color: FEEDING_GREEN } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}
