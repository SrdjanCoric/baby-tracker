import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, Keyboard, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFeeding, useBaby, useUnits, useAuth, useTimeFormat, useActiveTimers } from "@/contexts";
import type { CreateFeedingInput, StoredFeedingEntry } from "@/services/feeding-storage";
import { formatDuration, formatTime } from "@/utils/time";
import { formatVolume, mlToOz, ozToMl } from "@/utils/volume";
import { getLastFeedingType, feedingTypeToTab } from "@/utils/feeding";
import { COMMON_FOODS } from "@/constants/foods";
import type { BreastSide, BottleContentType, SolidReaction } from "@/constants/activities";
import { ACTIVITY, TEXT } from "@/constants/colors";
import { useColorScheme } from "nativewind";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { exitModal } from "@/navigation";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { RunningTimerStartEditor } from "@/components/RunningTimerStartEditor";
import { BoundedAndroidDateTimePicker } from "@/components/BoundedAndroidDateTimePicker";
import { getTimerStartBounds, normalizeTimerStartSelection, type TimerStartBounds } from "@/utils/timer-start-bounds";

const FEEDING_GREEN = ACTIVITY.feeding.accent;
const FEEDING_GREEN_LIGHT = ACTIVITY.feeding.accentDark;
const FEEDING_GREEN_BUTTON_DARK = ACTIVITY.feeding.buttonDark;

type FeedingTab = "breast" | "bottle" | "solids";

const QUICK_AMOUNTS_OZ = [1, 2, 3, 4, 5, 6];
const QUICK_AMOUNTS_ML = [30, 60, 90, 120, 150, 180];

type VolumeUnit = "ml" | "oz";

