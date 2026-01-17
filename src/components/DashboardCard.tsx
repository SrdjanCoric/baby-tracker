import { Pressable, Text, View, useColorScheme } from "react-native";
import { forwardRef } from "react";

type ActivityType = "feeding" | "sleep" | "diaper" | "pumping" | "growth" | "tummyTime";

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
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const config = activityConfig[activity];
    const bgColor = isDark ? config.mutedBgDark : config.mutedBg;
    const textColor = isDark ? "#FFFFFF" : "#1A1A1A";
    const secondaryTextColor = isDark ? "#A0A0A0" : "#6B6B6B";

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        testID={testID}
        className="flex-1 rounded-[20px] p-4 active:scale-[0.98]"
        style={{
          backgroundColor: bgColor,
          minHeight: 160,
          borderWidth: isActive ? 2 : 0,
          borderColor: isActive ? config.accentColor : "transparent",
        }}
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
            <Text
              className="text-2xl font-bold"
              style={{ color: textColor }}
            >
              {timeSince || "--:--"}
            </Text>
          )}
        </View>

        {/* Action button */}
        <View className="items-end mt-1">
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onActionPress?.();
            }}
            className="min-w-[48px] min-h-[48px] rounded-2xl items-center justify-center active:scale-95 active:opacity-90"
            style={{ backgroundColor: config.accentColor }}
            accessibilityRole="button"
            accessibilityLabel={isActive ? "Stop" : `Add ${label}`}
          >
            <Text className="text-lg font-bold text-white">
              {isActive ? "⏹" : actionLabel}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }
);

DashboardCard.displayName = "DashboardCard";

export { DashboardCard, type DashboardCardProps, type ActivityType };
