import { Pressable, Text, View, useColorScheme, Platform } from "react-native";
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function generateSmoothGradient(
  accentHex: string,
  cardHex: string,
  pageBgHex: string,
  blendAmount: number = 0.05,
  steps: number = 6
): { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] } {
  const accent = hexToRgb(accentHex);
  const pageBg = hexToRgb(pageBgHex);
  const card = hexToRgb(cardHex);
  const startR = Math.round(accent.r * blendAmount + pageBg.r * (1 - blendAmount));
  const startG = Math.round(accent.g * blendAmount + pageBg.g * (1 - blendAmount));
  const startB = Math.round(accent.b * blendAmount + pageBg.b * (1 - blendAmount));
  const colors: string[] = [];
  const locations: number[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(startR + (card.r - startR) * t);
    const g = Math.round(startG + (card.g - startG) * t);
    const b = Math.round(startB + (card.b - startB) * t);
    colors.push(`rgb(${r},${g},${b})`);
    locations.push(t * 0.5);
  }

  return { colors, locations } as { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] };
}

interface CompactActivityRowProps {
  activity: ActivityType;
  label: string;
  timeSince?: string;
  subtitle?: string;
  isActive?: boolean;
  activeLabel?: string;
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
  timerTotalPausedMs?: number;
}

const CompactActivityRowInner = ({
  activity,
  label,
  timeSince,
  subtitle,
  isActive = false,
  onPress,
  onActionPress,
  onPausePress,
  isPaused = false,
  testID,
  isLockedByOther = false,
  timerStartTime,
  timerPausedAt,
  timerTotalPausedMs,
}: CompactActivityRowProps) => {
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
  const accentColor = isDark ? config.accentColorDark : config.accentColor;
  const buttonBgColor = isDark ? activityColors.buttonDark : config.accentColor;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.60)" : "#7A7570";

  const pageBgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const smoothGradient = generateSmoothGradient(accentColor, cardBg, pageBgColor, 0.05, 6);

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

  const displayValue = isActive && localElapsed ? localElapsed : timeSince || "--";

  return (
    <AnimatedPressable
      onPress={isLockedByOther ? undefined : onPress}
      onPressIn={isLockedByOther ? undefined : handlePressIn}
      onPressOut={isLockedByOther ? undefined : handlePressOut}
      disabled={isLockedByOther}
      testID={testID}
      style={[
        rowAnimatedStyle,
        {
          borderRadius: ROW_BORDER_RADIUS,
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={timeSince ? t("accessibility.cardTimeSince", { label, time: timeSince }) : t("accessibility.cardNoTime", { label })}
    >
      <LinearGradient
        colors={smoothGradient.colors}
        locations={smoothGradient.locations}
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

        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
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
          {subtitle && !isActive && (
            <Text
              style={{ fontSize: 11, color: textSecondary }}
              numberOfLines={1}
            >
              {subtitle}
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

        {isActive && onPausePress ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onPausePress();
              }}
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
              accessibilityLabel={isPaused ? t("common.resume") : t("common.pause")}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: isPaused ? "#FFFFFF" : buttonBgColor }}>
                {isPaused ? "▶" : "⏸"}
              </Text>
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onActionPress?.();
              }}
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
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>⏹</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onActionPress?.();
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: buttonBgColor,
              flexShrink: 0,
            }}
            accessibilityRole="button"
            accessibilityLabel={isActive ? t("common.stop") : t("accessibility.addActivity", { label })}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              {isActive ? "⏹" : "+"}
            </Text>
          </Pressable>
        )}
      </LinearGradient>
    </AnimatedPressable>
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

export { CompactActivityRow, type CompactActivityRowProps };