export default function FeedingScreen() {
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const {
    activeTimer,
    suggestedSide,
    startBreastfeeding,
    stopBreastfeeding,
    editBreastfeedingStartTime,
    changeSide,
    pauseBreastfeeding,
    resumeBreastfeeding,
    addFeeding,
    feedings,
  } = useFeeding();
  const timerLock = selectedBaby
    ? getLockForActivity(selectedBaby.id, "feeding")
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
        feedings,
        new Date(),
        activeTimer?.isPaused ? activeTimer.pausedAt : undefined
      ),
    [activeTimer?.isPaused, activeTimer?.pausedAt, feedings]
  );

  const accentColor = isDark ? FEEDING_GREEN_LIGHT : FEEDING_GREEN;
  const buttonBgColor = isDark ? FEEDING_GREEN_BUTTON_DARK : FEEDING_GREEN;
  const mutedBg = isDark ? "#2D2A28" : "#FFFFFF";
  const secondaryBg = isDark ? "#363330" : "#F5F2F0";

  const [tick, setTick] = useState(0);

  const [activeTab, setActiveTab] = useState<FeedingTab>(() => {
    const lastType = getLastFeedingType(feedings);
    return lastType ? feedingTypeToTab(lastType) : "breast";
  });

  useEffect(() => {
    if (activeTimer?.isRunning && activeTab !== "breast") {
      setActiveTab("breast");
    }
  }, [activeTimer?.isRunning, activeTab]);

  // Timer tick for breastfeeding (stops ticking when paused)
  useEffect(() => {
    if (!activeTimer?.isRunning || activeTimer?.isPaused) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.isRunning, activeTimer?.isPaused]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer?.isRunning) return 0;
    void tick;
    if (activeTimer.isPaused && activeTimer.pausedAt) {
      return Math.floor(
        (activeTimer.pausedAt.getTime() - activeTimer.startTime.getTime()) / 1000
      );
    }
    const now = new Date();
    return Math.floor((now.getTime() - activeTimer.startTime.getTime()) / 1000);
  }, [activeTimer, tick]);

  const handleTabChange = useCallback((tab: FeedingTab) => {
    setActiveTab(tab);
  }, []);

  const handleLogPast = useCallback(() => {
    const onboardingParam = onboardingActivity === "first"
      ? "&onboardingActivity=first"
      : "";
    router.push(`/feeding/manual?type=${activeTab === "breast" ? "breastfeed" : activeTab}${onboardingParam}`);
  }, [router, activeTab, onboardingActivity]);

  const handleActivitySaved = useCallback(async () => {
    if (onboardingActivity === "first") {
      await NewOwnerOnboardingStorageService.markActivitySaved("feeding");
      router.replace("/onboarding/owner/saved");
      return;
    }
    exitModal(router);
  }, [onboardingActivity, router]);

  // Breastfeeding handlers
  const handleStartBreastfeeding = useCallback(async (side: BreastSide, customStartTime?: Date) => {
    const result = await startBreastfeeding(side, customStartTime);
    if (result.success && onboardingActivity === "first") {
      await NewOwnerOnboardingStorageService.completeTimerStarted("feeding");
      router.replace("/(tabs)");
    }
  }, [onboardingActivity, router, startBreastfeeding]);

  const isStoppingRef = useRef(false);
  const handleStopBreastfeeding = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      await stopBreastfeeding();
      exitModal(router);
    } finally {
      isStoppingRef.current = false;
    }
  }, [stopBreastfeeding, router]);

  const handleSideChange = useCallback((side: BreastSide) => {
    changeSide(side);
  }, [changeSide]);

  const handlePause = useCallback(async () => {
    await pauseBreastfeeding();
  }, [pauseBreastfeeding]);

  const handleResume = useCallback(async () => {
    await resumeBreastfeeding();
  }, [resumeBreastfeeding]);

  useEffect(() => {
    if (!action || !activeTimer?.isRunning) return;
    if (action === "pause" && !activeTimer.isPaused) {
      pauseBreastfeeding();
    } else if (action === "resume" && activeTimer.isPaused) {
      resumeBreastfeeding();
    }
    router.setParams({ action: undefined });
  }, [action, activeTimer?.isRunning, activeTimer?.isPaused, pauseBreastfeeding, resumeBreastfeeding, router]);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }


  const isTimerRunning = activeTimer?.isRunning ?? false;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="feeding-screen">
      {/* Header with drag handle */}
      <View className="items-center pt-2 pb-3">
        <Pressable onPress={() => Keyboard.dismiss()} testID="dismiss-keyboard">
          <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        </Pressable>
        <View className="flex-row items-center w-full px-4">
          <ModalCloseButton accessibilityLabel={t("common.close")} />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
              {t("feeding.title")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {selectedBaby.name}
            </Text>
          </View>
          <View className="w-touch" />
        </View>
      </View>

      {/* Tab Bar */}
      {!isTimerRunning && (
        <View className="px-4 mb-4">
          <View
            className="flex-row rounded-card-lg p-1"
            style={{ backgroundColor: secondaryBg }}
          >
            <TabButton
              label={t("feeding.breastfeedingTab")}
              emoji="🤱"
              isActive={activeTab === "breast"}
              onPress={() => handleTabChange("breast")}
              accentColor={accentColor}
              testID="type-breast"
            />
            <TabButton
              label={t("feeding.bottleTab")}
              emoji="🍼"
              isActive={activeTab === "bottle"}
              onPress={() => handleTabChange("bottle")}
              accentColor={accentColor}
              testID="type-bottle"
            />
            <TabButton
              label={t("feeding.solidFood")}
              emoji="🥣"
              isActive={activeTab === "solids"}
              onPress={() => handleTabChange("solids")}
              accentColor={accentColor}
              testID="type-solids"
            />
          </View>
        </View>
      )}

      {/* Content based on active tab */}
      {activeTab === "breast" && (
        isTimerRunning ? (
          <BreastfeedingTimerView
            elapsedSeconds={elapsedSeconds}
            side={activeTimer?.side}
            isPaused={activeTimer?.isPaused ?? false}
            onSideChange={handleSideChange}
            onStop={handleStopBreastfeeding}
            onPause={isAuthenticated ? handlePause : undefined}
            onResume={isAuthenticated ? handleResume : undefined}
            accentColor={accentColor}
            buttonBgColor={buttonBgColor}
            mutedBg={mutedBg}
            secondaryBg={secondaryBg}
            startedAt={activeTimer!.startTime}
            starterName={timerStarterName}
            canEdit={canEditTimerStart}
            getBounds={getTimerStartBoundsForPicker}
            onEditStart={editBreastfeedingStartTime}
          />
        ) : (
          <BreastfeedingForm
            suggestedSide={suggestedSide}
            onSelectSide={handleStartBreastfeeding}
            onLogPast={handleLogPast}
            accentColor={accentColor}
            buttonBgColor={buttonBgColor}
            mutedBg={mutedBg}
            secondaryBg={secondaryBg}
            getBounds={getTimerStartBoundsForPicker}
          />
        )
      )}

      {activeTab === "bottle" && !isTimerRunning && (
        <BottleForm
          selectedBaby={selectedBaby}
          addFeeding={addFeeding}
          onLogPast={handleLogPast}
          onComplete={handleActivitySaved}
          accentColor={accentColor}
          buttonBgColor={buttonBgColor}
          mutedBg={mutedBg}
          secondaryBg={secondaryBg}
        />
      )}

      {activeTab === "solids" && !isTimerRunning && (
        <SolidsForm
          selectedBaby={selectedBaby}
          addFeeding={addFeeding}
          feedings={feedings}
          onLogPast={handleLogPast}
          onComplete={handleActivitySaved}
          accentColor={accentColor}
          buttonBgColor={buttonBgColor}
          mutedBg={mutedBg}
          secondaryBg={secondaryBg}
        />
      )}
    </SafeAreaView>
  );
}

