import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { SEMANTIC, SURFACE, TEXT as TEXT_COLORS } from "@/constants/colors";
import type { ActivityRangeStatus } from "@/services/activity-range-loader";

interface ActivityRangeBoundaryProps {
  status: ActivityRangeStatus;
  hasCachedData: boolean;
  onRetry: () => void;
  children: ReactNode;
}

export function ActivityRangeBoundary({
  status,
  hasCachedData,
  onRetry,
  children,
}: ActivityRangeBoundaryProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const textColor = isDark ? TEXT_COLORS.dark.secondary : TEXT_COLORS.light.secondary;
  const cardColor = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const actionColor = isDark ? SEMANTIC.neutral.dark : SEMANTIC.neutral.light;
  const errorColor = isDark ? SEMANTIC.error.dark : SEMANTIC.error.light;
  const isPending = status === "unverified" || status === "loading";

  if (isPending && !hasCachedData) {
    return (
      <View testID="statistics-range-loading" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <ActivityIndicator size="large" color={actionColor} />
        <Text style={{ color: textColor, marginTop: 12, textAlign: "center" }}>
          {t("timeline.loadingHistory")}
        </Text>
      </View>
    );
  }

  if (status === "error" && !hasCachedData) {
    return (
      <View testID="statistics-range-error" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: textColor, textAlign: "center" }}>
          {t("timeline.historyLoadError")}
        </Text>
        <Pressable
          testID="statistics-range-retry"
          accessibilityRole="button"
          onPress={onRetry}
          style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: actionColor }}
        >
          <Text style={{ color: TEXT_COLORS.light.inverse, fontWeight: "600" }}>
            {t("common.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {isPending && (
        <View testID="statistics-range-refreshing" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 8, backgroundColor: cardColor }}>
          <ActivityIndicator size="small" color={actionColor} />
          <Text style={{ color: textColor, fontSize: 12 }}>{t("timeline.loadingHistory")}</Text>
        </View>
      )}
      {status === "error" && (
        <View testID="statistics-range-error" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 8, backgroundColor: cardColor }}>
          <Text style={{ color: errorColor, fontSize: 12, flexShrink: 1 }}>
            {t("timeline.historyLoadError")}
          </Text>
          <Pressable
            testID="statistics-range-retry"
            accessibilityRole="button"
            onPress={onRetry}
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <Text style={{ color: actionColor, fontSize: 12, fontWeight: "700" }}>
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      )}
      {children}
    </View>
  );
}
