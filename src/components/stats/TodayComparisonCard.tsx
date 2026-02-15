import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { SURFACE } from "@/constants/design-tokens";

interface TodayComparisonCardProps {
  icon: string;
  label: string;
  todayValue: string;
  averageValue: string;
  color: string;
  suffix?: string;
  suffixColor?: string;
  subtitle?: string;
}

export function TodayComparisonCard({
  icon,
  label,
  todayValue,
  averageValue,
  color,
  suffix,
  suffixColor,
  subtitle,
}: TodayComparisonCardProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="flex-1 rounded-card p-3"
      style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}
    >
      <View className="flex-row items-center mb-1.5">
        <Text className="text-base mr-1.5">{icon}</Text>
        <Text
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline">
        <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary">
          {todayValue}
        </Text>
        {suffix && (
          <Text
            className="text-base ml-1"
            style={{ color: suffixColor }}
          >
            {suffix}
          </Text>
        )}
      </View>
      {subtitle && (
        <Text className="text-xs text-content-secondary dark:text-content-dark-secondary mt-0.5" numberOfLines={2}>
          {subtitle}
        </Text>
      )}
      <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
        {t("statistics.vsAverage" as never, { value: averageValue })}
      </Text>
    </View>
  );
}