// Tab Button Component
interface TabButtonProps {
  label: string;
  emoji: string;
  isActive: boolean;
  onPress: () => void;
  accentColor: string;
  testID?: string;
}

function TabButton({ label, emoji, isActive, onPress, accentColor, testID }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center py-3 rounded-card active:opacity-80"
      style={isActive ? { backgroundColor: accentColor } : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      testID={testID}
    >
      <Text className="text-lg mr-1">{emoji}</Text>
      <Text
        className="text-sm font-semibold"
        style={{ color: isActive ? "#FFFFFF" : accentColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ============ BREASTFEEDING COMPONENTS ============

interface BreastfeedingFormProps {
  suggestedSide: BreastSide;
  onSelectSide: (side: BreastSide, customStartTime?: Date) => void;
  onLogPast: () => void;
  accentColor: string;
  buttonBgColor: string;
  mutedBg: string;
  secondaryBg: string;
  getBounds(): TimerStartBounds;
}

function BreastfeedingForm({ suggestedSide, onSelectSide, onLogPast, accentColor, buttonBgColor, secondaryBg, getBounds }: BreastfeedingFormProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
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
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center w-full">
        {/* Illustration */}
        <View
          className="w-28 h-28 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: secondaryBg }}
        >
          <Text className="text-5xl">🤱</Text>
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
          {t("feeding.startBreastfeeding")}
        </Text>
        <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-6 text-center">
          {t("feeding.selectSideToStart")}
        </Text>

        {/* Started Earlier Button */}
        {!customStartTime ? (
          <Pressable
            onPress={handleStartedEarlierPress}
            className="mb-6 py-3 px-5 rounded-full flex-row items-center border-2"
            style={{ borderColor: accentColor, backgroundColor: 'transparent' }}
            accessibilityRole="button"
            accessibilityLabel={t("feeding.startedEarlier")}
          >
            <Text className="text-lg mr-2">🕐</Text>
            <Text className="text-base font-medium" style={{ color: accentColor }}>
              {t("feeding.startedEarlier")}
            </Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center mb-6 py-3 px-5 rounded-full" style={{ backgroundColor: secondaryBg }}>
            <Text className="text-lg mr-2">🕐</Text>
            <Text className="text-base font-medium mr-2" style={{ color: accentColor }}>
              {t("feeding.startTime")}: {formatTime(customStartTime, timeFormat)}
            </Text>
            <Pressable
              onPress={handleClearCustomTime}
              className="ml-2"
              accessibilityRole="button"
              accessibilityLabel={t("common.reset")}
            >
              <Text style={{ color: accentColor }}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Side Selection Buttons */}
        <View className="flex-row gap-4 mb-4 w-full">
          <SideButton
            side="left"
            label={t("feeding.leftSide")}
            shortLabel={t("feeding.leftShort")}
            isSuggested={suggestedSide === "left"}
            onPress={() => handleSidePress("left")}
            accentColor={accentColor}
            buttonBgColor={buttonBgColor}
            secondaryBg={secondaryBg}
            isDark={isDark}
          />
          <SideButton
            side="right"
            label={t("feeding.rightSide")}
            shortLabel={t("feeding.rightShort")}
            isSuggested={suggestedSide === "right"}
            onPress={() => handleSidePress("right")}
            accentColor={accentColor}
            buttonBgColor={buttonBgColor}
            secondaryBg={secondaryBg}
            isDark={isDark}
          />
        </View>

        {/* Both Sides Option */}
        <Pressable
          onPress={() => handleSidePress("both")}
          className="py-3 px-6 rounded-button-lg active:scale-[0.98]"
          style={{ backgroundColor: secondaryBg }}
          accessibilityRole="button"
        >
          <Text style={{ color: accentColor }} className="text-base font-semibold">
            {t("feeding.bothSides")}
          </Text>
        </Pressable>

        {/* Suggestion hint */}
        {suggestedSide !== "both" && (
          <View className="flex-row items-center mt-6">
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: accentColor }} />
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
              {t("feeding.suggestedSideHint", { side: suggestedSide === "left" ? t("feeding.left") : t("feeding.right") })}
            </Text>
          </View>
        )}

        {/* Log Past Button */}
        <Pressable
          onPress={onLogPast}
          className="mt-8 py-3 px-6 rounded-button-lg active:opacity-70"
          style={{ backgroundColor: secondaryBg }}
          accessibilityRole="button"
        >
          <Text className="text-base font-medium" style={{ color: accentColor }}>
            {t("feeding.logPastBreastfeeding")}
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
                <Text className="font-semibold" style={{ color: accentColor }}>
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
    </View>
  );
}

interface SideButtonProps {
  side: "left" | "right";
  label: string;
  shortLabel: string;
  isSuggested: boolean;
  onPress: () => void;
  accentColor: string;
  buttonBgColor: string;
  secondaryBg: string;
  isDark: boolean;
  testID?: string;
}

function SideButton({ side, label, shortLabel, isSuggested, onPress, accentColor, buttonBgColor, secondaryBg, isDark }: SideButtonProps) {
  const { t } = useTranslation();
  const textColor = isDark ? TEXT.dark.primary : TEXT.light.primary;

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-5 rounded-card-lg active:scale-[0.97]"
      style={{ backgroundColor: isSuggested ? buttonBgColor : secondaryBg }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${isSuggested ? `, ${t("feeding.suggested")}` : ""}`}
      testID={`start-${side}-button`}
    >
      <Text
        className="text-3xl font-bold mb-1"
        style={{ color: isSuggested ? "#FFFFFF" : accentColor }}
      >
        {shortLabel}
      </Text>
      <Text
        className="text-sm font-medium"
        style={{ color: isSuggested ? "#FFFFFF" : textColor }}
      >
        {label}
      </Text>
      {isSuggested && (
        <View className="bg-white/20 px-2 py-0.5 rounded-pill mt-1" testID="suggested-side-badge">
          <Text className="text-xs font-semibold text-white">{t("feeding.suggested")}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface BreastfeedingTimerViewProps {
  elapsedSeconds: number;
  side?: BreastSide;
  isPaused: boolean;
  onSideChange: (side: BreastSide) => void;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
  accentColor: string;
  buttonBgColor: string;
  mutedBg: string;
  secondaryBg: string;
  startedAt: Date;
  starterName: string;
  canEdit: boolean;
  getBounds(): TimerStartBounds;
  onEditStart: (startedAt: Date) => Promise<void>;
}

const PAUSED_AMBER = "#D4A017";

function BreastfeedingTimerView({ elapsedSeconds, side, isPaused, onSideChange, onStop, onPause, onResume, accentColor, buttonBgColor, mutedBg, secondaryBg, startedAt, starterName, canEdit, getBounds, onEditStart }: BreastfeedingTimerViewProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();
  const formattedTime = formatDuration(elapsedSeconds);

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="items-center w-full">
        {/* Activity indicator */}
        <View className="flex-row items-center mb-4">
          <Text className="text-4xl mr-3">🤱</Text>
          <Text style={{ color: accentColor }} className="text-lg font-semibold">
            {t("feeding.breastfeeding")}
          </Text>
        </View>

        {/* Side selector */}
        <View
          className="flex-row rounded-pill p-1 mb-8"
          style={{ backgroundColor: secondaryBg, opacity: isPaused ? 0.4 : 1 }}
          pointerEvents={isPaused ? "none" : "auto"}
        >
          <CompactSideButton label={t("feeding.leftShort")} fullLabel={t("feeding.left")} isSelected={side === "left"} onPress={() => onSideChange("left")} accentColor={accentColor} buttonBgColor={buttonBgColor} />
          <CompactSideButton label={t("feeding.bothShort")} fullLabel={t("feeding.both")} isSelected={side === "both"} onPress={() => onSideChange("both")} accentColor={accentColor} buttonBgColor={buttonBgColor} />
          <CompactSideButton label={t("feeding.rightShort")} fullLabel={t("feeding.right")} isSelected={side === "right"} onPress={() => onSideChange("right")} accentColor={accentColor} buttonBgColor={buttonBgColor} />
        </View>

        <RunningTimerStartEditor
          startLabel={t("feeding.startTime")}
          startedAt={startedAt}
          starterName={starterName}
          canEdit={canEdit}
          getBounds={getBounds}
          timeFormat={timeFormat}
          accentColor={accentColor}
          mutedBackgroundColor={secondaryBg}
          onEdit={onEditStart}
        />

        {/* Timer display */}
        <View
          testID="running-timer-elapsed"
          className="px-12 py-8 rounded-card-lg mb-8"
          style={{ backgroundColor: mutedBg }}
        >
          <Text
            className="text-timer-xl text-center font-bold tracking-tight"
            style={{ color: isPaused ? PAUSED_AMBER : accentColor, opacity: isPaused ? 0.5 : 1 }}
            accessibilityLabel={`${t("common.timer")}: ${formattedTime}`}
          >
            {formattedTime}
          </Text>
        </View>

        {/* Status indicator */}
        <View className="flex-row items-center mb-10">
          <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: isPaused ? PAUSED_AMBER : accentColor }} />
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
            {isPaused ? t("common.timerPaused") : t("feeding.timerRunning")}
          </Text>
        </View>

        {/* Pause + Stop buttons */}
        <View className="flex-row items-center gap-6">
          {onPause && onResume && (
            <Pressable
              onPress={isPaused ? onResume : onPause}
              className="w-16 h-16 rounded-full items-center justify-center active:scale-95 border-2"
              style={{ borderColor: accentColor, backgroundColor: isPaused ? accentColor : "transparent" }}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? t("common.resumeTimer") : t("common.pauseTimer")}
            >
              <Text className="text-2xl" style={{ color: isPaused ? "#FFFFFF" : accentColor }}>
                {isPaused ? "▶" : "⏸"}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onStop}
            className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
            style={{ backgroundColor: buttonBgColor }}
            accessibilityRole="button"
            accessibilityLabel={t("common.stopTimer")}
            testID="stop-timer-button"
          >
            <Text className="text-3xl text-white">⏹</Text>
          </Pressable>
        </View>

        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
          {isPaused ? t("common.tapToResume") : t("feeding.tapToStop")}
        </Text>
      </View>
    </View>
  );
}

interface CompactSideButtonProps {
  label: string;
  fullLabel: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  buttonBgColor: string;
}

function CompactSideButton({ label, fullLabel, isSelected, onPress, accentColor, buttonBgColor }: CompactSideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[64px] min-h-[48px] rounded-pill items-center justify-center px-4 active:scale-95"
      style={isSelected ? { backgroundColor: buttonBgColor } : undefined}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className={`text-base font-semibold ${isSelected ? "text-white" : ""}`}
        style={!isSelected ? { color: accentColor } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ============ BOTTLE COMPONENTS ============

interface BottleFormProps {
  selectedBaby: { id: string; name: string };
  addFeeding: (input: CreateFeedingInput) => Promise<StoredFeedingEntry>;
  onLogPast: () => void;
  onComplete: () => void;
  accentColor: string;
  buttonBgColor: string;
  mutedBg: string;
  secondaryBg: string;
}

function BottleForm({ selectedBaby, addFeeding, onLogPast, onComplete, accentColor, buttonBgColor, mutedBg, secondaryBg }: BottleFormProps) {
  const { t } = useTranslation();
  const { volumeUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const textColor = isDark ? TEXT.dark.primary : TEXT.light.primary;

  const [contentType, setContentType] = useState<BottleContentType | null>(null);
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [unit, setUnit] = useState<VolumeUnit>(volumeUnit);
  const [inputValue, setInputValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const handleQuickAmountSelect = useCallback((amount: number) => {
    if (unit === "oz") {
      setAmountMl(ozToMl(amount));
      setInputValue(amount.toString());
    } else {
      setAmountMl(amount);
      setInputValue(amount.toString());
    }
    setShowValidation(false);
    Keyboard.dismiss();
  }, [unit]);

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
    const value = parseFloat(text);
    if (!isNaN(value) && value > 0) {
      setAmountMl(unit === "oz" ? ozToMl(value) : value);
      setShowValidation(false);
    } else {
      setAmountMl(null);
    }
  }, [unit]);

  const handleUnitToggle = useCallback(() => {
    if (amountMl !== null) {
      setInputValue(unit === "oz" ? Math.round(amountMl).toString() : mlToOz(amountMl).toString());
    }
    setUnit((prev) => (prev === "oz" ? "ml" : "oz"));
  }, [unit, amountMl]);

  const handleSave = useCallback(async () => {
    if (!contentType || !amountMl || amountMl <= 0) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    try {
      await addFeeding({
        babyId: selectedBaby.id,
        type: "bottle",
        contentType,
        amountMl,
        startedAt: new Date(),
        notes: notes || undefined,
      });
      onComplete();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, contentType, amountMl, notes, addFeeding, onComplete]);

  const validationMessage = useMemo(() => {
    if (!showValidation) return null;
    if (!contentType && (!amountMl || amountMl <= 0)) return t("feeding.selectContentAndAmount");
    if (!contentType) return t("feeding.selectContentType");
    if (!amountMl || amountMl <= 0) return t("feeding.enterAmountValidation");
    return null;
  }, [showValidation, contentType, amountMl, t]);

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6" keyboardShouldPersistTaps="handled">
        {/* Illustration */}
        <View className="items-center mt-2 mb-4">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: secondaryBg }}>
            <Text className="text-4xl">🍼</Text>
          </View>
        </View>

        {/* Content Type Selection */}
        <View className="mb-5">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.selectContentType")}
          </Text>
          <View className="flex-row gap-3">
            <ContentTypeButton
              label={t("feeding.breastMilk")}
              emoji="🤱"
              isSelected={contentType === "breastMilk"}
              onPress={() => { setContentType("breastMilk"); setShowValidation(false); }}
              accentColor={accentColor}
              buttonBgColor={buttonBgColor}
              secondaryBg={secondaryBg}
              textColor={textColor}
              testID="content-breast-milk"
            />
            <ContentTypeButton
              label={t("feeding.formula")}
              emoji="🧪"
              isSelected={contentType === "formula"}
              onPress={() => { setContentType("formula"); setShowValidation(false); }}
              accentColor={accentColor}
              buttonBgColor={buttonBgColor}
              secondaryBg={secondaryBg}
              textColor={textColor}
              testID="content-formula"
            />
          </View>
        </View>

        {/* Amount Input */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
              {t("feeding.amount")}
            </Text>
            <UnitToggle unit={unit} onToggle={handleUnitToggle} accentColor={accentColor} buttonBgColor={buttonBgColor} secondaryBg={secondaryBg} />
          </View>

          <View className="flex-row items-center rounded-card-lg px-4 py-3 mb-3" style={{ backgroundColor: mutedBg }}>
            <TextInput
              className="flex-1 text-2xl font-semibold text-center"
              style={{ color: textColor }}
              value={inputValue}
              onChangeText={handleInputChange}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              returnKeyType="done"
              testID="volume-input"
            />
            <Text className="text-lg font-medium ml-2" style={{ color: accentColor }}>{unit}</Text>
          </View>

          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.quickAmounts")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(unit === "oz" ? QUICK_AMOUNTS_OZ : QUICK_AMOUNTS_ML).map((amount) => (
              <QuickAmountButton
                key={amount}
                amount={amount}
                isSelected={unit === "oz" ? amountMl !== null && Math.abs(ozToMl(amount) - amountMl) < 1 : amountMl === amount}
                onPress={() => handleQuickAmountSelect(amount)}
                accentColor={accentColor}
                buttonBgColor={buttonBgColor}
                secondaryBg={secondaryBg}
                testID={`quick-amount-${amount}`}
              />
            ))}
          </View>
        </View>

        {/* Notes */}
        <View className="mb-4">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("common.notes")}
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={{ minHeight: 60 }}
          />
        </View>

        {/* Amount preview */}
        {amountMl !== null && amountMl > 0 && (
          <View className="items-center mb-4">
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {formatVolume(amountMl, "ml")} = {formatVolume(amountMl, "oz")}
            </Text>
          </View>
        )}

        {/* Log Past Button */}
        <View className="items-center mt-4 mb-6">
          <Pressable onPress={onLogPast} className="py-3 px-6 rounded-button-lg active:opacity-70" style={{ backgroundColor: secondaryBg }}>
            <Text className="text-base font-medium" style={{ color: accentColor }}>{t("feeding.logPastBottle")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Save Button */}
      <View className="px-6 pb-6 pt-3 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        {validationMessage && (
          <View className="mb-3 items-center">
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center">{validationMessage}</Text>
          </View>
        )}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${isSaving ? "opacity-50" : ""}`}
          style={{ backgroundColor: buttonBgColor }}
          testID="save-bottle-button"
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("feeding.logBottleFeeding")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

interface ContentTypeButtonProps {
  label: string;
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  buttonBgColor: string;
  secondaryBg: string;
  textColor: string;
  testID?: string;
}

function ContentTypeButton({ label, emoji, isSelected, onPress, buttonBgColor, secondaryBg, textColor, testID }: ContentTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{ backgroundColor: isSelected ? buttonBgColor : secondaryBg }}
      testID={testID}
    >
      <Text className="text-3xl mb-2">{emoji}</Text>
      <Text className="text-base font-medium" style={{ color: isSelected ? "#FFFFFF" : textColor }}>
        {label}
      </Text>
    </Pressable>
  );
}

interface UnitToggleProps {
  unit: VolumeUnit;
  onToggle: () => void;
  accentColor: string;
  buttonBgColor: string;
  secondaryBg: string;
}

function UnitToggle({ unit, onToggle, accentColor, buttonBgColor, secondaryBg }: UnitToggleProps) {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onToggle} className="flex-row rounded-pill p-1" style={{ backgroundColor: secondaryBg }}>
      <View className="px-3 py-1 rounded-pill" style={unit === "oz" ? { backgroundColor: buttonBgColor } : undefined}>
        <Text className="text-sm font-semibold" style={{ color: unit === "oz" ? "#FFFFFF" : accentColor }}>{t("feeding.oz")}</Text>
      </View>
      <View className="px-3 py-1 rounded-pill" style={unit === "ml" ? { backgroundColor: buttonBgColor } : undefined}>
        <Text className="text-sm font-semibold" style={{ color: unit === "ml" ? "#FFFFFF" : accentColor }}>{t("feeding.ml")}</Text>
      </View>
    </Pressable>
  );
}

