import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Insight, InsightType } from "@/utils/insights";
import type { TrendDirection } from "@/utils/trends";

interface InsightCardProps {
  insight: Insight;
}

const INSIGHT_ICONS: Record<InsightType, string> = {
  sleep: "😴",
  feeding: "🤱",
  diaper: "👶",
  pumping: "🫙",
  tummyTime: "💪",
};

const getDirectionIcon = (direction: TrendDirection): string => {
  switch (direction) {
    case "increase":
      return "📈";
    case "decrease":
      return "📉";
    case "stable":
      return "➡️";
  }
};

export function InsightCard({ insight }: InsightCardProps) {
  const { t } = useTranslation();

  const icon = INSIGHT_ICONS[insight.type];
  const directionIcon = getDirectionIcon(insight.direction);
  const absPercentage = Math.abs(insight.percentageChange);

  const message = t(insight.messageKey as never, { percentage: absPercentage });

  return (
    <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4 flex-row items-center">
      <Text className="text-2xl mr-3">{directionIcon}</Text>
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-lg mr-2">{icon}</Text>
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
            {message}
          </Text>
        </View>
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
          {t("statistics.comparedToLastWeek")}
        </Text>
      </View>
    </View>
  );
}
