import { Text, View } from "react-native";

interface StackedChartData {
  label: string;
  primary: number;
  secondary: number;
}

interface StackedBarChartProps {
  data: StackedChartData[];
  primaryColor: string;
  secondaryColor: string;
  primaryLabel: string;
  secondaryLabel: string;
  maxValue?: number;
  height?: number;
  formatValue?: (value: number) => string;
  compact?: boolean;
  labelInterval?: number;
}

export function StackedBarChart({
  data,
  primaryColor,
  secondaryColor,
  primaryLabel,
  secondaryLabel,
  maxValue,
  height = 120,
  formatValue = (v) => v.toFixed(1),
  compact = false,
  labelInterval = 1,
}: StackedBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.primary + d.secondary), 1);
  const barWidth = data.length > 14
    ? Math.floor(100 / data.length) - 1
    : Math.floor(100 / data.length) - 2;

  return (
    <View className="w-full">
      <View className="flex-row items-center justify-end mb-2 gap-4">
        <View className="flex-row items-center">
          <View
            className="w-3 h-3 rounded-sm mr-1.5"
            style={{ backgroundColor: primaryColor }}
          />
          <Text className="text-xs text-content-secondary dark:text-content-dark-secondary">
            {primaryLabel}
          </Text>
        </View>
        <View className="flex-row items-center">
          <View
            className="w-3 h-3 rounded-sm mr-1.5"
            style={{ backgroundColor: secondaryColor }}
          />
          <Text className="text-xs text-content-secondary dark:text-content-dark-secondary">
            {secondaryLabel}
          </Text>
        </View>
      </View>
      <View
        className="flex-row items-end justify-between"
        style={{ height }}
      >
        {data.map((item, index) => {
          const total = item.primary + item.secondary;
          const primaryHeight = max > 0 ? (item.primary / max) * (height - 24) : 0;
          const secondaryHeight = max > 0 ? (item.secondary / max) * (height - 24) : 0;
          const hasValue = total > 0;

          return (
            <View
              key={index}
              className="items-center"
              style={{ width: `${barWidth}%` }}
            >
              {!compact && hasValue && (
                <Text
                  className="text-xs font-medium text-content-secondary dark:text-content-dark-secondary mb-1"
                  numberOfLines={1}
                >
                  {formatValue(total)}
                </Text>
              )}
              <View className="w-full">
                {item.secondary > 0 && (
                  <View
                    className="w-full rounded-t"
                    style={{
                      height: Math.max(secondaryHeight, 2),
                      backgroundColor: secondaryColor,
                    }}
                  />
                )}
                {item.primary > 0 && (
                  <View
                    className="w-full"
                    style={{
                      height: Math.max(primaryHeight, 2),
                      backgroundColor: primaryColor,
                      borderBottomLeftRadius: 4,
                      borderBottomRightRadius: 4,
                      borderTopLeftRadius: item.secondary === 0 ? 4 : 0,
                      borderTopRightRadius: item.secondary === 0 ? 4 : 0,
                    }}
                  />
                )}
                {!hasValue && (
                  <View
                    className="w-full rounded"
                    style={{
                      height: 4,
                      backgroundColor: primaryColor,
                      opacity: 0.2,
                    }}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        {data.map((item, index) => (
          <View
            key={index}
            className="items-center"
            style={{ width: `${barWidth}%` }}
          >
            <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
              {index % labelInterval === 0 ? item.label : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