interface QuickAmountButtonProps {
  amount: number;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  buttonBgColor: string;
  secondaryBg: string;
  testID?: string;
}

function QuickAmountButton({ amount, isSelected, onPress, accentColor, buttonBgColor, secondaryBg, testID }: QuickAmountButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="min-w-[56px] py-2 px-3 rounded-button-lg items-center active:scale-95"
      style={{ backgroundColor: isSelected ? buttonBgColor : secondaryBg }}
      testID={testID}
    >
      <Text className="text-base font-semibold" style={{ color: isSelected ? "#FFFFFF" : accentColor }}>
        {amount}
      </Text>
    </Pressable>
  );
}

// ============ SOLIDS COMPONENTS ============

interface SolidsFormProps {
  selectedBaby: { id: string; name: string };
  addFeeding: (input: CreateFeedingInput) => Promise<StoredFeedingEntry>;
  feedings: Array<{ type: string; foodType?: string; startedAt: string | Date }>;
  onLogPast: () => void;
  onComplete: () => void;
  accentColor: string;
  buttonBgColor: string;
  mutedBg: string;
  secondaryBg: string;
}

function SolidsForm({ selectedBaby, addFeeding, feedings, onLogPast, onComplete, accentColor, buttonBgColor, mutedBg, secondaryBg }: SolidsFormProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const textColor = isDark ? TEXT.dark.primary : TEXT.light.primary;

  const [foodType, setFoodType] = useState("");
  const [reaction, setReaction] = useState<SolidReaction | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const recentFoods = useMemo(() => {
    const solidFeedings = feedings
      .filter((f) => f.type === "solid" && f.foodType)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const uniqueFoods: string[] = [];
    for (const f of solidFeedings) {
      if (f.foodType && !uniqueFoods.includes(f.foodType)) {
        uniqueFoods.push(f.foodType);
      }
      if (uniqueFoods.length >= 6) break;
    }
    return uniqueFoods;
  }, [feedings]);

  const suggestedFoods = useMemo(() => {
    return recentFoods.length > 0 ? recentFoods : COMMON_FOODS.slice(0, 8);
  }, [recentFoods]);

  const getFoodLabel = (food: string): string => {
    const foodLabels: Record<string, string> = {
      banana: t("foods.banana"), avocado: t("foods.avocado"), apple: t("foods.apple"),
      pear: t("foods.pear"), mango: t("foods.mango"), peach: t("foods.peach"),
      blueberries: t("foods.blueberries"), strawberries: t("foods.strawberries"),
      sweetPotato: t("foods.sweetPotato"), carrot: t("foods.carrot"), peas: t("foods.peas"),
      broccoli: t("foods.broccoli"), zucchini: t("foods.zucchini"), spinach: t("foods.spinach"),
      butternutSquash: t("foods.butternutSquash"), greenBeans: t("foods.greenBeans"),
      chicken: t("foods.chicken"), turkey: t("foods.turkey"), beef: t("foods.beef"),
      egg: t("foods.egg"), tofu: t("foods.tofu"), lentils: t("foods.lentils"),
      salmon: t("foods.salmon"), oatmeal: t("foods.oatmeal"), rice: t("foods.rice"),
      pasta: t("foods.pasta"), bread: t("foods.bread"), cereal: t("foods.cereal"),
      yogurt: t("foods.yogurt"), cheese: t("foods.cheese"),
    };
    return foodLabels[food] || food.charAt(0).toUpperCase() + food.slice(1).replace(/([A-Z])/g, " $1");
  };

  const handleSave = useCallback(async () => {
    if (!foodType.trim()) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    try {
      await addFeeding({
        babyId: selectedBaby.id,
        type: "solid",
        foodType: foodType.trim(),
        reaction: reaction ?? undefined,
        startedAt: new Date(),
        notes: notes || undefined,
      });
      onComplete();
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, foodType, reaction, notes, addFeeding, onComplete]);

  const validationMessage = useMemo(() => {
    if (!showValidation) return null;
    if (!foodType.trim()) return t("feeding.enterFoodValidation");
    return null;
  }, [showValidation, foodType, t]);

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6" keyboardShouldPersistTaps="handled">
        {/* Illustration */}
        <View className="items-center mt-2 mb-4">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: secondaryBg }}>
            <Text className="text-4xl">🥣</Text>
          </View>
        </View>

        {/* Food Selection */}
        <View className="mb-5">
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2">
            {t("feeding.selectFood")}
          </Text>

          <View className="flex-row items-center min-h-[48px] px-4 rounded-2xl mb-3" style={{ backgroundColor: mutedBg }}>
            <TextInput
              className="flex-1"
              style={{ fontSize: 16, lineHeight: 20, paddingVertical: 6, color: textColor }}
              value={foodType}
              onChangeText={(text) => { setFoodType(text); if (text.trim()) setShowValidation(false); }}
              placeholder={t("feeding.foodPlaceholder")}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
            />
          </View>

          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
            {recentFoods.length > 0 ? t("feeding.recentFoods") : t("feeding.commonFoods")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestedFoods.map((food) => (
              <FoodButton
                key={food}
                label={getFoodLabel(food)}
                isSelected={foodType === food}
                onPress={() => { setFoodType(food); setShowValidation(false); Keyboard.dismiss(); }}
                accentColor={accentColor}
                buttonBgColor={buttonBgColor}
                secondaryBg={secondaryBg}
              />
            ))}
          </View>
        </View>

        {/* Reaction Selection */}
        <View className="mb-5">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("feeding.howDidBabyLikeIt")}
          </Text>
          <View className="flex-row gap-3">
            <ReactionButton emoji="😍" label={t("feeding.loved")} isSelected={reaction === "loved"} onPress={() => setReaction("loved")} accentColor={accentColor} buttonBgColor={buttonBgColor} secondaryBg={secondaryBg} textColor={textColor} />
            <ReactionButton emoji="😐" label={t("feeding.meh")} isSelected={reaction === "meh"} onPress={() => setReaction("meh")} accentColor={accentColor} buttonBgColor={buttonBgColor} secondaryBg={secondaryBg} textColor={textColor} />
            <ReactionButton emoji="😣" label={t("feeding.refused")} isSelected={reaction === "refused"} onPress={() => setReaction("refused")} accentColor={accentColor} buttonBgColor={buttonBgColor} secondaryBg={secondaryBg} textColor={textColor} />
          </View>
        </View>

        {/* Notes */}
        <View className="mb-4">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
            {t("common.notes")}
          </Text>
          <TextInput
            className="rounded-card-lg px-4 py-3 text-base bg-surface-secondary dark:bg-surface-dark-secondary text-content-primary dark:text-content-dark-primary"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("feeding.notesPlaceholder")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={{ minHeight: 60 }}
          />
        </View>

        {/* Log Past Button */}
        <View className="items-center mt-4 mb-6">
          <Pressable onPress={onLogPast} className="py-3 px-6 rounded-button-lg active:opacity-70" style={{ backgroundColor: secondaryBg }}>
            <Text className="text-base font-medium" style={{ color: accentColor }}>{t("feeding.logPastSolid")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Save Button */}
      <View className="px-6 pb-6 pt-3 bg-surface dark:bg-surface-dark border-t border-gray-100 dark:border-gray-800">
        {validationMessage && (
          <View className="mb-3 items-center">
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center">{validationMessage}</Text>
          </View>
        )}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${isSaving ? "opacity-50" : ""}`}
          style={{ backgroundColor: buttonBgColor }}
          testID="save-solids-button"
        >
          <Text className="text-lg font-semibold text-white">
            {isSaving ? t("common.loading") : t("feeding.logSolidFeeding")}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

interface FoodButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  buttonBgColor: string;
  secondaryBg: string;
}

function FoodButton({ label, isSelected, onPress, accentColor, buttonBgColor, secondaryBg }: FoodButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="py-2 px-4 rounded-button-lg active:scale-95"
      style={{ backgroundColor: isSelected ? buttonBgColor : secondaryBg }}
    >
      <Text className="text-base font-medium" style={{ color: isSelected ? "#FFFFFF" : accentColor }}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ReactionButtonProps {
  emoji: string;
  label: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  buttonBgColor: string;
  secondaryBg: string;
  textColor: string;
}

function ReactionButton({ emoji, label, isSelected, onPress, buttonBgColor, secondaryBg, textColor }: ReactionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-4 rounded-card-lg active:scale-[0.97]"
      style={{ backgroundColor: isSelected ? buttonBgColor : secondaryBg }}
    >
      <Text className="text-2xl mb-1">{emoji}</Text>
      <Text className="text-sm font-semibold" style={{ color: isSelected ? "#FFFFFF" : textColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
