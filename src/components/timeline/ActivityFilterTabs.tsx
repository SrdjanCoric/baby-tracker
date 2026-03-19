/**
 * ActivityFilterTabs - Horizontal scrollable filter chips for timeline
 * Warm, soft design with activity-colored active states
 */

import { useCallback, useRef } from "react";
import { ScrollView, Pressable, Text, View, Animated } from "react-native";
import { useColorScheme } from "nativewind";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { CONTENT_COLORS, SURFACE_COLORS, BORDER_COLORS } from "@/constants/design-tokens";

export type FilterType = ActivityType | "all";

interface FilterOption {
  key: FilterType;
  labelKey: string;
  icon: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: "all", labelKey: "timeline.all", icon: "✨" },
  { key: "feeding", labelKey: "feeding.title", icon: "🍼" },
  { key: "sleep", labelKey: "sleep.title", icon: "😴" },
  { key: "diaper", labelKey: "diaper.title", icon: "🚼" },
  { key: "pumping", labelKey: "pumping.title", icon: "🫙" },
  { key: "growth", labelKey: "growth.title", icon: "📏" },
  { key: "tummyTime", labelKey: "tummyTime.title", icon: "💪" },
  { key: "health", labelKey: "health.title", icon: "💊" },
];

interface ActivityFilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function ActivityFilterTabs({
  activeFilter,
  onFilterChange,
  t,
}: ActivityFilterTabsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="border-b border-border dark:border-border-dark">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}
      >
        {FILTER_OPTIONS.map((option) => (
          <FilterChip
            key={option.key}
            option={option}
            isActive={activeFilter === option.key}
            onPress={() => onFilterChange(option.key)}
            isDark={isDark}
            t={t}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface FilterChipProps {
  option: FilterOption;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function FilterChip({ option, isActive, onPress, isDark, t }: FilterChipProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  // Get colors based on activity type
  const getChipColors = () => {
    if (!isActive) {
      return {
        bg: isDark ? SURFACE_COLORS.dark.secondary : SURFACE_COLORS.light.secondary,
        text: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary,
        border: isDark ? BORDER_COLORS.dark.subtle : BORDER_COLORS.light.subtle,
      };
    }

    if (option.key === "all") {
      return {
        bg: isDark ? "#3D3935" : "#E8E5E0",
        text: isDark ? CONTENT_COLORS.dark.primary : CONTENT_COLORS.light.primary,
        border: isDark ? "#4A463F" : "#D8D5D0",
      };
    }

    const config = ACTIVITY_CONFIG[option.key as ActivityType];
    return {
      bg: isDark ? config.mutedBgDark : config.mutedBg,
      text: config.accentColor,
      border: config.accentColor + "40",
    };
  };

  const colors = getChipColors();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="flex-row items-center px-4 py-2.5 rounded-full"
        style={{
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={t(option.labelKey)}
        testID={`filter-${option.key}`}
      >
        <Text className="text-base mr-1.5">{option.icon}</Text>
        <Text
          className="text-sm font-medium"
          style={{ color: colors.text }}
        >
          {t(option.labelKey)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
