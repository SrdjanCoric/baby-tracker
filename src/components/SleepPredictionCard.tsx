import { Animated, Easing, Image, type ImageSourcePropType, Platform, Pressable, Text, View, useColorScheme } from "react-native";
import { SleepPredictionInfoModal } from "./SleepPredictionInfoModal";
import { useTimeRefresh } from "@/hooks/useTimeRefresh";
import { memo, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import DateTimePicker, { DateTimePickerEvent, AndroidNativeProps } from "@react-native-community/datetimepicker";
import RNDatePicker from "react-native-date-picker";
import { useSleep, useBaby } from "@/contexts";
import { useActiveTimers } from "@/contexts/active-timers-context";
import type { ActiveSleepTimer } from "@/contexts/sleep-context";
import type { SleepType } from "@/constants/activities";
import { isUnderTwoMonths } from "@/utils/sleepGoals";
import { deriveSleepPredictionPresentation } from "@/utils/sleep-prediction-presentation";
import { formatDurationShort, formatTime, type TranslateFn } from "@/utils/time";
import { useTimeFormat } from "@/contexts/time-format-context";
import { MorningSleepConfirmation } from "./MorningSleepConfirmation";

interface SleepPredictionCardProps {
  babyName?: string;
}

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
    selectedNapCount,
    selectedNapCountLoaded,
    getCompletedNapsSinceNightSleep,
    dismissPredictionBanner,
    setDayNightBoundary,
    driftDetection,
    dismissDrift,
    acceptDrift,
    pendingMorningConfirmations,
    confirmMorningSleep,
  } = useSleep();

  const { getLockForActivity } = useActiveTimers();

  const remoteSleepLock = useMemo(() => {
    if (activeTimer || !selectedBaby?.id) return null;
    return getLockForActivity(selectedBaby.id, "sleep");
  }, [activeTimer, selectedBaby?.id, getLockForActivity]);

  const effectiveActiveTimer = useMemo((): Omit<ActiveSleepTimer, "timerInstanceId" | "activityId"> | null => {
    if (activeTimer) return activeTimer;
    if (!remoteSleepLock) return null;
    const sleepType = (remoteSleepLock.timerData?.type as SleepType) ?? "nap";
    return {
      isRunning: true,
      isPaused: false,
      lockState: "owned",
      startTime: new Date(remoteSleepLock.startedAt),
      sleepType,
      totalPausedMs: 0,
      morningClassification: "automatic",
      morningClassificationVersion: 1,
    };
  }, [activeTimer, remoteSleepLock]);

  const birthDate = selectedBaby?.birthDate;
  const dayStartHour = wakeWindowConfig?.dayStartHour;
  const effectiveDayStart = dayStartHour ?? 6;
  const [showSetup, setShowSetup] = useState(false);
  const [setupDayStart, setSetupDayStart] = useState(7);
  const [setupDayEnd, setSetupDayEnd] = useState(19);
  const [showDayStartPicker, setShowDayStartPicker] = useState(false);
  const [showDayEndPicker, setShowDayEndPicker] = useState(false);
  const [pendingDayStart, setPendingDayStart] = useState<number | null>(null);
  const [pendingDayEnd, setPendingDayEnd] = useState<number | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isConfirmingMorning, setIsConfirmingMorning] = useState(false);

  const overdueTickMinute = useTimeRefresh(60000);

  const [morningReferenceTime, setMorningReferenceTime] = useState(() => new Date());

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

  useEffect(() => {
    if (effectiveActiveTimer) return;

    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);

    const dayStart = new Date(now);
    dayStart.setHours(
      Math.floor(effectiveDayStart),
      Math.round((effectiveDayStart % 1) * 60),
      0,
      0
    );
    const anchor = new Date(dayStart.getTime() - 183 * 60 * 1000);
    if (anchor.getTime() <= now.getTime()) {
      anchor.setDate(anchor.getDate() + 1);
    }

    const nextTransition = Math.min(midnight.getTime(), anchor.getTime());
    const timer = setTimeout(
      () => setMorningReferenceTime(new Date()),
      nextTransition - now.getTime()
    );
    return () => clearTimeout(timer);
  }, [effectiveActiveTimer, effectiveDayStart, morningReferenceTime]);

  const predictionPresentation = useMemo(() => {
    void overdueTickMinute;
    return deriveSleepPredictionPresentation({
      hasSelectedBaby: Boolean(selectedBaby),
      birthDate,
      predictionBannerDismissed,
      wakeWindowConfig,
      isComputingModel,
      activeSleepType: effectiveActiveTimer?.sleepType ?? null,
      sleeps,
      model,
      qualifyingDayCount,
      hasPendingMorningConfirmation: Boolean(pendingMorningConfirmation),
      selectedNapCount,
      selectedNapCountLoaded,
      completedNapsToday: getCompletedNapsSinceNightSleep(),
      now: new Date(Math.max(Date.now(), morningReferenceTime.getTime())),
    });
  }, [
    birthDate,
    effectiveActiveTimer?.sleepType,
    getCompletedNapsSinceNightSleep,
    isComputingModel,
    model,
    morningReferenceTime,
    overdueTickMinute,
    pendingMorningConfirmation,
    predictionBannerDismissed,
    qualifyingDayCount,
    selectedBaby,
    selectedNapCount,
    selectedNapCountLoaded,
    sleeps,
    wakeWindowConfig,
  ]);
  const {
    cardState,
    effectiveCardState,
    prediction,
    effectiveModel,
    selectedNapCount: effectiveSelectedNapCount,
    isOverdue,
    overdueMinutes,
  } = predictionPresentation;

  const handleInfoPress = useCallback(() => {
    setShowInfoModal(true);
  }, []);

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

  const handleManualWakeWindows = useCallback(() => {
    router.push("/sleep/settings" as Parameters<typeof router.push>[0]);
  }, [router]);

  const handleSetupSave = useCallback(async () => {
    await setDayNightBoundary(setupDayStart, setupDayEnd);
    setShowSetup(false);
  }, [setupDayStart, setupDayEnd, setDayNightBoundary]);

  const handleDayStartPickerChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDayStartPicker(false);
    if (selectedDate) {
      setSetupDayStart(selectedDate.getHours());
    }
  }, []);

  const handleDayStartDone = useCallback(() => {
    setShowDayStartPicker(false);
    if (pendingDayStart !== null) {
      setSetupDayStart(pendingDayStart);
    }
    setPendingDayStart(null);
  }, [pendingDayStart]);

  const handleDayEndPickerChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDayEndPicker(false);
    if (selectedDate) {
      setSetupDayEnd(selectedDate.getHours());
    }
  }, []);

  const handleDayEndDone = useCallback(() => {
    setShowDayEndPicker(false);
    if (pendingDayEnd !== null) {
      setSetupDayEnd(pendingDayEnd);
    }
    setPendingDayEnd(null);
  }, [pendingDayEnd]);

  const sleepAccent = isDark ? "#A68DC8" : "#8B7BA0";
  const sleepAccentSoft = isDark ? "#C4ADE0" : "#6B5A80";
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.60)" : "#7A7570";
  const cardBg = isDark ? "#2A2725" : "#F0EEEC";
  const borderColor = isDark ? "#353039" : "rgba(139,123,160,0.18)";
  const topBorderColor = isDark ? "#4C4357" : "rgba(139,123,160,0.35)";
  const segBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const infoBg = isDark ? "rgba(166,141,200,0.12)" : "rgba(139,123,160,0.10)";
  const overdueColor = isDark ? "#E8A87C" : "#D4845A";

  const makeTimeDate = (fractionalHour: number): Date => {
    const d = new Date();
    const h = Math.floor(fractionalHour);
    const m = Math.round((fractionalHour - h) * 60);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const dayStartPickerValue = useMemo(() => {
    const d = new Date();
    d.setHours(pendingDayStart ?? setupDayStart, 0, 0, 0);
    return d;
  }, [pendingDayStart, setupDayStart]);

  const dayEndPickerValue = useMemo(() => {
    const d = new Date();
    d.setHours(pendingDayEnd ?? setupDayEnd, 0, 0, 0);
    return d;
  }, [pendingDayEnd, setupDayEnd]);

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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2, color: isOverdue ? overdueHeaderColor : sleepAccent }}>
        {t("dashboard.sleepPrediction")}
      </Text>
      <Pressable
        onPress={handleInfoPress}
        hitSlop={8}
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: infoBg,
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityLabel={t("dashboard.predictionInfo")}
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 11, fontWeight: "700", fontStyle: "italic", color: isOverdue ? overdueHeaderColor : sleepAccent }}>
          i
        </Text>
      </Pressable>
    </View>
  );

  const renderContent = () => {
    if (cardState === null) return null;

    if (cardState === "loading") {
      return (
        <View style={{ gap: 12 }}>
          <SkeletonBar width={120} height={12} color={sleepAccent} />
          <SkeletonBar width={200} height={16} color={sleepAccent} />
        </View>
      );
    }

    if (cardState === "no_birthdate") {
      return (
        <>
          {renderHeader()}
          <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary, marginBottom: 12 }}>
            {t("dashboard.startAt2Months")}
          </Text>
          <Pressable
            onPress={() => selectedBaby && router.push(`/baby/${selectedBaby.id}`)}
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 20,
              backgroundColor: isDark ? "rgba(184,160,212,0.15)" : "rgba(166,141,200,0.12)",
            }}
          >
            <Text style={{ fontSize: 12 }}>🗓</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: sleepAccent }}>
              {t("dashboard.addBirthdate")}
            </Text>
          </Pressable>
        </>
      );
    }

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
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary }}>
                    {t("dashboard.dayStartLabel")}
                  </Text>
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
                </View>
                {showDayStartPicker && Platform.OS === "ios" && (
                  <View style={{
                    marginTop: 8,
                    backgroundColor: segBg,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    <View style={{ alignItems: "center" }}>
                      <RNDatePicker
                        date={dayStartPickerValue}
                        mode="time"
                        onDateChange={(date) => setPendingDayStart(date.getHours())}
                        theme={isDark ? "dark" : "light"}
                      />
                    </View>
                    <Pressable
                      onPress={handleDayStartDone}
                      style={{
                        alignSelf: "stretch",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderTopWidth: 1,
                        borderTopColor: borderColor,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: sleepAccent }}>
                        {t("common.done")}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {showDayStartPicker && Platform.OS === "android" && (
                  <DateTimePicker
                    {...{
                      value: dayStartPickerValue,
                      mode: "time",
                      display: "default",
                      onChange: handleDayStartPickerChange,
                      minuteInterval: 30,
                    } as AndroidNativeProps}
                  />
                )}
              </View>

              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary }}>
                    {t("dashboard.dayEndLabel")}
                  </Text>
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
                </View>
                {showDayEndPicker && Platform.OS === "ios" && (
                  <View style={{
                    marginTop: 8,
                    backgroundColor: segBg,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}>
                    <View style={{ alignItems: "center" }}>
                      <RNDatePicker
                        date={dayEndPickerValue}
                        mode="time"
                        onDateChange={(date) => setPendingDayEnd(date.getHours())}
                        theme={isDark ? "dark" : "light"}
                      />
                    </View>
                    <Pressable
                      onPress={handleDayEndDone}
                      style={{
                        alignSelf: "stretch",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderTopWidth: 1,
                        borderTopColor: borderColor,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: sleepAccent }}>
                        {t("common.done")}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {showDayEndPicker && Platform.OS === "android" && (
                  <DateTimePicker
                    {...{
                      value: dayEndPickerValue,
                      mode: "time",
                      display: "default",
                      onChange: handleDayEndPickerChange,
                      minuteInterval: 30,
                    } as AndroidNativeProps}
                  />
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

    if (cardState === "morning_confirmation" && pendingMorningConfirmation) {
      return (
        <>
          {renderHeader()}
          <MorningSleepConfirmation
            startedAt={pendingMorningConfirmation.startedAt}
            onFirstNap={() => handleMorningAnswer("first_nap")}
            onBackToSleep={() => handleMorningAnswer("night_continuation")}
            disabled={isConfirmingMorning}
          />
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
      return (
        <>
          {renderHeader()}
          <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? textPrimary : "#3D3350" }}>
            {t("dashboard.nighttime")}
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

    if (!prediction || !effectiveModel || effectiveSelectedNapCount === null) return null;

    return renderPredictionContent();
  };

  const formatOverdueTime = (minutes: number, type: "nap" | "bedtime"): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const key = type === "bedtime" ? "dashboard.bedtimeAgo" : "dashboard.napTimeAgo";
    return t(key, { time: formatDurationShort(h, m, tFn) });
  };

  const renderPredictionContent = () => {
    if (!prediction || !effectiveModel || effectiveSelectedNapCount === null) return null;

    const predictedTimeStr = formatTime(prediction.predictedTime, timeFormat);


    const label = isOverdue
      ? formatOverdueTime(overdueMinutes, prediction.type)
      : prediction.type === "bedtime"
        ? t("dashboard.bedtimeNear")
        : t("dashboard.napTimeNear");

    return (
      <>
        {cardState !== "need_more_data" && renderHeader()}

        <Text style={{ fontSize: 15, fontWeight: "700", color: isOverdue ? overdueColor : (isDark ? textPrimary : "#3D3350"), marginTop: 4 }}>
          {label}{" "}
          {!isOverdue && (
            <Text style={{ fontWeight: "900", fontSize: 16, color: sleepAccentSoft }}>
              {predictedTimeStr}
            </Text>
          )}
        </Text>
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

const PulsingDot = ({ color }: { color: string }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
      }}
    />
  );
};

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

const SkeletonBar = ({ width, height, color }: { width: number; height: number; color: string }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.12, 0.25, 0.12],
  });

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: color,
        opacity,
      }}
    />
  );
};

const SleepPredictionCard = memo(SleepPredictionCardInner);

export { SleepPredictionCard, type SleepPredictionCardProps };
