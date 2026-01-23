import { Pressable, Text, View, useColorScheme } from "react-native";
import { forwardRef, useCallback } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { CONTENT_COLORS } from "@/constants/design-tokens";

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
    const config = ACTIVITY_CONFIG[activity];
    const bgColor = isDark ? config.mutedBgDark : config.mutedBg;
    const colors = isDark ? CONTENT_COLORS.dark : CONTENT_COLORS.light;
    const textColor = colors.primary;
    const secondaryTextColor = colors.secondary;

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
                className="text-xl font-bold"
                style={{ color: config.accentColor }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {activeLabel || "Active"}
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: secondaryTextColor }}
                numberOfLines={1}
              >
                {timeSince}
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
                  className="text-sm mt-1"
                  style={{ color: secondaryTextColor }}
                  numberOfLines={1}
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

export { DashboardCard, type DashboardCardProps };
export type { ActivityType } from "@/constants/activities";
