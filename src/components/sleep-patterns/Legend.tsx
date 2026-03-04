import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { SleepPatternColors } from "./useSleepPatternColors";

export function Legend({ colors }: { colors: SleepPatternColors }) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: colors.nightColor,
          }}
        />
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {t("sleepPatterns.nightSleep")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: colors.napColor,
          }}
        />
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {t("sleepPatterns.napSleep")}
        </Text>
      </View>
    </View>
  );
}
