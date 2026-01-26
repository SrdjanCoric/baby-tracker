import { Text, View, Platform } from "react-native";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ACTIVITY_CONFIG } from "@/constants/activities";

const isAndroid = Platform.OS === "android";

interface TodaySummaryProps {
  feedingCount?: number;
  sleepTotal?: string;
  wetDiaperCount?: number;
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
        className="text-xl font-semibold"
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

function DiaperStat({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View className="items-center">
      <View className="flex-row items-center">
        <Text
          className="text-xl font-semibold"
          style={{ color }}
        >
          {count}
        </Text>
        <Text className="text-xs ml-0.5">💧</Text>
      </View>
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
      feedingCount = 0,
      sleepTotal,
      wetDiaperCount = 0,
      testID,
    },
    ref
  ) => {
    const { t } = useTranslation();

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
            value={feedingCount}
            label={t("summary.feeding", { count: feedingCount })}
            color={ACTIVITY_CONFIG.feeding.accentColor}
          />

          <SummaryDivider />

          <SummaryStat
            value={sleepTotal || "--"}
            label={t("summary.sleep")}
            color={ACTIVITY_CONFIG.sleep.accentColor}
          />

          <SummaryDivider />

          <DiaperStat
            count={wetDiaperCount}
            label={t("summary.diaper", { count: wetDiaperCount })}
            color={ACTIVITY_CONFIG.diaper.accentColor}
          />
        </View>
      </View>
    );
  }
);

TodaySummary.displayName = "TodaySummary";

export { TodaySummary, type TodaySummaryProps };
