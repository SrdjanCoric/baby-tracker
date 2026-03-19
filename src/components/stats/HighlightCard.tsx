import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT, ACTION } from "@/constants/colors";

interface HighlightCardProps {
  accentColor: string;
  labelColor?: string;
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  comparisonText?: string;
  comparisonPositive?: boolean;
}

export function HighlightCard({
  accentColor,
  labelColor,
  label,
  value,
  unit,
  subtitle,
  comparisonText,
  comparisonPositive,
}: HighlightCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const accentMuted = isDark ? ACTION.dark.primary : ACTION.light.primary;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: labelColor ?? accentColor,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ fontSize: 36, fontWeight: "700", color: textPrimary }}>
          {value}
        </Text>
        {unit && (
          <Text style={{ fontSize: 16, color: textSecondary, marginLeft: 4 }}>
            {unit}
          </Text>
        )}
      </View>
      {subtitle && (
        <Text style={{ fontSize: 14, color: textSecondary, marginTop: 4 }}>
          {subtitle}
        </Text>
      )}
      {comparisonText && (
        <View
          style={{
            marginTop: 8,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: isDark
              ? `${accentMuted}20`
              : `${accentMuted}15`,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "500", color: accentMuted }}>
            {comparisonText}
          </Text>
        </View>
      )}
    </View>
  );
}
