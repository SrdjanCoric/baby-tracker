import { Pressable, Text, View, useColorScheme, Platform } from "react-native";
import { forwardRef, useCallback, useEffect } from "react";
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

const CARD_MIN_HEIGHT = Platform.OS === "android" ? 140 : 160;

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
  isLockedByOther?: boolean;
  lockedByName?: string;
  lockedElapsedTime?: string;
  babyName?: string;
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
      isLockedByOther = false,
      lockedByName,
      lockedElapsedTime,
      babyName,
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
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
    const pulseOpacity = useSharedValue(1);
    const lockedIndicatorScale = useSharedValue(1);

    useEffect(() => {
      if (isLockedByOther) {
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
    }, [isLockedByOther, pulseOpacity, lockedIndicatorScale]);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: cardScale.value }],
      opacity: isLockedByOther ? pulseOpacity.value : 1,
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: buttonScale.value }],
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
            ? `${label} in progress by ${lockedByName}`
            : `${label} card. ${timeSince ? `Time since last: ${timeSince}` : ""}`
        }
      >
        {/* Top row: Icon + Label */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">{config.icon}</Text>
            <Text
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
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
                {activity === "feeding" ? `${lockedByName} is feeding` :
                 activity === "sleep" ? `${babyName || "Baby"} is sleeping` :
                 activity === "pumping" ? "Pumping..." :
                 activity === "tummyTime" ? `${babyName || "Baby"} is on tummy` :
                 `${lockedByName} is busy`}
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

        {/* Action button or locked status */}
        <View className="items-end mt-1">
          {isLockedByOther ? (
            <View
              className={`${Platform.OS === "android" ? "min-w-[40px] min-h-[40px] rounded-xl" : "min-w-[48px] min-h-[48px] rounded-2xl"} items-center justify-center`}
              style={{ backgroundColor: isDark ? "#3A3A3A" : "#E5E5E5" }}
            >
              <Text className={`${Platform.OS === "android" ? "text-base" : "text-lg"}`}>
                ⏳
              </Text>
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
              accessibilityLabel={isActive ? "Stop" : `Add ${label}`}
            >
              <Text className={`${Platform.OS === "android" ? "text-base" : "text-lg"} font-bold text-white`}>
                {isActive ? "⏹" : actionLabel}
              </Text>
            </AnimatedPressable>
          )}
        </View>
      </AnimatedPressable>
    );
  }
);

DashboardCard.displayName = "DashboardCard";

export { DashboardCard, type DashboardCardProps };
export type { ActivityType } from "@/constants/activities";
