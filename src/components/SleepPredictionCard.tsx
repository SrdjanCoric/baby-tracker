import { Alert, Pressable, Text, View, useColorScheme } from "react-native";
import { memo, useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface SleepPredictionCardProps {
  lastWakeUpTime?: Date;
  babyName?: string;
  isSleeping?: boolean;
}

const SleepPredictionCardInner = ({
  lastWakeUpTime,
  babyName,
  isSleeping = false,
}: SleepPredictionCardProps) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [awakeSeconds, setAwakeSeconds] = useState(0);
  const [selectedNapSchedule, setSelectedNapSchedule] = useState<"3-nap" | "4-nap">("3-nap");
  const lastWakeUpRef = useRef(lastWakeUpTime);
  lastWakeUpRef.current = lastWakeUpTime;

  useEffect(() => {
    if (!lastWakeUpTime || isSleeping) {
      setAwakeSeconds(0);
      return;
    }

    const compute = () => {
      const ms = Date.now() - lastWakeUpRef.current!.getTime();
      setAwakeSeconds(Math.max(0, Math.floor(ms / 1000)));
    };

    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [lastWakeUpTime, isSleeping]);

  const handleInfoPress = useCallback(() => {
    Alert.alert(
      t("dashboard.sleepPrediction"),
      babyName
        ? t("dashboard.predictionInfoDetail", { name: babyName })
        : t("dashboard.predictionInfoDetailGeneric"),
    );
  }, [t, babyName]);

  if (isSleeping || !lastWakeUpTime) return null;

  const sleepAccent = isDark ? "#A68DC8" : "#8B7BA0";
  const sleepAccentSoft = isDark ? "#C4ADE0" : "#6B5A80";
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.60)" : "#7A7570";

  // Previous gradient fill (kept for reference):
  // dark: #27222A → #191719, light: #EDE4E2 → #F3EBE7
  const cardBg = isDark ? "#2A2725" : "transparent";

  const borderColor = isDark
    ? "#353039"
    : "rgba(139,123,160,0.15)";

  const topBorderColor = isDark
    ? "#4C4357"
    : "rgba(139,123,160,0.30)";

  const predictedTime = new Date(lastWakeUpRef.current!.getTime() + (selectedNapSchedule === "3-nap" ? 2 * 60 * 60 * 1000 : 1.5 * 60 * 60 * 1000));
  const predictedTimeStr = predictedTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const segBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const segInactiveText = isDark ? textSecondary : "#7A7570";
  const infoBg = isDark ? "rgba(166,141,200,0.12)" : "rgba(139,123,160,0.10)";

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor,
        borderTopWidth: 2,
        borderTopColor: topBorderColor,
        backgroundColor: cardBg,
      }}
    >
      <View
        style={{ padding: 20, paddingHorizontal: 22, borderRadius: 15, overflow: "hidden" }}
      >
        <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2, color: sleepAccent, marginBottom: 12 }}>
          {t("dashboard.sleepPrediction")}
        </Text>

        <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? textPrimary : "#3D3350", marginBottom: 16 }}>
          {t("dashboard.napTimeNear")}{" "}
          <Text style={{ fontWeight: "900", fontSize: 16, color: sleepAccentSoft }}>
            {predictedTimeStr}
          </Text>
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ flexDirection: "row", backgroundColor: segBg, borderRadius: 8, overflow: "hidden" }}>
          <Pressable
            onPress={() => setSelectedNapSchedule("3-nap")}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: selectedNapSchedule === "3-nap" ? sleepAccent : "transparent",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: selectedNapSchedule === "3-nap" ? "#FFFFFF" : segInactiveText }}>
              {t("dashboard.threeNapDay")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedNapSchedule("4-nap")}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: selectedNapSchedule === "4-nap" ? sleepAccent : "transparent",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: selectedNapSchedule === "4-nap" ? "#FFFFFF" : segInactiveText }}>
              {t("dashboard.fourNapDay")}
            </Text>
          </Pressable>
          </View>
          <Pressable
            onPress={handleInfoPress}
            hitSlop={8}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: infoBg,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.predictionInfo")}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: sleepAccent }}>i</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const SleepPredictionCard = memo(SleepPredictionCardInner, (prev, next) => {
  return (
    prev.lastWakeUpTime === next.lastWakeUpTime &&
    prev.babyName === next.babyName &&
    prev.isSleeping === next.isSleeping
  );
});

export { SleepPredictionCard, type SleepPredictionCardProps };
