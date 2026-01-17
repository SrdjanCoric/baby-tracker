import { Pressable, Text, View } from "react-native";
import { forwardRef } from "react";

type TimelineActivityType = "feeding" | "sleep" | "diaper" | "pumping" | "growth" | "tummyTime";

interface TimelineItemProps {
  activity: TimelineActivityType;
  time: string;
  title: string;
  subtitle?: string;
  details?: string;
  onPress?: () => void;
  testID?: string;
}

const activityConfig: Record<
  TimelineActivityType,
  { icon: string; color: string; bgColor: string }
> = {
  feeding: {
    icon: "🤱",
    color: "#88B04B",
    bgColor: "#E8F0E0",
  },
  sleep: {
    icon: "😴",
    color: "#6B5B95",
    bgColor: "#E8E4F0",
  },
  diaper: {
    icon: "🚼",
    color: "#D4837D",
    bgColor: "#FDF0EF",
  },
  pumping: {
    icon: "🫙",
    color: "#7B9BC9",
    bgColor: "#E8EDF5",
  },
  growth: {
    icon: "📏",
    color: "#009B77",
    bgColor: "#E0F5EF",
  },
  tummyTime: {
    icon: "💪",
    color: "#E67E22",
    bgColor: "#FEF3E2",
  },
};

const TimelineItem = forwardRef<View, TimelineItemProps>(
  (
    {
      activity,
      time,
      title,
      subtitle,
      details,
      onPress,
      testID,
    },
    ref
  ) => {
    const config = activityConfig[activity];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        testID={testID}
        className="flex-row items-start py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
        accessibilityRole="button"
        accessibilityLabel={`${title} at ${time}. ${subtitle || ""}`}
      >
        {/* Timeline connector */}
        <View className="items-center mr-4">
          {/* Activity icon circle */}
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: config.bgColor }}
          >
            <Text className="text-xl">{config.icon}</Text>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1">
          {/* Time */}
          <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-1">
            {time}
          </Text>

          {/* Title */}
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
            {title}
          </Text>

          {/* Subtitle */}
          {subtitle && (
            <Text
              className="text-sm mt-0.5"
              style={{ color: config.color }}
            >
              {subtitle}
            </Text>
          )}

          {/* Details */}
          {details && (
            <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
              {details}
            </Text>
          )}
        </View>

        {/* Edit indicator */}
        <View className="justify-center">
          <Text className="text-lg text-content-tertiary dark:text-content-dark-tertiary">
            ›
          </Text>
        </View>
      </Pressable>
    );
  }
);

TimelineItem.displayName = "TimelineItem";

// Day header component for grouping timeline items
interface TimelineDayHeaderProps {
  title: string;
  date?: string;
}

function TimelineDayHeader({ title, date }: TimelineDayHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary">
      <Text className="text-sm font-semibold text-content-secondary dark:text-content-dark-secondary uppercase tracking-wider">
        {title}
      </Text>
      {date && (
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
          {date}
        </Text>
      )}
    </View>
  );
}

// Timeline divider
function TimelineDivider() {
  return (
    <View className="ml-10 mr-4">
      <View className="h-px bg-gray-200 dark:bg-gray-700" />
    </View>
  );
}

export {
  TimelineItem,
  TimelineDayHeader,
  TimelineDivider,
  type TimelineItemProps,
  type TimelineActivityType,
  type TimelineDayHeaderProps,
};
