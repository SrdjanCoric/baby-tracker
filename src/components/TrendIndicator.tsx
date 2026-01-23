import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TrendDirection } from "@/utils/trends";
import { useTheme } from "@/contexts/theme-context";
import { getSemanticColor } from "@/constants/design-tokens";

interface TrendIndicatorProps {
  direction: TrendDirection;
  percentageChange: number;
  absoluteChangeFormatted?: string;
  compact?: boolean;
}

export function TrendIndicator({
  direction,
  percentageChange,
  absoluteChangeFormatted,
  compact = false,
}: TrendIndicatorProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const getArrow = () => {
    switch (direction) {
      case "increase":
        return "↑";
      case "decrease":
        return "↓";
      case "stable":
        return "→";
    }
  };

  const getColor = () => {
    switch (direction) {
      case "increase":
        return getSemanticColor("success", isDark);
      case "decrease":
        return getSemanticColor("error", isDark);
      case "stable":
        return getSemanticColor("neutral", isDark);
    }
  };

  const formatPercentage = () => {
    const rounded = Math.round(Math.abs(percentageChange));
    if (direction === "increase") {
      return `+${rounded}%`;
    } else if (direction === "decrease") {
      return `-${rounded}%`;
    }
    return "0%";
  };

  if (compact) {
    return (
      <View className="flex-row items-center">
        <Text style={{ color: getColor() }} className="text-sm font-semibold">
          {getArrow()} {formatPercentage()}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center flex-wrap">
      <Text style={{ color: getColor() }} className="text-sm font-semibold mr-1">
        {getArrow()}
      </Text>
      {absoluteChangeFormatted && (
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mr-1">
          {absoluteChangeFormatted}
        </Text>
      )}
      <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
        {t("statistics.vsLastWeek")} ({formatPercentage()})
      </Text>
    </View>
  );
}
