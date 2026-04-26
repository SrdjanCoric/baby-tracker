import { Text, View, useColorScheme } from "react-native";
import { memo, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { SURFACE } from "@/constants/design-tokens";
import { formatDuration } from "@/utils/time";

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

  if (isSleeping || !lastWakeUpTime) return null;

  const sleepAccent = isDark ? "#A68DC8" : "#8B7BA0";
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.60)" : "#7A7570";
  const textTertiary = isDark ? "rgba(232,224,216,0.38)" : "#B0AAA5";

  const bgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const sleepR = isDark ? 166 : 139;
  const sleepG = isDark ? 141 : 123;
  const sleepB = isDark ? 200 : 160;
  const blendStart = isDark ? 0.14 : 0.08;
  const blendEnd = isDark ? 0.05 : 0.02;

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }
  const bg = hexToRgb(bgColor);
  const steps = 6;
  const gradientColors: string[] = [] as string[];
  const gradientLocations: number[] = [] as number[];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const blend = blendStart + (blendEnd - blendStart) * t;
    const r = Math.round(sleepR * blend + bg.r * (1 - blend));
    const g = Math.round(sleepG * blend + bg.g * (1 - blend));
    const b = Math.round(sleepB * blend + bg.b * (1 - blend));
    gradientColors.push(`rgb(${r},${g},${b})`);
    gradientLocations.push(t);
  }

  const borderColor = isDark
    ? "rgba(166,141,200,0.18)"
    : "rgba(139,123,160,0.12)";

  const topBorderColor = isDark
    ? "rgba(166,141,200,0.35)"
    : "rgba(139,123,160,0.25)";

  const awakeFormatted = formatDuration(awakeSeconds, "short");

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor,
        borderTopWidth: 2,
        borderTopColor: topBorderColor,
      }}
    >
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        locations={gradientLocations as [number, number, ...number[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ padding: 16, paddingHorizontal: 18, borderRadius: 15, overflow: "hidden" }}
      >
        <Text style={{ fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, color: sleepAccent, marginBottom: 4 }}>
          {t("dashboard.sleepPrediction")}
        </Text>

        <Text style={{ fontSize: 15, fontWeight: "700", color: textPrimary, marginTop: 2 }}>
          {t("dashboard.predictionsComingSoon")}
        </Text>

        <Text style={{ fontSize: 11, marginTop: 2, color: textSecondary }}>
          {babyName
            ? t("dashboard.basedOnPatterns", { name: babyName })
            : t("dashboard.basedOnPatternsGeneric")}
        </Text>
      </LinearGradient>
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
