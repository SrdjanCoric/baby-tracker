import { Animated, Easing, Image, type ImageSourcePropType, Platform, Pressable, Text, View, useColorScheme } from "react-native";
import { SleepPredictionInfoModal } from "./SleepPredictionInfoModal";
import { useTimeRefresh } from "@/hooks/useTimeRefresh";
import { memo, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSleep, useBaby } from "@/contexts";
import { useActiveTimers } from "@/contexts/active-timers-context";
import type { ActiveSleepTimer } from "@/contexts/sleep-context";
import type { SleepType } from "@/constants/activities";
import {
  predictNextSleep,
  getQualifyingNightSleep,
  getMorningThreshold,
} from "@/utils/sleepPredictions";
import type { SleepPrediction, SleepPredictionModel } from "@/utils/sleepPredictions";
import { isUnderTwoMonths } from "@/utils/sleepGoals";
import { formatDurationShort, formatTime, type TranslateFn } from "@/utils/time";
import { useTimeFormat } from "@/contexts/time-format-context";
import { SleepStorageService } from "@/services/sleep-storage";

interface SleepPredictionCardProps {
  babyName?: string;
}

type CardState =
  | "under_two_months"
  | "setup_required"
  | "need_more_data"
  | "track_sleep"
  | "computing"
  | "sleeping_nap"
  | "sleeping_night"
  | "nighttime"
  | "overdue"
  | "prediction";

