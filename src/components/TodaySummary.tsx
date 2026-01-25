import { Text, View, Platform } from "react-native";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ACTIVITY_CONFIG } from "@/constants/activities";

const isAndroid = Platform.OS === "android";

interface TodaySummaryProps {
  feedingTotal?: string;
  napCount?: number;
  diaperCount?: number;
  sleepTotal?: string;
  testID?: string;
}

interface SummaryStatProps {
  value: string | number;
  label: string;
  color: string;
}

function SummaryStat({ value, label, color }: SummaryStatProps) {
  return (
    <View className="items-center">
      <Text
        className="text-stat-sm font-semibold"
        style={{ color }}
      >
        {value}
      </Text>
      <Text className="text-xs text-content-secondary dark:text-content-dark-primary mt-0.5 uppercase tracking-wider">
        {label}
      </Text>
    </View>
  );
}

function SummaryDivider() {
  return (
    <View className="w-px h-8 bg-border-default dark:bg-border-dark-default mx-4" />
  );
}

const TodaySummary = forwardRef<View, TodaySummaryProps>(
  (
    {
      feedingTotal = "0 oz",
      napCount = 0,
      diaperCount = 0,
      sleepTotal,
      testID,
    },
    ref
  ) => {
    const { t } = useTranslation();

    // Extract numeric value from feedingTotal for pluralization
    const feedingCount = parseInt(feedingTotal) || 0;

    return (
      <View
        ref={ref}
        testID={testID}
        className={`bg-surface-card dark:bg-surface-dark-card rounded-card ${isAndroid ? "p-3" : "p-4"}`}
      >
        {/* Header */}
        <View className={`flex-row items-center ${isAndroid ? "mb-2" : "mb-4"}`}>
          <View className="h-px flex-1 bg-border-default dark:bg-border-dark-default" />
          <Text className="px-3 text-sm text-content-secondary dark:text-content-dark-primary uppercase tracking-wider font-semibold">
            {t("summary.today")}
          </Text>
          <View className="h-px flex-1 bg-border-default dark:bg-border-dark-default" />
        </View>

        {/* Stats row */}
        <View className="flex-row items-center justify-center">
          <SummaryStat
            value={feedingTotal}
            label={t("summary.feeding", { count: feedingCount })}
            color={ACTIVITY_CONFIG.feeding.accentColor}
          />

          <SummaryDivider />

          <SummaryStat
            value={napCount}
            label={t("summary.nap", { count: napCount })}
            color={ACTIVITY_CONFIG.sleep.accentColor}
          />

          <SummaryDivider />

          <SummaryStat
            value={diaperCount}
            label={t("summary.diaper", { count: diaperCount })}
            color={ACTIVITY_CONFIG.diaper.accentColor}
          />

          {sleepTotal && (
            <>
              <SummaryDivider />
              <SummaryStat
                value={sleepTotal}
                label={t("summary.sleep")}
                color={ACTIVITY_CONFIG.sleep.accentColor}
              />
            </>
          )}
        </View>
      </View>
    );
  }
);

TodaySummary.displayName = "TodaySummary";

export { TodaySummary, type TodaySummaryProps };
