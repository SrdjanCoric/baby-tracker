import { Text, View } from "react-native";
import type { SleepPatternColors } from "./useSleepPatternColors";

export function MetricCard({
  label,
  value,
  colors,
  accentOverride,
  subtitle,
}: {
  label: string;
  value: string;
  colors: SleepPatternColors;
  accentOverride?: string;
  subtitle?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.cardBg,
        borderRadius: 12,
        padding: 12,
        minWidth: "45%",
      }}
    >
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: accentOverride || colors.textPrimary,
        }}
      >
        {value}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

export function AverageRow({
  label,
  value,
  colors,
  isLast = false,
}: {
  label: string;
  value: string;
  colors: SleepPatternColors;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: isLast ? 0 : 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}