const SleepPredictionCardInner = ({
  babyName,
}: SleepPredictionCardProps) => {
  const { t } = useTranslation();
  const tFn = t as TranslateFn;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const {
    sleepPredictionModel: model,
    isComputingModel,
    activeTimer,
    sleeps,
    wakeWindowConfig,
    qualifyingDayCount,
    predictionBannerDismissed,
    getCompletedNapsSinceNightSleep,
    getLastSleep,
    dismissPredictionBanner,
    setDayNightBoundary,
    driftDetection,
    dismissDrift,
    acceptDrift,
  } = useSleep();

  const { getLockForActivity } = useActiveTimers();

  const remoteSleepLock = useMemo(() => {
    if (activeTimer || !selectedBaby?.id) return null;
    return getLockForActivity(selectedBaby.id, "sleep");
  }, [activeTimer, selectedBaby?.id, getLockForActivity]);

  const effectiveActiveTimer = useMemo((): ActiveSleepTimer | null => {
    if (activeTimer) return activeTimer;
    if (!remoteSleepLock) return null;
    const sleepType = (remoteSleepLock.timerData?.type as SleepType) ?? "nap";
    return {
      isRunning: true,
      isPaused: false,
      startTime: new Date(remoteSleepLock.startedAt),
      sleepType,
      totalPausedMs: 0,
    };
  }, [activeTimer, remoteSleepLock]);

  const birthDate = selectedBaby?.birthDate;
  const dayStartHour = wakeWindowConfig?.dayStartHour;
  const dayEndHour = wakeWindowConfig?.dayEndHour;
  const effectiveDayStart = dayStartHour ?? 6;
  const effectiveDayEnd = dayEndHour ?? 19;
  const hasDayBoundaries = wakeWindowConfig?.dayBoundariesConfigured === true;

  const [selectedNapCount, setSelectedNapCountState] = useState<number | null>(null);
  const [loadedPersistedNapCount, setLoadedPersistedNapCount] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [setupDayStart, setSetupDayStart] = useState(7);
  const [setupDayEnd, setSetupDayEnd] = useState(19);
  const [showDayStartPicker, setShowDayStartPicker] = useState(false);
  const [showDayEndPicker, setShowDayEndPicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const overdueTickMinute = useTimeRefresh(60000);

  const [transitionTick, setTransitionTick] = useState(0);

  const hasNightSleepToday = useMemo((): boolean => {
    const threshold = getMorningThreshold(effectiveDayStart);
    return getQualifyingNightSleep(sleeps, threshold) !== null;
  }, [sleeps, effectiveDayStart]);

  const hasPredictionData = useMemo((): boolean => {
    if (!hasNightSleepToday) return false;
    const hasModel = !!(model || (wakeWindowConfig?.source === "custom" && wakeWindowConfig?.slots?.length));
    const lastSleep = getLastSleep();
    return hasModel && !!lastSleep?.endedAt;
  }, [hasNightSleepToday, model, wakeWindowConfig, getLastSleep]);

  const cardState = useMemo((): CardState | null => {
    if (isUnderTwoMonths(birthDate)) {
      if (!predictionBannerDismissed) return "under_two_months";
      return null;
    }

    if (!isUnderTwoMonths(birthDate) && !hasDayBoundaries) {
      return "setup_required";
    }

    if (isComputingModel) {
      return "computing";
    }

    if (effectiveActiveTimer) {
      return effectiveActiveTimer.sleepType === "nap" ? "sleeping_nap" : "sleeping_night";
    }

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    const morningThreshold = getMorningThreshold(effectiveDayStart);
    if (currentHour < morningThreshold) {
      return "nighttime";
    }

    if (currentHour >= effectiveDayEnd) {
      const lastSleep = getLastSleep();
      if (lastSleep?.endedAt) {
        if (lastSleep.type === "night") return "nighttime";
        if (lastSleep.type === "nap") {
          const endedAtHour = new Date(lastSleep.endedAt).getHours() + new Date(lastSleep.endedAt).getMinutes() / 60;
          if (endedAtHour >= effectiveDayEnd) return "nighttime";
        }
      }
      if (!hasPredictionData) return "nighttime";
    }

    if (!hasNightSleepToday) {
      return "track_sleep";
    }

    if (hasDayBoundaries && qualifyingDayCount < 5) {
      return "need_more_data";
    }

    return "prediction";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthDate, predictionBannerDismissed, hasDayBoundaries, isComputingModel, effectiveActiveTimer, effectiveDayStart, effectiveDayEnd, hasNightSleepToday, hasPredictionData, qualifyingDayCount, getLastSleep, transitionTick]);

  useEffect(() => {
    const needsTransition = !effectiveActiveTimer && cardState === "prediction";
    if (!needsTransition) return;
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour < effectiveDayEnd) return;
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => setTransitionTick((t) => t + 1), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [effectiveActiveTimer, cardState, effectiveDayEnd, transitionTick]);

  useEffect(() => {
    if (effectiveActiveTimer || cardState !== "nighttime") return;
    const now = new Date();
    const threshold = getMorningThreshold(effectiveDayStart);
    const thresholdDate = new Date(now);
    thresholdDate.setHours(Math.floor(threshold), Math.round((threshold % 1) * 60), 0, 0);
    if (thresholdDate.getTime() <= now.getTime()) return;
    const ms = thresholdDate.getTime() - now.getTime();
    const timer = setTimeout(() => setTransitionTick((t) => t + 1), ms);
    return () => clearTimeout(timer);
  }, [effectiveActiveTimer, cardState, effectiveDayStart, transitionTick]);

  useEffect(() => {
    if (cardState !== "sleeping_nap" || !effectiveActiveTimer) {
      setElapsed(0);
      return;
    }

    const compute = () => {
      const ms = Date.now() - effectiveActiveTimer.startTime.getTime() - (effectiveActiveTimer.totalPausedMs || 0);
      setElapsed(Math.max(0, Math.floor(ms / 1000)));
    };

    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [cardState, effectiveActiveTimer]);

  const lastWakeTime = useMemo((): Date | null => {
    if (effectiveActiveTimer) return null;
    const lastSleep = getLastSleep();
    if (!lastSleep?.endedAt) return null;
    return new Date(lastSleep.endedAt);
  }, [effectiveActiveTimer, getLastSleep]);

  const manualModel = useMemo((): SleepPredictionModel | null => {
    if (wakeWindowConfig?.source !== "custom" || !wakeWindowConfig.slots.length) return null;
    const slots = wakeWindowConfig.slots;
    const napSlots = slots.filter((s) => s.label !== "bedtime");
    const bedtimeSlot = slots.find((s) => s.label === "bedtime");
    const napCount = napSlots.length;

    const startRelativeWakeWindows: Record<string, number> = {};
    napSlots.forEach((s, i) => {
      startRelativeWakeWindows[String(i)] = s.durationMinutes;
    });

    const penultimate = napCount > 1
      ? napSlots[napCount - 1].durationMinutes
      : napSlots[0]?.durationMinutes ?? 120;

    return {
      primaryNapCount: napCount,
      secondaryNapCount: null,
      startRelativeWakeWindows,
      penultimateWakeWindow: penultimate,
      bedtimeWakeWindow: bedtimeSlot?.durationMinutes ?? 120,
      medianNapDuration: model?.medianNapDuration ?? 60,
      napCountDistribution: { [napCount]: 7 },
    };
  }, [wakeWindowConfig, model?.medianNapDuration]);

  const effectiveModel = manualModel ?? model;

  useEffect(() => {
    if (!selectedBaby?.id) return;
    SleepStorageService.getSelectedNapCount(selectedBaby.id).then((count) => {
      if (count !== null) {
        setSelectedNapCountState(count);
      }
      setLoadedPersistedNapCount(true);
    }).catch(() => {
      setLoadedPersistedNapCount(true);
    });
  }, [selectedBaby?.id]);

  useEffect(() => {
    if (!effectiveModel) return;
    if (!loadedPersistedNapCount) return;
    if (selectedNapCount !== null) return;
    setSelectedNapCountState(effectiveModel.primaryNapCount);
  }, [effectiveModel, loadedPersistedNapCount, selectedNapCount]);

  const setSelectedNapCount = useCallback((count: number) => {
    setSelectedNapCountState(count);
    if (selectedBaby?.id) {
      SleepStorageService.setSelectedNapCount(selectedBaby.id, count).catch(() => {});
    }
  }, [selectedBaby?.id]);

  const prediction = useMemo((): SleepPrediction | null => {
    if (cardState !== "prediction" && cardState !== "need_more_data") return null;
    if (!effectiveModel || !lastWakeTime || selectedNapCount === null) return null;
    if (!hasNightSleepToday) return null;

    const completedNaps = getCompletedNapsSinceNightSleep();
    return predictNextSleep(effectiveModel, selectedNapCount, completedNaps, lastWakeTime, effectiveDayEnd);
  }, [cardState, effectiveModel, lastWakeTime, selectedNapCount, hasNightSleepToday, getCompletedNapsSinceNightSleep, effectiveDayEnd]);

  const isOverdue = useMemo((): boolean => {
    if (!prediction) return false;
    return prediction.predictedTime.getTime() < Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction, overdueTickMinute]);

  const overdueMinutes = useMemo((): number => {
    if (!prediction || !isOverdue) return 0;
    return Math.floor((Date.now() - prediction.predictedTime.getTime()) / 60000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction, isOverdue, overdueTickMinute]);

  const handleInfoPress = useCallback(() => {
    setShowInfoModal(true);
  }, []);

  const handleManualWakeWindows = useCallback(() => {
    router.push("/sleep/settings" as Parameters<typeof router.push>[0]);
  }, [router]);

  const handleSetupSave = useCallback(async () => {
    await setDayNightBoundary(setupDayStart, setupDayEnd);
    setShowSetup(false);
  }, [setupDayStart, setupDayEnd, setDayNightBoundary]);

  const handleDayStartPickerChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDayStartPicker(false);
    }
    if (selectedDate) {
      setSetupDayStart(selectedDate.getHours() + selectedDate.getMinutes() / 60);
    }
  }, []);

  const handleDayEndPickerChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDayEndPicker(false);
    }
    if (selectedDate) {
      setSetupDayEnd(selectedDate.getHours() + selectedDate.getMinutes() / 60);
    }
  }, []);

  const sleepAccent = isDark ? "#A68DC8" : "#8B7BA0";
  const sleepAccentSoft = isDark ? "#C4ADE0" : "#6B5A80";
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.60)" : "#7A7570";
  const cardBg = isDark ? "#2A2725" : "#F0EEEC";
  const borderColor = isDark ? "#353039" : "rgba(139,123,160,0.18)";
  const topBorderColor = isDark ? "#4C4357" : "rgba(139,123,160,0.35)";
  const segBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const segInactiveText = isDark ? textSecondary : "#7A7570";
  const infoBg = isDark ? "rgba(166,141,200,0.12)" : "rgba(139,123,160,0.10)";
  const overdueColor = isDark ? "#E8A87C" : "#D4845A";

  const makeTimeDate = (fractionalHour: number): Date => {
    const d = new Date();
    const h = Math.floor(fractionalHour);
    const m = Math.round((fractionalHour - h) * 60);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const formatHour = (fractionalHour: number): string => {
    const d = makeTimeDate(fractionalHour);
    return formatTime(d, timeFormat);
  };

  const overdueHeaderColor = isDark ? "#DCA06E" : "#B47838";

  const stateImage = useMemo((): ImageSourcePropType | null => {
    if (cardState === "sleeping_nap" || cardState === "sleeping_night") {
      return require("../../assets/images/sleepy-baby.png");
    }
    if (cardState === "nighttime") {
      return require("../../assets/images/nighttime.png");
    }
    if (cardState === "prediction" || cardState === "need_more_data") {
      if (isOverdue) {
        return require("../../assets/images/overdue-baby.png");
      }
      return require("../../assets/images/happy-baby.png");
    }
    return null;
  }, [cardState, isOverdue]);

  const renderHeader = () => (
    <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2, color: isOverdue ? overdueHeaderColor : sleepAccent, marginBottom: 12 }}>
      {t("dashboard.sleepPrediction")}
    </Text>
  );

  const renderContent = () => {
    if (cardState === null) return null;

    if (cardState === "under_two_months") {
      return (
        <>
          {renderHeader()}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary, marginBottom: 8 }}>
                {t("dashboard.startAt2Months")}
              </Text>
              <Pressable onPress={handleManualWakeWindows} hitSlop={4}>
                <Text style={{ fontSize: 12, color: sleepAccent, fontWeight: "600" }}>
                  {t("dashboard.manualWakeWindows")}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={dismissPredictionBanner}
              hitSlop={8}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: infoBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: textSecondary }}>✕</Text>
            </Pressable>
          </View>
        </>
      );
    }

    if (cardState === "setup_required") {
      if (showSetup) {
        return (
          <>
            {renderHeader()}
            <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary, marginBottom: 4 }}>
              {t("dashboard.setupTitle")}
            </Text>
            <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 16 }}>
              {t("dashboard.setupDescription")}
            </Text>

            <View style={{ gap: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary }}>
                  {t("dashboard.dayStartLabel")}
                </Text>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={makeTimeDate(setupDayStart)}
                    mode="time"
                    display="compact"

                    onChange={handleDayStartPickerChange}
                    themeVariant={isDark ? "dark" : "light"}
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => setShowDayStartPicker(true)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        backgroundColor: segBg,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: sleepAccent }}>
                        {formatHour(setupDayStart)}
                      </Text>
                    </Pressable>
                    {showDayStartPicker && (
                      <DateTimePicker
                        value={makeTimeDate(setupDayStart)}
                        mode="time"
                        display="spinner"
    
                        onChange={handleDayStartPickerChange}
                      />
                    )}
                  </>
                )}
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary }}>
                  {t("dashboard.dayEndLabel")}
                </Text>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={makeTimeDate(setupDayEnd)}
                    mode="time"
                    display="compact"

                    onChange={handleDayEndPickerChange}
                    themeVariant={isDark ? "dark" : "light"}
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => setShowDayEndPicker(true)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        backgroundColor: segBg,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: sleepAccent }}>
                        {formatHour(setupDayEnd)}
                      </Text>
                    </Pressable>
                    {showDayEndPicker && (
                      <DateTimePicker
                        value={makeTimeDate(setupDayEnd)}
                        mode="time"
                        display="spinner"
    
                        onChange={handleDayEndPickerChange}
                      />
                    )}
                  </>
                )}
              </View>
            </View>

            <Pressable
              onPress={handleSetupSave}
              style={{
                backgroundColor: sleepAccent,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                {t("dashboard.setupSave")}
              </Text>
            </Pressable>
          </>
        );
      }

      return (
        <>
          {renderHeader()}
          <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary, marginBottom: 12 }}>
            {t("dashboard.setupTitle")}
          </Text>
          <Pressable
            onPress={() => setShowSetup(true)}
            style={{
              backgroundColor: sleepAccent,
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              {t("dashboard.setupButton")}
            </Text>
          </Pressable>
        </>
      );
    }

    if (cardState === "need_more_data") {
      const daysRemaining = Math.max(0, 5 - qualifyingDayCount);

      return (
        <>
          {renderHeader()}

          {renderPredictionContent()}
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: borderColor }}>
            <Text style={{ fontSize: 11, color: textSecondary, fontStyle: "italic" }}>
              {t("dashboard.ageBasedNote", { count: daysRemaining })}
            </Text>
            <Pressable onPress={handleManualWakeWindows} hitSlop={4} style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: sleepAccent, fontWeight: "600" }}>
                {t("dashboard.manualWakeWindows")}
              </Text>
            </Pressable>
          </View>
        </>
      );
    }

    if (cardState === "computing") {
      return (
        <>
          {renderHeader()}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LoadingDots color={sleepAccent} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary }}>
              {babyName
                ? t("dashboard.computing", { name: babyName })
                : t("dashboard.computingGeneric")}
            </Text>
          </View>
        </>
      );
    }

    if (cardState === "sleeping_nap") {
      const totalMinutes = Math.floor(elapsed / 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const elapsedStr = formatDurationShort(h, m, tFn);

      return (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <PulsingDot color={sleepAccent} />
            <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2, color: sleepAccent }}>
              {t("dashboard.sleepPrediction")}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? textPrimary : "#3D3350" }}>
            {babyName
              ? t("dashboard.isSleeping", { name: babyName })
              : t("dashboard.isSleepingGeneric")}
          </Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginTop: 4 }}>
            {elapsedStr}
          </Text>
        </>
      );
    }

    if (cardState === "sleeping_night") {
      return (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <PulsingDot color={sleepAccent} />
            <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2, color: sleepAccent }}>
              {t("dashboard.sleepPrediction")}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? textPrimary : "#3D3350" }}>
            {babyName
              ? t("dashboard.isSleeping", { name: babyName })
              : t("dashboard.isSleepingGeneric")}
          </Text>
        </>
      );
    }

    if (cardState === "nighttime") {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const label = currentHour >= effectiveDayEnd && currentHour < 24
        ? t("dashboard.bedtime")
        : t("dashboard.nighttime");

      return (
        <>
          {renderHeader()}
          <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? textPrimary : "#3D3350" }}>
            {label}
          </Text>
        </>
      );
    }

    if (cardState === "track_sleep") {
      return (
        <>
          {renderHeader()}
          <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary }}>
            {t("dashboard.trackSleep")}
          </Text>
        </>
      );
    }

    if (!prediction || !effectiveModel || selectedNapCount === null) return null;

    return renderPredictionContent();
  };

  const formatOverdueTime = (minutes: number, type: "nap" | "bedtime"): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const key = type === "bedtime" ? "dashboard.bedtimeAgo" : "dashboard.napTimeAgo";
    return t(key, { time: formatDurationShort(h, m, tFn) });
  };

  const renderPredictionContent = () => {
    if (!prediction || !effectiveModel || selectedNapCount === null) return null;

    const predictedTimeStr = formatTime(prediction.predictedTime, timeFormat);


    const label = isOverdue
      ? formatOverdueTime(overdueMinutes, prediction.type)
      : prediction.type === "bedtime"
        ? t("dashboard.bedtimeNear")
        : t("dashboard.napTimeNear");

    const hasSecondary = effectiveModel.secondaryNapCount !== null;

    return (
      <>
        {cardState !== "need_more_data" && renderHeader()}

        <Text style={{ fontSize: 15, fontWeight: "700", color: isOverdue ? overdueColor : (isDark ? textPrimary : "#3D3350"), marginBottom: 16 }}>
          {label}{" "}
          {!isOverdue && (
            <Text style={{ fontWeight: "900", fontSize: 16, color: sleepAccentSoft }}>
              {predictedTimeStr}
            </Text>
          )}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          {hasSecondary ? (
            <View style={{ flexDirection: "row", backgroundColor: segBg, borderRadius: 8, overflow: "hidden" }}>
              <Pressable
                onPress={() => setSelectedNapCount(effectiveModel.primaryNapCount)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: selectedNapCount === effectiveModel.primaryNapCount ? sleepAccent : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: selectedNapCount === effectiveModel.primaryNapCount ? "#FFFFFF" : segInactiveText }}>
                  {t("dashboard.napDayCount", { count: effectiveModel.primaryNapCount })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedNapCount(effectiveModel.secondaryNapCount!)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: selectedNapCount === effectiveModel.secondaryNapCount ? sleepAccent : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: selectedNapCount === effectiveModel.secondaryNapCount ? "#FFFFFF" : segInactiveText }}>
                  {t("dashboard.napDayCount", { count: effectiveModel.secondaryNapCount! })}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: "700", color: textSecondary }}>
              {t("dashboard.napDayCount", { count: selectedNapCount })}
            </Text>
          )}
          <Pressable
            onPress={handleInfoPress}
            hitSlop={8}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: infoBg,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.predictionInfo")}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: sleepAccent }}>i</Text>
          </Pressable>
        </View>
      </>
    );
  };

  const driftBannerBg = isDark ? "rgba(166,141,200,0.08)" : "rgba(139,123,160,0.06)";
  const driftBtnBg = isDark ? "rgba(166,141,200,0.15)" : "rgba(139,123,160,0.12)";

  const renderDriftBanner = () => {
    if (!driftDetection) return null;

    const isBedtime = driftDetection.type === "bedtime";
    const suggestedTimeStr = formatHour(driftDetection.suggestedHour);
    const currentTimeStr = formatHour(driftDetection.currentHour);

    const title = isBedtime
      ? t("dashboard.driftBedtimeTitle")
      : t("dashboard.driftMorningTitle");
    const body = isBedtime
      ? t("dashboard.driftBedtimeBody", { time: suggestedTimeStr })
      : t("dashboard.driftMorningBody", { time: suggestedTimeStr });
    const updateLabel = isBedtime
      ? t("dashboard.driftBedtimeUpdate", { time: suggestedTimeStr })
      : t("dashboard.driftMorningUpdate", { time: suggestedTimeStr });
    const keepLabel = isBedtime
      ? t("dashboard.driftBedtimeKeep", { time: currentTimeStr })
      : t("dashboard.driftMorningKeep", { time: currentTimeStr });

    return (
      <View style={{ backgroundColor: driftBannerBg, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: sleepAccent, marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 12 }}>
          {body}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={acceptDrift}
            style={{
              flex: 1,
              backgroundColor: sleepAccent,
              borderRadius: 8,
              paddingVertical: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
              {updateLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={dismissDrift}
            style={{
              flex: 1,
              backgroundColor: driftBtnBg,
              borderRadius: 8,
              paddingVertical: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: textSecondary }}>
              {keepLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const effectiveCardState = isOverdue ? "overdue" : cardState;

  const overdueBg = isDark ? "#2D2723" : "#F7F1EC";
  const overdueBorder = "rgba(220,160,110,0.2)";
  const overdueTopBorder = isDark ? "rgba(220,160,110,0.4)" : "rgba(220,160,110,0.35)";

  const content = renderContent();
  const isOver2Months = !isUnderTwoMonths(birthDate);
  if (!content && !isOver2Months) return null;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: effectiveCardState === "overdue" ? overdueBorder : borderColor,
        borderTopWidth: 2,
        borderTopColor: effectiveCardState === "overdue" ? overdueTopBorder : topBorderColor,
        backgroundColor: effectiveCardState === "overdue" ? overdueBg : cardBg,
      }}
    >
      <View
        style={{ padding: 20, paddingHorizontal: 22, borderRadius: 15, overflow: "hidden" }}
      >
        {renderDriftBanner()}
        <View style={stateImage ? { flexDirection: "row", alignItems: "center", gap: 12 } : undefined}>
          <View style={stateImage ? { flex: 1 } : undefined}>
            {content || renderHeader()}
          </View>
          {stateImage && (
            <Image
              source={stateImage}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
      <SleepPredictionInfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        onOpenSettings={handleManualWakeWindows}
      />
    </View>
  );
};

const PulsingDot = ({ color }: { color: string }) => (
  <View
    style={{
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: color,
    }}
  />
);

const LoadingDots = ({ color }: { color: string }) => {
  const anim1 = useRef(new Animated.Value(0.3)).current;
  const anim2 = useRef(new Animated.Value(0.3)).current;
  const anim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 400, easing: Easing.ease, useNativeDriver: true }),
        ])
      );

    const a1 = animate(anim1, 0);
    const a2 = animate(anim2, 200);
    const a3 = animate(anim3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [anim1, anim2, anim3]);

  const dotStyle = (opacity: Animated.Value) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color,
    opacity,
    marginHorizontal: 2,
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Animated.View style={dotStyle(anim1)} />
      <Animated.View style={dotStyle(anim2)} />
      <Animated.View style={dotStyle(anim3)} />
    </View>
  );
};

const SleepPredictionCard = memo(SleepPredictionCardInner);

export { SleepPredictionCard, type SleepPredictionCardProps };
