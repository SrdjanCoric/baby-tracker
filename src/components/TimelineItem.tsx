import { Pressable, Text, View, useColorScheme } from "react-native";
import { forwardRef } from "react";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";

type TimelineActivityType = ActivityType;

interface TimelineItemProps {
  activity: TimelineActivityType;
  time: string;
  title: string;
  subtitle?: string;
  details?: string;
  loggedBy?: string;
  onPress?: () => void;
  testID?: string;
}

const TimelineItem = forwardRef<View, TimelineItemProps>(
  (
    {
      activity,
      time,
      title,
      subtitle,
      details,
      loggedBy,
      onPress,
      testID,
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const config = ACTIVITY_CONFIG[activity];
    const bgColor = isDark ? config.mutedBgDark : config.mutedBg;

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
            style={{ backgroundColor: bgColor }}
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
              style={{ color: config.accentColor }}
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

          {/* Logged by attribution */}
          {loggedBy && (
            <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-1">
              Logged by {loggedBy}
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
      <View className="h-px bg-border-default dark:bg-border-dark-default" />
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
