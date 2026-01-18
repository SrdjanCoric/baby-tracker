import { Text, View } from "react-native";
import { forwardRef } from "react";

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
      <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-0.5 uppercase tracking-wider">
        {label}
      </Text>
    </View>
  );
}

function SummaryDivider() {
  return (
    <View className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-4" />
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
    return (
      <View
        ref={ref}
        testID={testID}
        className="bg-surface-card dark:bg-surface-dark-card rounded-card p-4"
      >
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <View className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <Text className="px-3 text-xs text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider font-medium">
            Today
          </Text>
          <View className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </View>

        {/* Stats row */}
        <View className="flex-row items-center justify-center">
          <SummaryStat
            value={feedingTotal}
            label={feedingTotal === "1" ? "Feeding" : "Feedings"}
            color="#88B04B"
          />

          <SummaryDivider />

          <SummaryStat
            value={napCount}
            label={napCount === 1 ? "Nap" : "Naps"}
            color="#6B5B95"
          />

          <SummaryDivider />

          <SummaryStat
            value={diaperCount}
            label={diaperCount === 1 ? "Diaper" : "Diapers"}
            color="#E8A5A3"
          />

          {sleepTotal && (
            <>
              <SummaryDivider />
              <SummaryStat
                value={sleepTotal}
                label="Sleep"
                color="#6B5B95"
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
