/**
 * Timeline components - Redesigned with date cards and vertical accent lines
 * Warm, nurturing journal aesthetic
 */

import { Pressable, Text, View, useColorScheme } from "react-native";
import { forwardRef } from "react";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { SURFACE_COLORS, CONTENT_COLORS, BORDER_COLORS } from "@/constants/design-tokens";
import { getDateParts } from "@/utils/timeline";
import type { FilterType } from "./timeline/ActivityFilterTabs";
import { useAppTranslation } from "@/hooks/useAppTranslation";

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
  isLast?: boolean;
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
      isLast = false,
    },
    ref
  ) => {
    const { t } = useAppTranslation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const config = ACTIVITY_CONFIG[activity];
    const bgColor = isDark ? config.mutedBgDark : config.mutedBg;
    const cardBg = isDark ? SURFACE_COLORS.dark.card : SURFACE_COLORS.light.card;
    const borderColor = isDark ? BORDER_COLORS.dark.subtle : BORDER_COLORS.light.subtle;

    return (
      <View className="flex-row pl-4" ref={ref}>
        {/* Vertical accent line */}
        <View className="w-8 items-center">
          <View
            className="w-0.5 flex-1"
            style={{
              backgroundColor: isLast ? "transparent" : (isDark ? BORDER_COLORS.dark.default : BORDER_COLORS.light.default),
            }}
          />
        </View>

        {/* Entry card */}
        <Pressable
          onPress={onPress}
          testID={testID}
          className="flex-1 mr-4 mb-3 rounded-2xl overflow-hidden active:opacity-90"
          style={{
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: borderColor,
            borderLeftWidth: 4,
            borderLeftColor: config.accentColor,
          }}
          accessibilityRole="button"
          accessibilityLabel={`${title} at ${time}. ${subtitle || ""}`}
        >
          <View className="flex-row items-start p-3">
            {/* Activity icon */}
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: bgColor }}
            >
              <Text className="text-lg">{config.icon}</Text>
            </View>

            {/* Content */}
            <View className="flex-1">
              {/* Time */}
              <Text className="text-xs font-medium text-content-tertiary dark:text-content-dark-tertiary mb-0.5">
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
                <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-1 italic">
                  {t("timeline.loggedBy", { name: loggedBy })}
                </Text>
              )}
            </View>

            {/* Chevron */}
            <View className="justify-center pl-2">
              <Text
                className="text-xl"
                style={{ color: isDark ? CONTENT_COLORS.dark.tertiary : CONTENT_COLORS.light.tertiary }}
              >
                ›
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }
);

TimelineItem.displayName = "TimelineItem";

// Day header component with date card and summary
interface TimelineDayHeaderProps {
  title: string;
  date?: string;
  dateObj?: Date;
  summaryLines?: string[];
  filter?: FilterType;
}

function TimelineDayHeader({ title, date, dateObj, summaryLines }: TimelineDayHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const cardBg = isDark ? SURFACE_COLORS.dark.secondary : SURFACE_COLORS.light.secondary;
  const accentColor = isDark ? "#8FC091" : "#6B9E6E";

  // Get date parts for the card
  const dateParts = dateObj ? getDateParts(dateObj) : null;

  return (
    <View className="flex-row px-4 pt-4 pb-2">
      {/* Date card */}
      {dateParts ? (
        <View
          className="w-14 rounded-xl py-2 px-1 items-center mr-3"
          style={{ backgroundColor: cardBg }}
        >
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: accentColor }}
          >
            {dateParts.dayName}
          </Text>
          <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary leading-tight">
            {dateParts.dayNumber}
          </Text>
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary uppercase">
            {dateParts.month}
          </Text>
        </View>
      ) : (
        <View className="w-14 mr-3" />
      )}

      {/* Header text and summary */}
      <View className="flex-1 justify-center">
        <Text className="text-sm font-bold text-content-primary dark:text-content-dark-primary uppercase tracking-wide mb-1">
          {title}
        </Text>
        {summaryLines && summaryLines.length > 0 && (
          <View className="gap-0.5">
            {summaryLines.slice(0, 3).map((line, index) => (
              <Text
                key={index}
                className="text-xs text-content-secondary dark:text-content-dark-secondary"
                numberOfLines={1}
              >
                {line}
              </Text>
            ))}
          </View>
        )}
        {!summaryLines && date && (
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
            {date}
          </Text>
        )}
      </View>
    </View>
  );
}

// Timeline divider - simplified for new design
function TimelineDivider() {
  return null; // No longer needed with card-based design
}

export {
  TimelineItem,
  TimelineDayHeader,
  TimelineDivider,
  type TimelineItemProps,
  type TimelineActivityType,
  type TimelineDayHeaderProps,
};
