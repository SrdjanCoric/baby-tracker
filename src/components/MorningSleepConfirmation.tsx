import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useTimeFormat } from "@/contexts/time-format-context";
import { formatTime } from "@/utils/time";

interface MorningSleepConfirmationProps {
  startedAt: string | Date;
  onFirstNap: () => void;
  onBackToSleep: () => void;
  disabled?: boolean;
}

export function MorningSleepConfirmation({
  startedAt,
  onFirstNap,
  onBackToSleep,
  disabled = false,
}: MorningSleepConfirmationProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { timeFormat } = useTimeFormat();
  const isDark = colorScheme === "dark";
  const date = new Date(startedAt);
  const context = `${date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} · ${formatTime(date, timeFormat)}`;
  const accent = isDark ? "#A594CF" : "#6B5B95";
  const background = isDark ? "#2E2840" : "#F0ECF7";
  const textPrimary = isDark ? "#F1ECF8" : "#2D2A26";
  const textSecondary = isDark ? "#C8BED7" : "#6F6878";

  return (
    <View
      accessibilityLabel={t("sleep.morningConfirmationAccessibility")}
      style={{
        width: "100%",
        borderRadius: 16,
        padding: 16,
        gap: 12,
        backgroundColor: background,
      }}
      testID="morning-sleep-confirmation"
    >
      <Text style={{ color: textPrimary, fontSize: 16, fontWeight: "700", textAlign: "center" }}>
        {t("sleep.morningConfirmationQuestion")}
      </Text>
      <Text
        style={{ color: textSecondary, fontSize: 13, textAlign: "center" }}
        testID="morning-confirmation-context"
      >
        {context}
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("sleep.firstNap")}
          disabled={disabled}
          onPress={onFirstNap}
          style={{
            flex: 1,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: accent,
            paddingVertical: 12,
            alignItems: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={{ color: accent, fontSize: 14, fontWeight: "700" }}>
            {t("sleep.firstNap")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("sleep.backToSleep")}
          disabled={disabled}
          onPress={onBackToSleep}
          style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: accent,
            paddingVertical: 12,
            alignItems: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
            {t("sleep.backToSleep")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
