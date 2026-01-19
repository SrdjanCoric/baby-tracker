import { Text, View } from "react-native";

interface ChartData {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: ChartData[];
  color: string;
  maxValue?: number;
  height?: number;
  formatValue?: (value: number) => string;
}

export function SimpleBarChart({
  data,
  color,
  maxValue,
  height = 120,
  formatValue = (v) => String(v),
}: SimpleBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.floor(100 / data.length) - 2;

  return (
    <View className="w-full">
      <View
        className="flex-row items-end justify-between"
        style={{ height }}
      >
        {data.map((item, index) => {
          const barHeight = max > 0 ? (item.value / max) * (height - 24) : 0;
          return (
            <View
              key={index}
              className="items-center"
              style={{ width: `${barWidth}%` }}
            >
              {item.value > 0 && (
                <Text
                  className="text-xs font-medium text-content-secondary dark:text-content-dark-secondary mb-1"
                  numberOfLines={1}
                >
                  {formatValue(item.value)}
                </Text>
              )}
              <View
                className="w-full rounded-t"
                style={{
                  height: Math.max(barHeight, item.value > 0 ? 4 : 0),
                  backgroundColor: color,
                  opacity: item.value > 0 ? 1 : 0.2,
                }}
              />
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
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
