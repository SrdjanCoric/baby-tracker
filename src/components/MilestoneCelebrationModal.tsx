import { useEffect, useMemo } from "react";
import { Modal, Pressable, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useTheme } from "@/contexts/theme-context";
import type { AchievementId } from "@/services/achievement-detection";

interface MilestoneCelebrationModalProps {
  visible: boolean;
  achievementId: AchievementId | "milestone_period";
  emoji: string;
  babyAgeMonths: number;
  ageGroupLabel?: string;
  onClose: () => void;
}

interface SparkleProps {
  centerX: number;
  centerY: number;
  angle: number;
  distance: number;
  delay: number;
  color: string;
  size: number;
}

function Sparkle({ centerX, centerY, angle, distance, delay, color, size }: SparkleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;

    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(1200, withTiming(0, { duration: 800 }))
      )
    );
    translateX.value = withDelay(delay, withTiming(targetX, { duration: 1800, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(targetY, { duration: 1800, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.4, { duration: 1400 })
      )
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);
    };
  }, [angle, delay, distance, opacity, scale, translateX, translateY]);

  const style = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: centerX - size / 2,
    top: centerY - size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return <Animated.View style={style} />;
}

interface GlowOrbProps {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

function GlowOrb({ x, y, size, color, delay }: GlowOrbProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    return () => cancelAnimation(opacity);
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: opacity.value,
  }));

  return <Animated.View style={style} />;
}

function getSleepEducationalNote(
  achievementId: AchievementId,
  babyAgeMonths: number,
  t: TFunction
): string {
  const hours = achievementId === "sleep_6h" ? 6 : achievementId === "sleep_8h" ? 8 : 10;
  const ageKey =
    babyAgeMonths < 3 ? "under3m" :
    babyAgeMonths < 5 ? "3to4m" :
    babyAgeMonths < 7 ? "5to6m" : "7plus";

  return t(`achievements.sleepNote.${hours}h.${ageKey}` as never) as string;
}

export function MilestoneCelebrationModal({
  visible,
  achievementId,
  emoji,
  babyAgeMonths,
  ageGroupLabel,
  onClose,
}: MilestoneCelebrationModalProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

  const contentScale = useSharedValue(0.6);
  const contentOpacity = useSharedValue(0);
  const emojiScale = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const noteOpacity = useSharedValue(0);
  const hintOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      contentScale.value = withSpring(1, { damping: 12, stiffness: 180 });
      contentOpacity.value = withTiming(1, { duration: 300 });
      emojiScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));
      labelOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
      titleOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
      noteOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));
      hintOpacity.value = withDelay(1200, withTiming(1, { duration: 600 }));
    } else {
      contentScale.value = 0.6;
      contentOpacity.value = 0;
      emojiScale.value = 0;
      labelOpacity.value = 0;
      titleOpacity.value = 0;
      noteOpacity.value = 0;
      hintOpacity.value = 0;
    }
  }, [visible, contentScale, contentOpacity, emojiScale, labelOpacity, titleOpacity, noteOpacity, hintOpacity]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: noteOpacity.value }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));

  const isMilestonePeriod = achievementId === "milestone_period";
  const isSleep = achievementId.startsWith("sleep_");

  const overlayColor = isMilestonePeriod
    ? (isDark ? "rgba(18, 17, 16, 0.92)" : "rgba(30, 27, 24, 0.93)")
    : (isDark ? "rgba(18, 15, 22, 0.92)" : "rgba(22, 18, 30, 0.93)");

  const glowColor = isMilestonePeriod
    ? "rgba(218, 187, 120, 0.12)"
    : "rgba(166, 141, 200, 0.12)";

  const accentColor = isMilestonePeriod
    ? (isDark ? "#DABB78" : "#C9A55C")
    : (isDark ? "#B5A7BD" : "#9E8DA9");

  const titleText = isMilestonePeriod
    ? (t("achievements.periodComplete", { age: ageGroupLabel }) as string)
    : (t(`achievements.title.${achievementId}` as never) as string);

  const labelText = isMilestonePeriod
    ? (t("achievements.allMilestonesComplete") as string)
    : (t("achievements.unlocked") as string);

  const noteText = isMilestonePeriod
    ? (t("achievements.periodNote") as string)
    : isSleep
      ? getSleepEducationalNote(achievementId as AchievementId, babyAgeMonths, t)
      : "";

  const sparkles = useMemo(() => {
    const count = 16;
    const colors = isMilestonePeriod
      ? ["#DABB78", "#C9A55C", "#F5E6C8", "#E8D5A0"]
      : ["#B5A7BD", "#9E8DA9", "#D4C8DC", "#C8BCD0"];

    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      distance: 90 + Math.random() * 80,
      delay: 200 + Math.random() * 600,
      color: colors[i % colors.length],
      size: 4 + Math.random() * 6,
    }));
  }, [isMilestonePeriod]);

  if (!visible) return null;

  const centerX = width / 2;
  const centerY = height * 0.38;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: overlayColor,
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={onClose}
      >
        {/* Glow orbs */}
        <GlowOrb
          x={width * 0.2}
          y={height * 0.25}
          size={200}
          color={glowColor}
          delay={0}
        />
        <GlowOrb
          x={width * 0.8}
          y={height * 0.45}
          size={160}
          color={glowColor}
          delay={1000}
        />
        <GlowOrb
          x={width * 0.5}
          y={height * 0.65}
          size={180}
          color={glowColor}
          delay={500}
        />

        {/* Sparkle particles */}
        {sparkles.map((s) => (
          <Sparkle
            key={s.id}
            centerX={centerX}
            centerY={centerY}
            angle={s.angle}
            distance={s.distance}
            delay={s.delay}
            color={s.color}
            size={s.size}
          />
        ))}

        {/* Content */}
        <Animated.View
          style={[
            {
              alignItems: "center",
              paddingHorizontal: 40,
            },
            contentStyle,
          ]}
        >
          {/* Emoji with glow ring */}
          <Animated.View
            style={[
              {
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: glowColor,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 32,
              },
              emojiStyle,
            ]}
          >
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          </Animated.View>

          {/* Label */}
          <Animated.View style={labelStyle}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 3,
                textTransform: "uppercase",
                color: accentColor,
                marginBottom: 12,
                fontFamily: "Nunito-ExtraBold",
              }}
            >
              {labelText}
            </Text>
          </Animated.View>

          {/* Title */}
          <Animated.View style={titleStyle}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "900",
                color: "#FFFFFF",
                textAlign: "center",
                lineHeight: 34,
                marginBottom: 16,
                fontFamily: "Nunito-Black",
              }}
            >
              {titleText}
            </Text>
          </Animated.View>

          {/* Educational note */}
          {noteText ? (
            <Animated.View style={noteStyle}>
              <Text
                style={{
                  fontSize: 15,
                  color: "rgba(255, 255, 255, 0.65)",
                  textAlign: "center",
                  lineHeight: 22,
                  maxWidth: 300,
                  marginBottom: 40,
                  fontFamily: "Nunito-Medium",
                }}
              >
                {noteText}
              </Text>
            </Animated.View>
          ) : null}

          {/* Dismiss hint */}
          <Animated.View style={hintStyle}>
            <Text
              style={{
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.45)",
                fontFamily: "Nunito-Regular",
              }}
            >
              {t("achievements.tapToContinue") as string}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
