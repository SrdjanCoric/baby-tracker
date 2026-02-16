import { Text, View } from "react-native";

interface StackedChartData {
  label: string;
  primary: number;
  secondary: number;
  tertiary?: number;
}

interface StackedBarChartProps {
  data: StackedChartData[];
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor?: string;
  primaryLabel: string;
  secondaryLabel: string;
  tertiaryLabel?: string;
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
  tertiaryColor,
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  maxValue,
  height = 120,
  formatValue = (v) => v.toFixed(1),
  compact = false,
  labelInterval = 1,
}: StackedBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.primary + d.secondary + (d.tertiary ?? 0)), 1);
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
        {tertiaryLabel && tertiaryColor && (
          <View className="flex-row items-center">
            <View
              className="w-3 h-3 rounded-sm mr-1.5"
              style={{ backgroundColor: tertiaryColor }}
            />
            <Text className="text-xs text-content-secondary dark:text-content-dark-secondary">
              {tertiaryLabel}
            </Text>
          </View>
        )}
      </View>
      <View
        className="flex-row items-end justify-between"
        style={{ height }}
      >
        {data.map((item, index) => {
          const tertiaryValue = item.tertiary ?? 0;
          const total = item.primary + item.secondary + tertiaryValue;
          const primaryHeight = max > 0 ? (item.primary / max) * (height - 24) : 0;
          const secondaryHeight = max > 0 ? (item.secondary / max) * (height - 24) : 0;
          const tertiaryHeight = max > 0 ? (tertiaryValue / max) * (height - 24) : 0;
          const hasValue = total > 0;
          const topSegment = tertiaryValue > 0 ? "tertiary" : item.secondary > 0 ? "secondary" : "none";

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
                {tertiaryValue > 0 && tertiaryColor && (
                  <View
                    className="w-full rounded-t"
                    style={{
                      height: Math.max(tertiaryHeight, 2),
                      backgroundColor: tertiaryColor,
                    }}
                  />
                )}
                {item.secondary > 0 && (
                  <View
                    className="w-full"
                    style={{
                      height: Math.max(secondaryHeight, 2),
                      backgroundColor: secondaryColor,
                      borderTopLeftRadius: topSegment !== "tertiary" ? 4 : 0,
                      borderTopRightRadius: topSegment !== "tertiary" ? 4 : 0,
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
                      borderTopLeftRadius: topSegment === "none" ? 4 : 0,
                      borderTopRightRadius: topSegment === "none" ? 4 : 0,
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
