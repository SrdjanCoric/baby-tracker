import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT } from "@/constants/colors";

interface StatsMetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
}

export function StatsMetricCard({ label, value, subtitle }: StatsMetricCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const textTertiary = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cardBg,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "500",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          color: textTertiary,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "700", color: textPrimary }}>
        {value}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 11, color: textTertiary, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
