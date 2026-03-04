import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT, BORDER } from "@/constants/colors";

interface StatCardDetail {
  label: string;
  value?: string;
  children?: React.ReactNode;
}

interface StatCardProps {
  accentColor: string;
  labelColor?: string;
  label: string;
  value: string;
  subtitle?: string;
  details?: StatCardDetail[];
  children?: React.ReactNode;
}

export function StatCard({ accentColor, labelColor, label, value, subtitle, details, children }: StatCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const borderColor = isDark ? BORDER.dark.subtle : BORDER.light.subtle;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
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
      <Text style={{ fontSize: 28, fontWeight: "700", color: textPrimary }}>
        {value}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 14, color: textSecondary, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
      {children}
      {details && details.length > 0 && (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 12, gap: 10 }}>
          {details.map((detail, i) => (
            <View key={i}>
              {detail.children ? (
                <View>
                  <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>
                    {detail.label}
                  </Text>
                  {detail.children}
                </View>
              ) : (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: textSecondary }}>{detail.label}</Text>
                  {detail.value && (
                    <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary }}>{detail.value}</Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
