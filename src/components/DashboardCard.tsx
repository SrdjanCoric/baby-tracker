import { Pressable, Text, View, useColorScheme, Platform } from "react-native";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { CONTENT_COLORS, SURFACE, ACTIVITY } from "@/constants/design-tokens";
import { formatDuration } from "@/utils/time";

const CARD_MIN_HEIGHT = Platform.OS === "android" ? 150 : 160;
const CARD_BORDER_RADIUS = 20;

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
  isStopping?: boolean;
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
}

const DashboardCardInner = forwardRef<View, DashboardCardProps>(
  (
    {
      activity,
      label,
      timeSince,
      isActive = false,
      activeLabel,
      isStopping = false,
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
    },
    ref
  ) => {
    const { t } = useTranslation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const [localElapsed, setLocalElapsed] = useState<string | null>(null);
    const timerStartTimeRef = useRef(timerStartTime);
    const timerPausedAtRef = useRef(timerPausedAt);

    timerStartTimeRef.current = timerStartTime;
    timerPausedAtRef.current = timerPausedAt;

    useEffect(() => {
      if ((!isActive && !isLockedByOther) || !timerStartTime) {
        setLocalElapsed(null);
        return;
      }

      const computeElapsed = () => {
        const start = timerStartTimeRef.current!;
        const pausedAt = timerPausedAtRef.current;

        let elapsed: number;
        if (pausedAt) {
          elapsed = Math.floor((pausedAt - start) / 1000);
        } else {
          elapsed = Math.floor((Date.now() - start) / 1000);
        }
        setLocalElapsed(formatDuration(elapsed, isLockedByOther ? "short" : "long"));
      };

      computeElapsed();
      const interval = setInterval(computeElapsed, 1000);
      return () => clearInterval(interval);
    }, [isActive, isLockedByOther, timerStartTime, timerPausedAt]);
    const config = ACTIVITY_CONFIG[activity];
    const activityColors = ACTIVITY[activity as keyof typeof ACTIVITY];
    const bgColor = isDark ? SURFACE.dark.card : SURFACE.light.card;
    const accentColor = isDark ? config.accentColorDark : config.accentColor;
    const buttonBgColor = isDark
      ? activityColors.buttonDark
      : config.accentColor;
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
            withTiming(0.6, {
              duration: 1200,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );
        lockedIndicatorScale.value = withRepeat(
          withSequence(
            withTiming(1.15, {
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
            }),
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
    const resolvedTestID = !testID
      ? undefined
      : isLockedByOther
        ? `${testID}-${isPausedByOther ? "locked-paused" : "locked-active"}`
        : isActive
          ? `${testID}-own-active`
          : testID;

    const tintColor = isDark
      ? activityColors.cardTintDark
      : activityColors.cardTintLight;
    const gradientColors: [string, string] = [tintColor, bgColor];
    const gradientLocations: [number, number] = [0, 0.6];
    const accessibilityLabel = isLockedByOther
      ? t("accessibility.lockedByOther", { label, name: lockedByName })
      : timeSince
        ? t("accessibility.cardTimeSince", { label, time: timeSince })
        : t("accessibility.cardNoTime", { label });

    return (
      <Animated.View ref={ref} style={[cardAnimatedStyle, { flex: 1 }]}>
        <AnimatedPressable
          onPress={isLockedByOther ? undefined : onPress}
          onPressIn={isLockedByOther ? undefined : handleCardPressIn}
          onPressOut={isLockedByOther ? undefined : handleCardPressOut}
          disabled={isLockedByOther}
          testID={resolvedTestID}
          style={{
            flex: 1,
            borderRadius: CARD_BORDER_RADIUS,
            minHeight: CARD_MIN_HEIGHT,
            borderWidth: isActive || isLockedByOther ? 2 : 0,
            borderColor: isLockedByOther
              ? lockedBorderColor
              : isActive
                ? accentColor
                : "transparent",
            borderLeftWidth: !isActive && !isLockedByOther ? 3 : 2,
            borderLeftColor: accentColor,
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <LinearGradient
            colors={
              isLockedByOther ? [lockedBgColor, lockedBgColor] : gradientColors
            }
            locations={isLockedByOther ? [0, 1] : gradientLocations}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{
              flex: 1,
              borderRadius: CARD_BORDER_RADIUS - 1,
              overflow: "hidden",
              padding: Platform.OS === "android" ? 12 : 14,
            }}
          >
            {/* Top row: Icon + Label */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center flex-1 mr-2">
                <Text style={{ fontSize: 16, marginRight: 6 }}>
                  {config.icon}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: accentColor,
                    flex: 1,
                  }}
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
            <View className="flex-1 justify-center">
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
                      : activity === "feeding"
                        ? t("dashboardCard.isFeeding", { name: lockedByName })
                        : activity === "sleep"
                          ? t("dashboardCard.isSleeping", {
                              name: babyName || t("dashboardCard.baby"),
                            })
                          : activity === "pumping"
                            ? t("dashboardCard.pumpingActive")
                            : activity === "tummyTime"
                              ? t("dashboardCard.isOnTummy", {
                                  name: babyName || t("dashboardCard.baby"),
                                })
                                : t("dashboardCard.isBusy", {
                                  name: lockedByName,
                                })}
                  </Text>
                  {lockedElapsedTime && (
                    <Text
                      className="text-sm mt-1"
                      style={{ color: secondaryTextColor }}
                      numberOfLines={1}
                    >
                      {localElapsed ?? lockedElapsedTime}
                    </Text>
                  )}
                </View>
              ) : isActive ? (
                <View>
                  <Text
                    className="text-base font-extrabold"
                    style={{ color: accentColor }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {isStopping
                      ? t("common.stopping")
                      : activeLabel || t("dashboardCard.active")}
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
                    className="text-base font-extrabold"
                    style={{ color: textColor }}
                    numberOfLines={1}
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
                    <View className="mt-1">
                      <View className="flex-row items-center">
                        <View
                          className="h-2 rounded-full flex-1 mr-2"
                          style={{
                            backgroundColor: isDark
                              ? "#3A3A3A"
                              : `${accentColor}25`,
                            borderWidth: isDark ? 0 : 1,
                            borderColor: isDark
                              ? "transparent"
                              : `${accentColor}40`,
                          }}
                        >
                          <View
                            className="h-full rounded-full"
                            style={{
                              backgroundColor:
                                progress >= 100 ? "#4CAF50" : accentColor,
                              width: `${Math.min(100, progress)}%`,
                            }}
                          />
                        </View>
                        <Text
                          className="text-xs font-medium"
                          style={{ color: secondaryTextColor }}
                        >
                          {progress}%
                        </Text>
                      </View>
                    </View>
                  )}
                  {secondaryInfo &&
                    (() => {
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
            <View className="flex-row items-end justify-between">
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
              <View
                style={{
                  width: isActive && onPausePress ? 76 : 34,
                  height: 34,
                }}
              />
            </View>
          </LinearGradient>
        </AnimatedPressable>

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: Platform.OS === "android" ? 12 : 14,
            bottom: Platform.OS === "android" ? 12 : 14,
          }}
        >
          {isLockedByOther ? (
            <View
              className="items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: isDark ? "#3A3A3A" : "#E5E5E5",
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text className="text-sm">⏳</Text>
            </View>
          ) : isStopping ? (
            <Pressable
              disabled
              className="items-center justify-center"
              style={{
                backgroundColor: buttonBgColor,
                opacity: 0.6,
                width: 34,
                height: 34,
                borderRadius: 17,
              }}
              accessibilityRole="button"
              accessibilityLabel={t("common.stopping")}
              accessibilityState={{ disabled: true, busy: true }}
              testID={testID ? `${testID}-action` : undefined}
            >
              <Text className="text-base font-bold text-white">…</Text>
            </Pressable>
          ) : isActive && onPausePress ? (
            <View className="flex-row items-center gap-2">
              <AnimatedPressable
                onPress={onPausePress}
                onPressIn={handlePauseButtonPressIn}
                onPressOut={handlePauseButtonPressOut}
                className="items-center justify-center"
                style={[
                  pauseButtonAnimatedStyle,
                  {
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: isPaused ? buttonBgColor : "transparent",
                    borderWidth: isPaused ? 0 : 2,
                    borderColor: buttonBgColor,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isPaused ? t("common.resume") : t("common.pause")
                }
                testID={testID ? `${testID}-pause` : undefined}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: isPaused ? "#FFFFFF" : buttonBgColor }}
                >
                  {isPaused ? "▶" : "⏸"}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={onActionPress}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                className="items-center justify-center"
                style={[
                  buttonAnimatedStyle,
                  {
                    backgroundColor: buttonBgColor,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("common.stop")}
                testID={testID ? `${testID}-action` : undefined}
              >
                <Text className="text-xs font-bold text-white">⏹</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <AnimatedPressable
              onPress={onActionPress}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              className="items-center justify-center"
              style={[
                buttonAnimatedStyle,
                {
                  backgroundColor: buttonBgColor,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isActive
                  ? t("common.stop")
                  : t("accessibility.addActivity", { label })
              }
              testID={testID ? `${testID}-action` : undefined}
            >
              <Text className="text-base font-bold text-white">
                {isActive ? "⏹" : actionLabel}
              </Text>
            </AnimatedPressable>
          )}
        </View>
      </Animated.View>
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
    prev.isStopping === next.isStopping &&
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
    prev.onPress === next.onPress &&
    prev.onActionPress === next.onActionPress &&
    prev.onPausePress === next.onPausePress
  );
});

export { DashboardCard, type DashboardCardProps };
export type { ActivityType } from "@/constants/activities";
