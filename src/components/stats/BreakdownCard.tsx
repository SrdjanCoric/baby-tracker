import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT, BORDER } from "@/constants/colors";

interface BreakdownRow {
  color: string;
  label: string;
  count: number;
}

interface BreakdownCardProps {
  title: string;
  rows: BreakdownRow[];
}

export function BreakdownCard({ title, rows }: BreakdownCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const textTertiary = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;

  return (
    <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: textTertiary,
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {rows.map((row, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: borderColor,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: row.color,
              marginRight: 10,
            }}
          />
          <Text style={{ flex: 1, fontSize: 14, color: textSecondary, fontWeight: "500" }}>
            {row.label}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: textPrimary }}>
            {row.count}
          </Text>
        </View>
      ))}
    </View>
  );
}
