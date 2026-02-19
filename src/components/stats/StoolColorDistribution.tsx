import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";

interface StoolColorDistributionProps {
  distribution: Record<string, number>;
}

const COLOR_MAP: Record<string, string> = {
  yellow: "#EAB308",
  brown: "#92400E",
  green: "#16A34A",
  orange: "#EA580C",
  black: "#1C1917",
  white: "#D4D4D8",
  red: "#DC2626",
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function StoolColorDistribution({ distribution }: StoolColorDistributionProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-2 mt-2">
      {entries.map(([color, count]) => {
        const dotColor = COLOR_MAP[color] || "#9CA3AF";
        const bgColor = hexToRgba(dotColor, isDark ? 0.2 : 0.15);

        return (
          <View
            key={color}
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: bgColor }}
          >
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{
                backgroundColor: dotColor,
                borderWidth: color === "white" ? 1 : 0,
                borderColor: isDark ? "#4A464F" : "#D5D1CC",
              }}
            />
            <Text className="text-xs font-medium text-content-primary dark:text-content-dark-primary">
              {t(`stoolColors.${color}` as never)} {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
