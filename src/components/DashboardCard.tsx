import { Pressable, Text, View, useColorScheme, Platform } from "react-native";
import { forwardRef, memo, useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { CONTENT_COLORS, SURFACE, ACTIVITY } from "@/constants/design-tokens";
import { formatDuration } from "@/utils/time";

const CARD_MIN_HEIGHT = Platform.OS === "android" ? 180 : 200;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
};

interface DashboardCardProps {
  activity: ActivityType;
  label: string;
  timeSince?: string;
  isActive?: boolean;
  activeLabel?: string;
  onPress?: () => void;
  onActionPress?: () => void;
  onPausePress?: () => void;
  isPaused?: boolean;
  actionLabel?: string;
  testID?: string;
  progress?: number;
  subtitle?: string;
  secondaryInfo?: string;
  isLockedByOther?: boolean;
  lockedByName?: string;
  lockedElapsedTime?: string;
  babyName?: string;
  isPausedByOther?: boolean;
  todayBadge?: string;
  timerStartTime?: number;
  timerPausedAt?: number;
  timerTotalPausedMs?: number;
}

const DashboardCardInner = forwardRef<View, DashboardCardProps>(
  (
    {
      activity,
      label,
      timeSince,
      isActive = false,
      activeLabel,
      onPress,
      onActionPress,
      onPausePress,
      isPaused = false,
      actionLabel = "+",
      testID,
      progress,
      subtitle,
      secondaryInfo,
      isLockedByOther = false,
      lockedByName,
      lockedElapsedTime,
      babyName,
      isPausedByOther = false,
      todayBadge,
      timerStartTime,
      timerPausedAt,
      timerTotalPausedMs,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const [localElapsed, setLocalElapsed] = useState<string | null>(null);
    const timerStartTimeRef = useRef(timerStartTime);
    const timerPausedAtRef = useRef(timerPausedAt);
    const timerTotalPausedMsRef = useRef(timerTotalPausedMs);

    timerStartTimeRef.current = timerStartTime;
    timerPausedAtRef.current = timerPausedAt;
    timerTotalPausedMsRef.current = timerTotalPausedMs;

    useEffect(() => {
      if (!isActive || !timerStartTime) {
        setLocalElapsed(null);
        return;
      }

      const computeElapsed = () => {
        const start = timerStartTimeRef.current!;
        const pausedAt = timerPausedAtRef.current;
        const totalPaused = timerTotalPausedMsRef.current ?? 0;

        let elapsed: number;
        if (pausedAt) {
          elapsed = Math.floor((pausedAt - start - totalPaused) / 1000);
        } else {
          elapsed = Math.floor((Date.now() - start - totalPaused) / 1000);
        }
        setLocalElapsed(formatDuration(elapsed, "long"));
      };

      computeElapsed();
      const interval = setInterval(computeElapsed, 1000);
      return () => clearInterval(interval);
    }, [isActive, timerStartTime, timerPausedAt, timerTotalPausedMs]);
    const config = ACTIVITY_CONFIG[activity];
    const activityColors = ACTIVITY[activity as keyof typeof ACTIVITY];
    const bgColor = isDark ? SURFACE.dark.card : SURFACE.light.card;
    const accentColor = isDark ? config.accentColorDark : config.accentColor;
    const buttonBgColor = isDark ? activityColors.buttonDark : config.accentColor;
    const colors = isDark ? CONTENT_COLORS.dark : CONTENT_COLORS.light;
    const textColor = colors.primary;
    const secondaryTextColor = isDark ? colors.primary : colors.secondary;

    const cardScale = useSharedValue(1);
    const buttonScale = useSharedValue(1);
    const pauseButtonScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(1);
    const lockedIndicatorScale = useSharedValue(1);

    useEffect(() => {
      if (isLockedByOther && !isPausedByOther) {
        pulseOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );
        lockedIndicatorScale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );
      } else {
        cancelAnimation(pulseOpacity);
        cancelAnimation(lockedIndicatorScale);
        pulseOpacity.value = 1;
        lockedIndicatorScale.value = 1;
      }
    }, [isLockedByOther, isPausedByOther, pulseOpacity, lockedIndicatorScale]);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: cardScale.value }],
      opacity: isLockedByOther ? pulseOpacity.value : 1,
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: buttonScale.value }],
    }));

    const pauseButtonAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pauseButtonScale.value }],
    }));

    const lockedIndicatorStyle = useAnimatedStyle(() => ({
      transform: [{ scale: lockedIndicatorScale.value }],
    }));

    const getInitial = (name: string) => {
      return name.charAt(0).toUpperCase();
    };

    const handleCardPressIn = useCallback(() => {
      cardScale.value = withSpring(0.97, SPRING_CONFIG);
    }, [cardScale]);

    const handleCardPressOut = useCallback(() => {
      cardScale.value = withSpring(1, SPRING_CONFIG);
    }, [cardScale]);

    const handleButtonPressIn = useCallback(() => {
      buttonScale.value = withSpring(0.9, SPRING_CONFIG);
    }, [buttonScale]);

    const handleButtonPressOut = useCallback(() => {
      buttonScale.value = withSpring(1, SPRING_CONFIG);
    }, [buttonScale]);

    const handlePauseButtonPressIn = useCallback(() => {
      pauseButtonScale.value = withSpring(0.9, SPRING_CONFIG);
    }, [pauseButtonScale]);

    const handlePauseButtonPressOut = useCallback(() => {
      pauseButtonScale.value = withSpring(1, SPRING_CONFIG);
    }, [pauseButtonScale]);

    const lockedBgColor = isDark ? `${accentColor}15` : `${accentColor}08`;
    const lockedBorderColor = isDark ? `${accentColor}40` : `${accentColor}30`;

    return (
      <AnimatedPressable
        ref={ref}
        onPress={isLockedByOther ? undefined : onPress}
        onPressIn={isLockedByOther ? undefined : handleCardPressIn}
        onPressOut={isLockedByOther ? undefined : handleCardPressOut}
        disabled={isLockedByOther}
        testID={testID}
        className={`flex-1 rounded-[20px] ${Platform.OS === "android" ? "p-3" : "p-4"}`}
        style={[
          cardAnimatedStyle,
          {
            backgroundColor: isLockedByOther ? lockedBgColor : bgColor,
            minHeight: CARD_MIN_HEIGHT,
            borderWidth: isActive || isLockedByOther ? 2 : 0,
            borderColor: isLockedByOther ? lockedBorderColor : isActive ? accentColor : "transparent",
            borderLeftWidth: !isActive && !isLockedByOther ? 3 : 2,
            borderLeftColor: accentColor,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isLockedByOther
            ? t("accessibility.lockedByOther", { label, name: lockedByName })
            : timeSince ? t("accessibility.cardTimeSince", { label, time: timeSince }) : t("accessibility.cardNoTime", { label })
        }
      >
        {/* Top row: Icon + Label */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-1 mr-2">
            <Text className="text-2xl mr-2">{config.icon}</Text>
            <Text
              className="text-sm font-semibold uppercase tracking-wider flex-1"
              style={{ color: accentColor }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {label}
            </Text>
          </View>

          {/* Active indicator dot */}
          {isActive && !isLockedByOther && (
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}

          {/* Locked by other indicator */}
          {isLockedByOther && lockedByName && (
            <Animated.View
              style={[
                lockedIndicatorStyle,
                {
                  backgroundColor: accentColor,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text className="text-xs font-bold text-white">
                {getInitial(lockedByName)}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Main content: Time since, Active state, or Locked state */}
        <View className="flex-1 justify-center py-2">
          {isLockedByOther ? (
            <View>
              <Text
                className="text-base font-semibold"
                style={{ color: accentColor }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {isPausedByOther
                  ? t("dashboardCard.paused", { name: lockedByName })
                  : activity === "feeding" ? t("dashboardCard.isFeeding", { name: lockedByName }) :
                    activity === "sleep" ? t("dashboardCard.isSleeping", { name: babyName || t("dashboardCard.baby") }) :
                    activity === "pumping" ? t("dashboardCard.pumpingActive") :
                    activity === "tummyTime" ? t("dashboardCard.isOnTummy", { name: babyName || t("dashboardCard.baby") }) :
                    t("dashboardCard.isBusy", { name: lockedByName })}
              </Text>
              {lockedElapsedTime && (
                <Text
                  className="text-sm mt-1"
                  style={{ color: secondaryTextColor }}
                  numberOfLines={1}
                >
                  {lockedElapsedTime}
                </Text>
              )}
            </View>
          ) : isActive ? (
            <View>
              <Text
                className="text-xl font-bold"
                style={{ color: accentColor }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {activeLabel || t("dashboardCard.active")}
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: secondaryTextColor }}
                numberOfLines={1}
              >
                {localElapsed ?? timeSince}
              </Text>
            </View>
          ) : (
            <View>
              <Text
                className="text-xl font-bold"
                style={{ color: textColor }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {timeSince || "--:--"}
              </Text>
              {subtitle && (
                <Text
                  className="text-sm mt-1"
                  style={{ color: secondaryTextColor }}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
              {progress !== undefined && (
                <View className="mt-2">
                  <View className="flex-row items-center">
                    <View
                      className="h-2 rounded-full flex-1 mr-2"
                      style={{
                        backgroundColor: isDark ? "#3A3A3A" : `${accentColor}25`,
                        borderWidth: isDark ? 0 : 1,
                        borderColor: isDark ? "transparent" : `${accentColor}40`,
                      }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: progress >= 100 ? "#4CAF50" : accentColor,
                          width: `${Math.min(100, progress)}%`
                        }}
                      />
                    </View>
                    <Text className="text-xs font-medium" style={{ color: secondaryTextColor }}>
                      {progress}%
                    </Text>
                  </View>
                </View>
              )}
              {secondaryInfo && (() => {
                const parts = secondaryInfo.split("\n");
                return (
                  <View className="mt-1">
                    <Text
                      className="text-sm"
                      style={{ color: secondaryTextColor }}
                      numberOfLines={1}
                    >
                      {parts[0]}
                    </Text>
                    {parts[1] && (
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: secondaryTextColor }}
                        numberOfLines={1}
                      >
                        {parts[1]}
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>
          )}
        </View>

        {/* Action row */}
        <View className="flex-row items-end justify-between mt-1">
          {todayBadge !== undefined && !isLockedByOther ? (
            <View
              className="px-2 py-1 rounded-full"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: accentColor }}
              >
                {todayBadge}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View>
          {isLockedByOther ? (
            <View
              className={`${Platform.OS === "android" ? "min-w-[40px] min-h-[40px] rounded-xl" : "min-w-[48px] min-h-[48px] rounded-2xl"} items-center justify-center`}
              style={{ backgroundColor: isDark ? "#3A3A3A" : "#E5E5E5" }}
            >
              <Text className={`${Platform.OS === "android" ? "text-base" : "text-lg"}`}>
                ⏳
              </Text>
            </View>
          ) : isActive && onPausePress ? (
            <View className="flex-row items-center gap-2">
              <AnimatedPressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onPausePress();
                }}
                onPressIn={handlePauseButtonPressIn}
                onPressOut={handlePauseButtonPressOut}
                className={`${Platform.OS === "android" ? "min-w-[36px] min-h-[36px] rounded-xl" : "min-w-[40px] min-h-[40px] rounded-2xl"} items-center justify-center`}
                style={[
                  pauseButtonAnimatedStyle,
                  {
                    backgroundColor: isPaused ? buttonBgColor : "transparent",
                    borderWidth: isPaused ? 0 : 2,
                    borderColor: buttonBgColor,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isPaused ? t("common.resume") : t("common.pause")}
                testID={testID ? `${testID}-pause` : undefined}
              >
                <Text
                  className={`${Platform.OS === "android" ? "text-sm" : "text-base"} font-bold`}
                  style={{ color: isPaused ? "#FFFFFF" : buttonBgColor }}
                >
                  {isPaused ? "▶" : "⏸"}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onActionPress?.();
                }}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                className={`${Platform.OS === "android" ? "min-w-[36px] min-h-[36px] rounded-xl" : "min-w-[40px] min-h-[40px] rounded-2xl"} items-center justify-center`}
                style={[buttonAnimatedStyle, { backgroundColor: buttonBgColor }]}
                accessibilityRole="button"
                accessibilityLabel={t("common.stop")}
                testID={testID ? `${testID}-action` : undefined}
              >
                <Text className={`${Platform.OS === "android" ? "text-sm" : "text-base"} font-bold text-white`}>
                  ⏹
                </Text>
              </AnimatedPressable>
            </View>
          ) : (
            <AnimatedPressable
              onPress={(e) => {
                e.stopPropagation?.();
                onActionPress?.();
              }}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              className={`${Platform.OS === "android" ? "min-w-[40px] min-h-[40px] rounded-xl" : "min-w-[48px] min-h-[48px] rounded-2xl"} items-center justify-center`}
              style={[buttonAnimatedStyle, { backgroundColor: buttonBgColor }]}
              accessibilityRole="button"
              accessibilityLabel={isActive ? t("common.stop") : t("accessibility.addActivity", { label })}
              testID={testID ? `${testID}-action` : undefined}
            >
              <Text className={`${Platform.OS === "android" ? "text-base" : "text-lg"} font-bold text-white`}>
                {isActive ? "⏹" : actionLabel}
              </Text>
            </AnimatedPressable>
          )}
          </View>
        </View>
      </AnimatedPressable>
    );
  }
);

DashboardCardInner.displayName = "DashboardCard";

const DashboardCard = memo(DashboardCardInner, (prev, next) => {
  return (
    prev.activity === next.activity &&
    prev.label === next.label &&
    prev.timeSince === next.timeSince &&
    prev.subtitle === next.subtitle &&
    prev.isActive === next.isActive &&
    prev.activeLabel === next.activeLabel &&
    prev.isPaused === next.isPaused &&
    prev.actionLabel === next.actionLabel &&
    prev.progress === next.progress &&
    prev.secondaryInfo === next.secondaryInfo &&
    prev.isLockedByOther === next.isLockedByOther &&
    prev.lockedByName === next.lockedByName &&
    prev.lockedElapsedTime === next.lockedElapsedTime &&
    prev.babyName === next.babyName &&
    prev.isPausedByOther === next.isPausedByOther &&
    prev.todayBadge === next.todayBadge &&
    prev.testID === next.testID &&
    prev.timerStartTime === next.timerStartTime &&
    prev.timerPausedAt === next.timerPausedAt &&
    prev.timerTotalPausedMs === next.timerTotalPausedMs &&
    prev.onPress === next.onPress &&
    prev.onActionPress === next.onActionPress &&
    prev.onPausePress === next.onPausePress
  );
});

export { DashboardCard, type DashboardCardProps };
export type { ActivityType } from "@/constants/activities";
