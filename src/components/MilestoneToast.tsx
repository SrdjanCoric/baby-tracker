import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import type { AchievementId } from "@/services/achievement-detection";

interface MilestoneToastProps {
  visible: boolean;
  achievementId: AchievementId;
  emoji: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4000;

function getToastTheme(achievementId: AchievementId, isDark: boolean) {
  if (achievementId.startsWith("tummy_")) {
    return {
      bgColor: isDark ? "rgba(218, 187, 120, 0.12)" : "rgba(201, 165, 92, 0.10)",
      borderColor: isDark ? "rgba(218, 187, 120, 0.20)" : "rgba(201, 165, 92, 0.18)",
      iconBg: isDark ? "rgba(218, 187, 120, 0.15)" : "rgba(201, 165, 92, 0.12)",
      titleColor: isDark ? "#DABB78" : "#A88A3E",
      progressColor: isDark ? "#DABB78" : "#C9A55C",
    };
  }

  return {
    bgColor: isDark ? "rgba(165, 200, 138, 0.12)" : "rgba(140, 179, 105, 0.10)",
    borderColor: isDark ? "rgba(165, 200, 138, 0.20)" : "rgba(140, 179, 105, 0.18)",
    iconBg: isDark ? "rgba(165, 200, 138, 0.15)" : "rgba(140, 179, 105, 0.12)",
    titleColor: isDark ? "#A5C88A" : "#4E7A2E",
    progressColor: isDark ? "#A5C88A" : "#8CB369",
  };
}

export function MilestoneToast({
  visible,
  achievementId,
  emoji,
  onDismiss,
}: MilestoneToastProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const progressWidth = useSharedValue(100);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
      progressWidth.value = withTiming(0, {
        duration: AUTO_DISMISS_MS,
        easing: Easing.linear,
      });

      const timer = setTimeout(() => {
        translateY.value = withTiming(-120, { duration: 300 });
        opacity.value = withDelay(100, withTiming(0, { duration: 200 }));
        setTimeout(() => {
          runOnJS(onDismiss)();
        }, 350);
      }, AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    } else {
      translateY.value = -120;
      opacity.value = 0;
      progressWidth.value = 100;
    }
  }, [visible, translateY, opacity, progressWidth, onDismiss]);

  useEffect(() => {
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(opacity);
      cancelAnimation(progressWidth);
    };
  }, [translateY, opacity, progressWidth]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as `${number}%`,
  }));

  const theme = getToastTheme(achievementId, isDark);

  const titleText = t(`achievements.title.${achievementId}` as never) as string;
  const subtitleText = t(`achievements.subtitle.${achievementId}` as never) as string;

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 1000,
          backgroundColor: isDark ? "#2A2725" : "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.borderColor,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 24,
          elevation: 8,
        },
        containerStyle,
      ]}
    >
      {/* Inner tint */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.bgColor,
        }}
      />

      {/* Content row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: theme.iconBg,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: theme.titleColor,
              marginBottom: 2,
              fontFamily: "Nunito-Bold",
            }}
          >
            {titleText}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: isDark ? "#B8B3B0" : "#5C5752",
              fontFamily: "Nunito-Medium",
            }}
          >
            {subtitleText}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 3,
          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
        }}
      >
        <Animated.View
          style={[
            {
              height: "100%",
              backgroundColor: theme.progressColor,
              borderRadius: 2,
            },
            progressStyle,
          ]}
        />
      </View>
    </Animated.View>
  );
}
