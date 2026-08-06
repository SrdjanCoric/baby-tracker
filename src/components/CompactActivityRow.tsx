import { Pressable, Text, View, useColorScheme } from "react-native";
import { memo, useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { SURFACE, ACTIVITY } from "@/constants/design-tokens";
import { formatDuration } from "@/utils/time";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = { damping: 15, stiffness: 400 };
const ROW_BORDER_RADIUS = 14;

interface CompactActivityRowProps {
  activity: ActivityType;
  label: string;
  timeSince?: string;
  subtitle?: string;
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

const CompactActivityRowInner = ({
  activity,
  label,
  timeSince,
  subtitle,
  isActive = false,
  isStopping = false,
  onPress,
  onActionPress,
  onPausePress,
  isPaused = false,
  testID,
  isLockedByOther = false,
  lockedByName,
  lockedElapsedTime,
  babyName,
  isPausedByOther = false,
  timerStartTime,
  timerPausedAt,
}: CompactActivityRowProps) => {
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
      setLocalElapsed(formatDuration(elapsed, "long"));
    };

    computeElapsed();
    const interval = setInterval(computeElapsed, 1000);
    return () => clearInterval(interval);
  }, [isActive, isLockedByOther, timerStartTime, timerPausedAt]);

  const config = ACTIVITY_CONFIG[activity];
  const activityColors = ACTIVITY[activity as keyof typeof ACTIVITY];
  const accentColor = isDark ? config.accentColorDark : config.accentColor;
  const buttonBgColor = isDark ? activityColors.buttonDark : config.accentColor;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.60)" : "#7A7570";

  const tintColor = isDark
    ? activityColors.rowTintDark
    : activityColors.rowTintLight;
  const gradientColors: [string, string] = [tintColor, cardBg];
  const gradientLocations: [number, number] = [0, 0.5];

  const rowScale = useSharedValue(1);

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    rowScale.value = withSpring(0.98, SPRING_CONFIG);
  }, [rowScale]);

  const handlePressOut = useCallback(() => {
    rowScale.value = withSpring(1, SPRING_CONFIG);
  }, [rowScale]);

  const lockedDisplayValue = isPausedByOther
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
            : t("dashboardCard.isBusy", { name: lockedByName });
  const displayValue = isStopping
    ? t("common.stopping")
    : isLockedByOther
      ? lockedDisplayValue
      : isActive && localElapsed
        ? localElapsed
        : timeSince || "--";
  const secondaryValue = isLockedByOther
    ? localElapsed ?? lockedElapsedTime
    : subtitle;
  const resolvedTestID = !testID
    ? undefined
    : isLockedByOther
      ? `${testID}-${isPausedByOther ? "locked-paused" : "locked-active"}`
      : isActive
        ? `${testID}-own-active`
        : testID;
  const accessibilityLabel = isLockedByOther
    ? t("accessibility.lockedByOther", { label, name: lockedByName })
    : timeSince
      ? t("accessibility.cardTimeSince", { label, time: timeSince })
      : t("accessibility.cardNoTime", { label });

  return (
    <Animated.View style={rowAnimatedStyle}>
      <AnimatedPressable
        onPress={isLockedByOther ? undefined : onPress}
        onPressIn={isLockedByOther ? undefined : handlePressIn}
        onPressOut={isLockedByOther ? undefined : handlePressOut}
        disabled={isLockedByOther}
        testID={resolvedTestID}
        style={{
          borderRadius: ROW_BORDER_RADIUS,
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <LinearGradient
          colors={gradientColors}
          locations={gradientLocations}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: ROW_BORDER_RADIUS - 1,
            overflow: "hidden",
            paddingVertical: 10,
            paddingRight: 12,
            paddingLeft: 12,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 17, flexShrink: 0 }}>{config.icon}</Text>

          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: accentColor,
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "800",
                color: isActive ? accentColor : textPrimary,
              }}
              numberOfLines={1}
            >
              {displayValue}
            </Text>
            {secondaryValue && !isActive && (
              <Text
                style={{ fontSize: 11, color: textSecondary }}
                numberOfLines={1}
              >
                {secondaryValue}
              </Text>
            )}
            {isActive && isPaused && (
              <Text
                style={{ fontSize: 11, color: textSecondary }}
                numberOfLines={1}
              >
                {t("common.pause")}
              </Text>
            )}
          </View>

          <View
            style={{
              width: isActive && onPausePress ? 58 : 26,
              height: 26,
              flexShrink: 0,
            }}
          />
        </LinearGradient>
      </AnimatedPressable>

      <View
        pointerEvents="box-none"
        style={{ position: "absolute", right: 12, top: 10 }}
      >
        {isLockedByOther ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: buttonBgColor,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>
              {lockedByName?.trim().charAt(0).toUpperCase() || "!"}
            </Text>
          </View>
        ) : isStopping ? (
          <Pressable
            disabled
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: buttonBgColor,
              opacity: 0.6,
            }}
            accessibilityRole="button"
            accessibilityLabel={t("common.stopping")}
            accessibilityState={{ disabled: true, busy: true }}
            testID={testID ? `${testID}-action` : undefined}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              …
            </Text>
          </Pressable>
        ) : isActive && onPausePress ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable
              onPress={onPausePress}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isPaused ? buttonBgColor : "transparent",
                borderWidth: isPaused ? 0 : 2,
                borderColor: buttonBgColor,
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isPaused ? t("common.resume") : t("common.pause")
              }
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: isPaused ? "#FFFFFF" : buttonBgColor,
                }}
              >
                {isPaused ? "▶" : "⏸"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onActionPress}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: buttonBgColor,
              }}
              accessibilityRole="button"
              accessibilityLabel={t("common.stop")}
            >
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}
              >
                ⏹
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onActionPress}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: buttonBgColor,
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isActive
                ? t("common.stop")
                : t("accessibility.addActivity", { label })
            }
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              {isActive ? "⏹" : "+"}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

const CompactActivityRow = memo(CompactActivityRowInner, (prev, next) => {
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

export { CompactActivityRow, type CompactActivityRowProps };
