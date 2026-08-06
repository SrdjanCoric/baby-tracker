import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View, Keyboard, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { usePumping } from "@/contexts/pumping-context";
import { useBaby, useUnits, useAuth, useTimeFormat, useActiveTimers } from "@/contexts";
import { formatDuration, formatTime } from "@/utils/time";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import { useTimerAlertIntegration } from "@/hooks";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { exitModal } from "@/navigation";
import type { BreastSide } from "@/constants/activities";
import { getOppositeSide } from "@/constants/activities";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { RunningTimerStartEditor } from "@/components/RunningTimerStartEditor";
import { BoundedAndroidDateTimePicker } from "@/components/BoundedAndroidDateTimePicker";
import { getTimerStartBounds, normalizeTimerStartSelection, type TimerStartBounds } from "@/utils/timer-start-bounds";

const PUMPING_BLUE = "#7B9BC9";
const PUMPING_BLUE_MUTED = "#E8EDF5";
const PUMPING_BLUE_DARK = "#5A7AA8";
const PAUSED_AMBER = "#D4A017";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];

type VolumeUnit = "ml" | "oz";

export default function PumpingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showVolumeInput: showVolumeInputParam, action, onboardingActivity } = useLocalSearchParams<{
    showVolumeInput?: string;
    action?: string;
    onboardingActivity?: string;
  }>();
  const { selectedBaby } = useBaby();
  const { session, user } = useAuth();
  const { getLockForActivity } = useActiveTimers();
  const isAuthenticated = !!session?.access_token;
  const { volumeUnit } = useUnits();
  const {
    activeTimer,
    isStopping,
    startPumping,
    stopPumping,
    editPumpingStartTime,
    changePumpingSide,
    pausePumping,
    resumePumping,
    getLastSide,
    pumpings,
  } = usePumping();
  const timerLock = selectedBaby
    ? getLockForActivity(selectedBaby.id, "pumping")
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
        pumpings,
        new Date(),
        activeTimer?.isPaused ? activeTimer.pausedAt : undefined
      ),
    [activeTimer?.isPaused, activeTimer?.pausedAt, pumpings]
  );

  const { checkAndSendAlert, resetAlert } = useTimerAlertIntegration("pumping");

  const [tick, setTick] = useState(0);
  const [showVolumeInput, setShowVolumeInput] = useState(showVolumeInputParam === "true" && activeTimer?.isRunning);
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>(volumeUnit);
  const [inputValue, setInputValue] = useState("");

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

  const suggestedSide = useMemo((): BreastSide => {
    const lastSide = getLastSide();
    return lastSide ? getOppositeSide(lastSide) : "both";
  }, [getLastSide]);

  const handleStartPumping = useCallback(async (side: BreastSide, customStartTime?: Date) => {
    const result = await startPumping(side, customStartTime);
    if (result.success && onboardingActivity === "first") {
      await NewOwnerOnboardingStorageService.completeTimerStarted("pumping");
      router.replace("/(tabs)");
    }
  }, [onboardingActivity, router, startPumping]);

  const handleRequestStop = useCallback(() => {
    setShowVolumeInput(true);
  }, []);

  const isStoppingRef = useRef(false);
  const handleConfirmStop = useCallback(async () => {
    if (volumeMl === null || volumeMl <= 0) return;
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      resetAlert();
      await stopPumping(volumeMl);
      exitModal(router);
    } catch (error) {
      console.error("[PumpingScreen] Failed to stop pumping:", error);
      Alert.alert(t("common.error"), t("pumping.stopError"));
    } finally {
      isStoppingRef.current = false;
    }
  }, [resetAlert, stopPumping, volumeMl, router, t]);

  const handleCancelStop = useCallback(() => {
    setShowVolumeInput(false);
    setVolumeMl(null);
    setInputValue("");
  }, []);

  const handleSideChange = useCallback((side: BreastSide) => {
    changePumpingSide(side);
  }, [changePumpingSide]);

  const handlePause = useCallback(async () => {
    await pausePumping();
  }, [pausePumping]);

  const handleResume = useCallback(async () => {
    await resumePumping();
  }, [resumePumping]);

  useEffect(() => {
    if (!action || !activeTimer?.isRunning) return;
    if (action === "pause" && !activeTimer.isPaused) {
      pausePumping();
    } else if (action === "resume" && activeTimer.isPaused) {
      resumePumping();
    }
    router.setParams({ action: undefined });
  }, [action, activeTimer?.isRunning, activeTimer?.isPaused, pausePumping, resumePumping, router]);

  const handleLogPastPumping = useCallback(() => {
    router.push(onboardingActivity === "first"
      ? "/pumping/manual?onboardingActivity=first"
      : "/pumping/manual");
  }, [onboardingActivity, router]);

  const handleQuickAmountSelect = useCallback((amount: number) => {
    if (unit === "oz") {
      const ml = ozToMl(amount);
      setVolumeMl(ml);
      setInputValue(amount.toString());
    } else {
      setVolumeMl(amount);
      setInputValue(amount.toString());
    }
    Keyboard.dismiss();
  }, [unit]);

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
    const value = parseFloat(text);
    if (!isNaN(value) && value > 0) {
      if (unit === "oz") {
        setVolumeMl(ozToMl(value));
      } else {
        setVolumeMl(value);
      }
    } else {
      setVolumeMl(null);
    }
  }, [unit]);

  const handleUnitToggle = useCallback(() => {
    if (volumeMl !== null) {
      if (unit === "oz") {
        setInputValue(Math.round(volumeMl).toString());
      } else {
        setInputValue(mlToOz(volumeMl).toString());
      }
    }
    setUnit(prev => prev === "oz" ? "ml" : "oz");
  }, [unit, volumeMl]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  const isTimerRunning = activeTimer?.isRunning ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="pumping-screen">
      {/* Header with drag handle - tappable to dismiss keyboard */}
      <View className="items-center pt-2 pb-3">
        <Pressable onPress={() => Keyboard.dismiss()} testID="dismiss-keyboard">
          <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        </Pressable>
        <View className="flex-row items-center w-full px-4">
          <ModalCloseButton accessibilityLabel={t("common.close")} />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
              {t("pumping.title")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {selectedBaby.name}
            </Text>
          </View>
          <View className="w-touch" />
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {showVolumeInput ? (
          <VolumeInputView
            volumeMl={volumeMl}
            unit={unit}
            inputValue={inputValue}
            onInputChange={handleInputChange}
            onUnitToggle={handleUnitToggle}
            onQuickAmountSelect={handleQuickAmountSelect}
            isStopping={isStopping}
            onConfirm={handleConfirmStop}
            onCancel={handleCancelStop}
          />
        ) : isTimerRunning ? (
          <RunningTimerView
            elapsedSeconds={elapsedSeconds}
            side={activeTimer?.side}
            isPaused={activeTimer?.isPaused ?? false}
            onSideChange={handleSideChange}
            onStop={handleRequestStop}
            onPause={isAuthenticated ? handlePause : undefined}
            onResume={isAuthenticated ? handleResume : undefined}
            startedAt={activeTimer!.startTime}
            starterName={timerStarterName}
            canEdit={canEditTimerStart}
            getBounds={getTimerStartBoundsForPicker}
            onEditStart={editPumpingStartTime}
          />
        ) : (
          <SideSelectionView
            suggestedSide={suggestedSide}
            onSelectSide={handleStartPumping}
            onLogPastPumping={handleLogPastPumping}
            getBounds={getTimerStartBoundsForPicker}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

interface SideSelectionViewProps {
  suggestedSide: BreastSide;
  onSelectSide: (side: BreastSide, customStartTime?: Date) => void;
  onLogPastPumping: () => void;
  getBounds(): TimerStartBounds;
}

function SideSelectionView({ suggestedSide, onSelectSide, onLogPastPumping, getBounds }: SideSelectionViewProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customStartTime, setCustomStartTime] = useState<Date | null>(null);
  const [pickerBounds, setPickerBounds] = useState<TimerStartBounds>(() => getBounds());

  const handleSidePress = useCallback((side: BreastSide) => {
    if (customStartTime) {
      onSelectSide(side, customStartTime);
    } else {
      onSelectSide(side);
    }
  }, [customStartTime, onSelectSide]);

  const handleStartedEarlierPress = useCallback(() => {
    setPickerBounds(getBounds());
    setShowTimePicker(true);
  }, [getBounds]);

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      if (selectedTime) {
        const currentBounds = getBounds();
        setPickerBounds(currentBounds);
        setCustomStartTime(normalizeTimerStartSelection(selectedTime, currentBounds));
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
      {/* Illustration/Icon */}
      <View
        className="w-32 h-32 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: PUMPING_BLUE_MUTED }}
      >
        <Text className="text-6xl">🫙</Text>
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
        {t("pumping.startPumping")}
      </Text>
      <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-6 text-center">
        {t("pumping.selectSideToStart")}
      </Text>

      {/* Started Earlier Button */}
      {!customStartTime ? (
        <Pressable
          onPress={handleStartedEarlierPress}
          className="mb-6 py-3 px-5 rounded-full flex-row items-center border-2"
          style={{ borderColor: PUMPING_BLUE, backgroundColor: 'transparent' }}
          accessibilityRole="button"
          accessibilityLabel={t("pumping.startedEarlier")}
        >
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium" style={{ color: PUMPING_BLUE }}>
            {t("pumping.startedEarlier")}
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row items-center mb-6 py-3 px-5 rounded-full" style={{ backgroundColor: PUMPING_BLUE_MUTED }}>
          <Text className="text-lg mr-2">🕐</Text>
          <Text className="text-base font-medium mr-2" style={{ color: PUMPING_BLUE_DARK }}>
            {t("pumping.startTime")}: {formatTime(customStartTime, timeFormat)}
          </Text>
          <Pressable
            onPress={handleClearCustomTime}
            className="ml-2"
            accessibilityRole="button"
            accessibilityLabel={t("common.reset")}
          >
            <Text style={{ color: PUMPING_BLUE }}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Side Selection Buttons */}
      <View className="flex-row gap-4 mb-6 w-full">
        <SideStartButton
          side="left"
          label={t("feeding.leftSide")}
          shortLabel="L"
          isSuggested={suggestedSide === "left"}
          onPress={() => handleSidePress("left")}
        />
        <SideStartButton
          side="right"
          label={t("feeding.rightSide")}
          shortLabel="R"
          isSuggested={suggestedSide === "right"}
          onPress={() => handleSidePress("right")}
        />
      </View>

      {/* Both Sides Option */}
      <Pressable
        onPress={() => handleSidePress("both")}
        className="py-4 px-8 rounded-button-lg active:scale-[0.98]"
        style={{ backgroundColor: suggestedSide === "both" ? PUMPING_BLUE : PUMPING_BLUE_MUTED }}
        accessibilityRole="button"
        accessibilityLabel={t("feeding.bothSides")}
        testID="side-both"
      >
        <Text
          className="text-base font-semibold"
          style={{ color: suggestedSide === "both" ? "#FFFFFF" : PUMPING_BLUE }}
        >
          {t("feeding.bothSides")}
        </Text>
      </Pressable>

      {/* Suggestion hint */}
      {suggestedSide !== "both" && (
        <View className="flex-row items-center mt-8">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: PUMPING_BLUE }}
          />
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
            {t("pumping.suggestedSideHint", { side: suggestedSide === "left" ? t("feeding.left") : t("feeding.right") })}
          </Text>
        </View>
      )}

      {/* Log Past Pumping Link */}
      <Pressable
        onPress={onLogPastPumping}
        className="mt-8 py-3 px-6 rounded-button-lg active:opacity-70"
        style={{ backgroundColor: PUMPING_BLUE_MUTED }}
        accessibilityRole="button"
        accessibilityLabel={t("pumping.logPastPumping")}
        testID="log-past-pumping-button"
      >
        <Text className="text-base font-medium" style={{ color: PUMPING_BLUE }}>
          {t("pumping.logPastPumping")}
        </Text>
      </Pressable>

      {/* Time Picker */}
      {showTimePicker && (
        <View className="absolute bottom-0 left-0 right-0 bg-surface dark:bg-surface-dark">
          <View className="flex-row justify-end px-4 py-2 border-t border-border dark:border-border-dark">
            <Pressable
              onPress={handleTimeDone}
              className="py-2 px-4"
              accessibilityRole="button"
              accessibilityLabel={t("common.done")}
            >
              <Text className="font-semibold" style={{ color: PUMPING_BLUE }}>
                {t("common.done")}
              </Text>
            </Pressable>
          </View>
          {Platform.OS === "android" ? (
            <BoundedAndroidDateTimePicker
              value={customStartTime ?? pickerBounds.maximumDate}
              bounds={pickerBounds}
              timeFormat={timeFormat}
              onChange={setCustomStartTime}
            />
          ) : (
            <DateTimePicker
              value={customStartTime ?? new Date()}
              mode="datetime"
              display="spinner"
              onChange={handleTimeChange}
              minimumDate={pickerBounds.minimumDate}
              maximumDate={pickerBounds.maximumDate}
            />
          )}
        </View>
      )}
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

function SideStartButton({ side, label, shortLabel, isSuggested, onPress }: SideStartButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-6 rounded-card-lg active:scale-[0.97]"
      style={{
        backgroundColor: isSuggested ? PUMPING_BLUE : PUMPING_BLUE_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
      testID={`side-${side}`}
    >
      {/* Large letter indicator */}
      <Text
        className="text-4xl font-bold mb-2"
        style={{ color: isSuggested ? "#FFFFFF" : PUMPING_BLUE }}
      >
        {shortLabel}
      </Text>

      {/* Side label */}
      <Text
        className="text-base font-medium mb-1"
        style={{ color: isSuggested ? "#FFFFFF" : PUMPING_BLUE_DARK }}
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
  isPaused: boolean;
  onSideChange: (side: BreastSide) => void;
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
  side,
  isPaused,
  onSideChange,
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
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="items-center w-full">
      <View className="flex-row items-center mb-4">
        <Text className="text-4xl mr-3">🫙</Text>
        <Text style={{ color: PUMPING_BLUE }} className="text-lg font-semibold">
          {t("pumping.pumping")}
        </Text>
      </View>

      <View
        className="flex-row rounded-pill p-1 mb-8"
        style={{ backgroundColor: PUMPING_BLUE_MUTED, opacity: isPaused ? 0.4 : 1 }}
        pointerEvents={isPaused ? "none" : "auto"}
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

      <RunningTimerStartEditor
        startLabel={t("pumping.startTime")}
        startedAt={startedAt}
        starterName={starterName}
        canEdit={canEdit}
        getBounds={getBounds}
        timeFormat={timeFormat}
        accentColor={PUMPING_BLUE}
        mutedBackgroundColor={PUMPING_BLUE_MUTED}
        onEdit={onEditStart}
      />

      <View
        testID="running-timer-elapsed"
        className="px-12 py-8 rounded-card-lg mb-8"
        style={{ backgroundColor: PUMPING_BLUE_MUTED }}
      >
        <Text
          className="text-timer-xl text-center font-bold tracking-tight"
          style={{ color: isPaused ? PAUSED_AMBER : PUMPING_BLUE, opacity: isPaused ? 0.5 : 1 }}
          accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
        >
          {formattedTime}
        </Text>
      </View>

      <View className="flex-row items-center mb-10">
        <View
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: isPaused ? PAUSED_AMBER : PUMPING_BLUE }}
        />
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
          {isPaused ? t("common.timerPaused") : t("pumping.timerRunning")}
        </Text>
      </View>

      <View className="flex-row items-center gap-6">
        {onPause && onResume && (
          <Pressable
            onPress={isPaused ? onResume : onPause}
            className="w-16 h-16 rounded-full items-center justify-center active:scale-95 border-2"
            style={{ borderColor: PUMPING_BLUE, backgroundColor: isPaused ? PUMPING_BLUE : "transparent" }}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? t("common.resumeTimer") : t("common.pauseTimer")}
          >
            <Text className="text-2xl" style={{ color: isPaused ? "#FFFFFF" : PUMPING_BLUE }}>
              {isPaused ? "▶" : "⏸"}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: PUMPING_BLUE }}
          accessibilityRole="button"
          accessibilityLabel={t("common.stopTimer")}
          testID="stop-timer-button"
        >
          <Text className="text-3xl text-white">⏹</Text>
        </Pressable>
      </View>

      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
        {isPaused ? t("common.tapToResume") : t("pumping.tapToStop")}
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
      style={isSelected ? { backgroundColor: PUMPING_BLUE } : undefined}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className={`text-base font-semibold ${isSelected ? "text-white" : ""}`}
        style={!isSelected ? { color: PUMPING_BLUE } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface VolumeInputViewProps {
  volumeMl: number | null;
  unit: VolumeUnit;
  inputValue: string;
  onInputChange: (text: string) => void;
  onUnitToggle: () => void;
  onQuickAmountSelect: (amount: number) => void;
  isStopping: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function VolumeInputView({
  volumeMl,
  unit,
  inputValue,
  onInputChange,
  onUnitToggle,
  onQuickAmountSelect,
  isStopping,
  onConfirm,
  onCancel,
}: VolumeInputViewProps) {
  const { t } = useTranslation();
  const canSave = volumeMl !== null && volumeMl > 0 && !isStopping;

  return (
    <View className="items-center w-full">
      {/* Title */}
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: PUMPING_BLUE_MUTED }}
      >
        <Text className="text-4xl">🫙</Text>
      </View>

      <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
        {t("pumping.howMuchPumped")}
      </Text>
      <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-8 text-center">
        {t("pumping.enterVolume")}
      </Text>

      {/* Unit Toggle */}
      <View className="mb-4">
        <UnitToggle unit={unit} onToggle={onUnitToggle} />
      </View>

      {/* Input field with unit */}
      <View
        className="flex-row items-center rounded-card-lg px-4 py-3 mb-4 w-full max-w-[250px]"
        style={{ backgroundColor: PUMPING_BLUE_MUTED }}
      >
        <TextInput
          className="flex-1 text-3xl font-semibold text-center"
          style={{ color: PUMPING_BLUE_DARK }}
          value={inputValue}
          onChangeText={onInputChange}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          returnKeyType="done"
          autoFocus
          accessibilityLabel={t("pumping.enterVolume")}
          testID="volume-input"
        />
        <Text className="text-lg font-medium ml-2" style={{ color: PUMPING_BLUE }}>
          {unit}
        </Text>
      </View>

      {/* Quick amount buttons */}
      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
        {t("feeding.quickAmounts")}
      </Text>
      <View className="flex-row flex-wrap gap-2 justify-center mb-6">
        {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map((amount) => (
          <QuickAmountButton
            key={amount}
            amount={amount}
            unit={unit}
            isSelected={
              unit === "oz"
                ? volumeMl !== null && Math.abs(ozToMl(amount) - volumeMl) < 1
                : volumeMl === amount
            }
            onPress={() => onQuickAmountSelect(amount)}
          />
        ))}
      </View>

      {/* Amount preview */}
      {volumeMl !== null && volumeMl > 0 && (
        <View className="items-center mb-6">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {formatVolume(volumeMl, "ml")} = {formatVolume(volumeMl, "oz")}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View className="flex-row gap-4 w-full">
        <Pressable
          onPress={onCancel}
          disabled={isStopping}
          className="flex-1 py-4 rounded-button-lg items-center active:scale-[0.98]"
          style={{ backgroundColor: PUMPING_BLUE_MUTED }}
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          accessibilityState={{ disabled: isStopping }}
        >
          <Text className="text-base font-semibold" style={{ color: PUMPING_BLUE }}>
            {t("common.cancel")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={!canSave}
          className={`flex-1 py-4 rounded-button-lg items-center active:scale-[0.98] ${
            !canSave ? "opacity-50" : ""
          }`}
          style={{ backgroundColor: PUMPING_BLUE }}
          accessibilityRole="button"
          accessibilityLabel={isStopping ? t("common.stopping") : t("common.save")}
          accessibilityState={isStopping ? { disabled: true, busy: true } : { disabled: !canSave }}
          testID="save-button"
        >
          <Text className="text-base font-semibold text-white">
            {isStopping ? t("common.stopping") : t("common.save")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface UnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
}

function UnitToggle({ unit, onToggle }: UnitToggleProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onToggle}
      className="flex-row rounded-pill p-1"
      style={{ backgroundColor: PUMPING_BLUE_MUTED }}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${unit === "oz" ? "milliliters" : "ounces"}`}
    >
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "oz" ? { backgroundColor: PUMPING_BLUE } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "oz" ? "#FFFFFF" : PUMPING_BLUE }}
        >
          {t("feeding.oz")}
        </Text>
      </View>
      <View
        className="px-3 py-1 rounded-pill"
        style={unit === "ml" ? { backgroundColor: PUMPING_BLUE } : undefined}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: unit === "ml" ? "#FFFFFF" : PUMPING_BLUE }}
        >
          {t("feeding.ml")}
        </Text>
      </View>
    </Pressable>
  );
}

interface QuickAmountButtonProps {
  amount: number;
  unit: VolumeUnit;
  isSelected: boolean;
  onPress: () => void;
}

function QuickAmountButton({ amount, unit, isSelected, onPress }: QuickAmountButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{
        backgroundColor: isSelected ? PUMPING_BLUE : PUMPING_BLUE_MUTED,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${amount} ${unit}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className="text-base font-semibold"
        style={{ color: isSelected ? "#FFFFFF" : PUMPING_BLUE }}
      >
        {amount}
      </Text>
    </Pressable>
  );
}
