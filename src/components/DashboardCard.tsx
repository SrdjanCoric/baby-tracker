import { Pressable, Text, View, useColorScheme } from "react-native";
import { forwardRef, useCallback } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

type ActivityType = "feeding" | "sleep" | "diaper" | "pumping" | "growth" | "tummyTime";

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
  actionLabel?: string;
  testID?: string;
  progress?: number;
  subtitle?: string;
  secondaryInfo?: string;
}

const activityConfig: Record<
  ActivityType,
  {
    icon: string;
    accentColor: string;
    mutedBg: string;
    mutedBgDark: string;
  }
> = {
  feeding: {
    icon: "🤱",
    accentColor: "#88B04B",
    mutedBg: "#E8F0E0",
    mutedBgDark: "#2A3D1F",
  },
  sleep: {
    icon: "😴",
    accentColor: "#6B5B95",
    mutedBg: "#E8E4F0",
    mutedBgDark: "#2D2640",
  },
  diaper: {
    icon: "🚼",
    accentColor: "#D4837D",
    mutedBg: "#FDF0EF",
    mutedBgDark: "#3D2525",
  },
  pumping: {
    icon: "🫙",
    accentColor: "#7B9BC9",
    mutedBg: "#E8EDF5",
    mutedBgDark: "#252D3D",
  },
  growth: {
    icon: "📏",
    accentColor: "#009B77",
    mutedBg: "#E0F5EF",
    mutedBgDark: "#1A332D",
  },
  tummyTime: {
    icon: "💪",
    accentColor: "#E67E22",
    mutedBg: "#FEF3E2",
    mutedBgDark: "#3D2E1A",
  },
};

const DashboardCard = forwardRef<View, DashboardCardProps>(
  (
    {
      activity,
      label,
      timeSince,
      isActive = false,
      activeLabel,
      onPress,
      onActionPress,
      actionLabel = "+",
      testID,
      progress,
      subtitle,
      secondaryInfo,
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const config = activityConfig[activity];
    const bgColor = isDark ? config.mutedBgDark : config.mutedBg;
    const textColor = isDark ? "#FFFFFF" : "#1A1A1A";
    const secondaryTextColor = isDark ? "#A0A0A0" : "#6B6B6B";

    const cardScale = useSharedValue(1);
    const buttonScale = useSharedValue(1);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: cardScale.value }],
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: buttonScale.value }],
    }));

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

    return (
      <AnimatedPressable
        ref={ref}
        onPress={onPress}
        onPressIn={handleCardPressIn}
        onPressOut={handleCardPressOut}
        testID={testID}
        className="flex-1 rounded-[20px] p-4"
        style={[
          cardAnimatedStyle,
          {
            backgroundColor: bgColor,
            minHeight: 160,
            borderWidth: isActive ? 2 : 0,
            borderColor: isActive ? config.accentColor : "transparent",
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label} card. ${timeSince ? `Time since last: ${timeSince}` : ""}`}
      >
        {/* Top row: Icon + Label */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">{config.icon}</Text>
            <Text
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: isActive ? config.accentColor : secondaryTextColor }}
            >
              {label}
            </Text>
          </View>

          {/* Active indicator dot */}
          {isActive && (
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.accentColor }}
            />
          )}
        </View>

        {/* Main content: Time since or Active state */}
        <View className="flex-1 justify-center py-2">
          {isActive ? (
            <View>
              <Text
                className="text-2xl font-bold"
                style={{ color: config.accentColor }}
              >
                {activeLabel || "Active"}
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: secondaryTextColor }}
              >
                {timeSince}
              </Text>
            </View>
          ) : (
            <View>
              <Text
                className="text-2xl font-bold"
                style={{ color: textColor }}
              >
                {timeSince || "--:--"}
              </Text>
              {subtitle && (
                <Text
                  className="text-sm mt-1"
                  style={{ color: secondaryTextColor }}
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
                        backgroundColor: isDark ? "#3A3A3A" : `${config.accentColor}25`,
                        borderWidth: isDark ? 0 : 1,
                        borderColor: isDark ? "transparent" : `${config.accentColor}40`,
                      }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: progress >= 100 ? "#4CAF50" : config.accentColor,
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
              {secondaryInfo && (
                <Text
                  className="text-xs mt-1"
                  style={{ color: secondaryTextColor }}
                >
                  {secondaryInfo}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Action button */}
        <View className="items-end mt-1">
          <AnimatedPressable
            onPress={(e) => {
              e.stopPropagation?.();
              onActionPress?.();
            }}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            className="min-w-[48px] min-h-[48px] rounded-2xl items-center justify-center"
            style={[buttonAnimatedStyle, { backgroundColor: config.accentColor }]}
            accessibilityRole="button"
            accessibilityLabel={isActive ? "Stop" : `Add ${label}`}
          >
            <Text className="text-lg font-bold text-white">
              {isActive ? "⏹" : actionLabel}
            </Text>
          </AnimatedPressable>
        </View>
      </AnimatedPressable>
    );
  }
);

DashboardCard.displayName = "DashboardCard";

export { DashboardCard, type DashboardCardProps, type ActivityType };
