import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useGrowth } from "@/contexts/growth-context";
import { useBaby } from "@/contexts/baby-context";
import { calculatePercentileFromMeasurement, calculateAgeInMonths } from "@/utils/percentile-calculator";
import { ACTIVITY_CONFIG } from "@/constants/activities";
import { SURFACE } from "@/constants/colors";
import { getGrowthTrendArrow, isUnderTwoYears } from "@/utils/growth-helpers";
import { classifyPercentile, type PercentileClassification } from "@/types/growth-chart";
import { useUnits } from "@/contexts";
import { kgToLbs, cmToInches } from "@/utils/growth";

interface MeasurementData {
  value: number;
  measuredAt: string;
  percentile: number | null;
  change: number | null;
}

interface MeasurementRowProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  measuredAt: string;
  percentile: number | null;
  change: { value: number; unit: string } | null;
  isDark: boolean;
}

function MeasurementRow({
  icon,
  label,
  value,
  unit,
  measuredAt,
  percentile,
  change,
  isDark,
}: MeasurementRowProps) {
  const { t } = useTranslation();

  const getPercentileStyle = (p: number): { color: string; bg: string } => {
    const classification = classifyPercentile(p);
    const styles: Record<PercentileClassification, { color: { light: string; dark: string }; bg: { light: string; dark: string } }> = {
      very_low: {
        color: { light: "#dc2626", dark: "#f87171" },
        bg: { light: "rgba(220, 38, 38, 0.1)", dark: "rgba(248, 113, 113, 0.15)" }
      },
      low: {
        color: { light: "#ea580c", dark: "#fb923c" },
        bg: { light: "rgba(234, 88, 12, 0.1)", dark: "rgba(251, 146, 60, 0.15)" }
      },
      normal: {
        color: { light: "#16a34a", dark: "#4ade80" },
        bg: { light: "rgba(22, 163, 74, 0.1)", dark: "rgba(74, 222, 128, 0.15)" }
      },
      high: {
        color: { light: "#ea580c", dark: "#fb923c" },
        bg: { light: "rgba(234, 88, 12, 0.1)", dark: "rgba(251, 146, 60, 0.15)" }
      },
      very_high: {
        color: { light: "#dc2626", dark: "#f87171" },
        bg: { light: "rgba(220, 38, 38, 0.1)", dark: "rgba(248, 113, 113, 0.15)" }
      },
    };
    return {
      color: isDark ? styles[classification].color.dark : styles[classification].color.light,
      bg: isDark ? styles[classification].bg.dark : styles[classification].bg.light,
    };
  };

  const formatTimeSince = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("common.today").toLowerCase();
    if (diffDays === 1) return t("common.yesterday").toLowerCase();
    return t("dashboard.daysAgo", { days: diffDays });
  };

  return (
    <View className="py-3">
      <View className="flex-row items-center">
        <Text className="text-2xl mr-3">{icon}</Text>
        <View className="flex-1">
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider">
            {label}
          </Text>
          <View className="flex-row items-baseline mt-0.5">
            <Text
              className="text-2xl font-bold"
              style={{ color: isDark ? "#F5F2F0" : "#2D2A26" }}
            >
              {value}
            </Text>
            <Text className="text-base text-content-secondary dark:text-content-dark-secondary ml-1">
              {unit}
            </Text>
            {change !== null && change.value !== 0 && (
              <Text
                className="text-sm font-medium ml-2"
                style={{
                  color: change.value > 0
                    ? (isDark ? "#4ade80" : "#16a34a")
                    : (isDark ? "#f87171" : "#dc2626"),
                }}
              >
                {getGrowthTrendArrow(change.value)} {change.value > 0 ? "+" : ""}{change.value}{change.unit}
              </Text>
            )}
          </View>
        </View>
        {percentile !== null && (
          <View
            className="px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: getPercentileStyle(percentile).bg }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: getPercentileStyle(percentile).color }}
            >
              {Math.round(percentile)}th
            </Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary ml-9 mt-1">
        {formatTimeSince(measuredAt)}
      </Text>
    </View>
  );
}

export function GrowthStatsCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { selectedBaby } = useBaby();
  const { getMeasurementHistory } = useGrowth();
  const { weightUnit, heightUnit } = useUnits();

  const accentColor = isDark
    ? ACTIVITY_CONFIG.growth.accentColorDark
    : ACTIVITY_CONFIG.growth.accentColor;

  const measurements = useMemo(() => {
    const history = getMeasurementHistory();
    if (history.length === 0) return null;

    const babyBirthDate = selectedBaby?.birthDate
      ? new Date(selectedBaby.birthDate)
      : null;

    const gender = (selectedBaby?.gender as "male" | "female") || "female";

    const findLatestWithValue = (
      key: "weightKg" | "heightCm" | "headCircumferenceCm",
      measurementType: "weight" | "height" | "head"
    ): MeasurementData | null => {
      const withValue = history.filter((m) => m[key] != null);
      if (withValue.length === 0) return null;

      const latest = withValue[0];
      const latestDate = new Date(latest.measuredAt);

      const ageMonths = babyBirthDate
        ? calculateAgeInMonths(babyBirthDate, latestDate)
        : 0;

      const percentileResult = babyBirthDate
        ? calculatePercentileFromMeasurement(gender, ageMonths, latest[key]!, measurementType)
        : null;

      // Find measurement from ~7 days ago for weekly change
      // Look for measurement between 5-10 days before latest
      let change: number | null = null;
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

      const weekAgoMeasurement = withValue.find((m) => {
        const mDate = new Date(m.measuredAt);
        const diffMs = latestDate.getTime() - mDate.getTime();
        return diffMs >= fiveDaysMs && diffMs <= tenDaysMs;
      });

      if (weekAgoMeasurement && weekAgoMeasurement[key] != null) {
        if (key === "weightKg") {
          change = Math.round((latest[key]! - weekAgoMeasurement[key]!) * 1000);
        } else {
          change = Math.round((latest[key]! - weekAgoMeasurement[key]!) * 10) / 10;
        }
      }

      return {
        value: latest[key]!,
        measuredAt: latest.measuredAt,
        percentile: percentileResult?.percentile ?? null,
        change,
      };
    };

    const weight = findLatestWithValue("weightKg", "weight");
    const height = findLatestWithValue("heightCm", "height");
    const head = findLatestWithValue("headCircumferenceCm", "head");

    const hasAnyMeasurement = weight !== null || height !== null || head !== null;

    return { weight, height, head, hasAnyMeasurement };
  }, [getMeasurementHistory, selectedBaby]);

  const handlePress = () => {
    router.push("/growth/charts");
  };

  const bgColor = isDark ? SURFACE.dark.card : SURFACE.light.card;

  if (!measurements || !measurements.hasAnyMeasurement) {
    return (
      <View className="mb-4">
        <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
          {t("growth.title")}
        </Text>
        <View
          className="rounded-card p-4"
          style={{
            backgroundColor: bgColor,
            borderLeftWidth: 3,
            borderLeftColor: accentColor,
          }}
        >
          <View className="flex-row items-center mb-3">
            <Text className="text-xl mr-2">{ACTIVITY_CONFIG.growth.icon}</Text>
            <Text
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {t("growth.title")}
            </Text>
          </View>
          <View className="items-center py-4">
            <Text className="text-3xl mb-2">📊</Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center">
              {t("growth.noMeasurements")}
            </Text>
            <Pressable
              onPress={() => router.push("/growth")}
              className="mt-3 px-4 py-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            >
              <Text className="text-white text-sm font-medium">
                {t("growth.addMeasurement")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const heightLabel = isUnderTwoYears(selectedBaby?.birthDate)
    ? t("growth.length")
    : t("growth.height");

  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
        {t("growth.title")}
      </Text>
      <View
        className="rounded-card overflow-hidden"
        style={{
          backgroundColor: bgColor,
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
        }}
      >
        <View className="p-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-xl mr-2">{ACTIVITY_CONFIG.growth.icon}</Text>
            <Text
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {t("growth.title")}
            </Text>
          </View>

          <View>
            {measurements.weight && (
              <MeasurementRow
                icon="⚖️"
                label={t("growth.weight")}
                value={weightUnit === "lbs"
                  ? kgToLbs(measurements.weight.value, 3).toFixed(3)
                  : measurements.weight.value.toFixed(3)}
                unit={weightUnit}
                measuredAt={measurements.weight.measuredAt}
                percentile={measurements.weight.percentile}
                change={
                  measurements.weight.change !== null
                    ? {
                        value: weightUnit === "lbs"
                          ? Math.round(measurements.weight.change * 2.20462)
                          : measurements.weight.change,
                        unit: weightUnit === "lbs" ? "oz" : "g",
                      }
                    : null
                }
                isDark={isDark}
              />
            )}

            {measurements.height && (
              <>
                {measurements.weight && (
                  <View className="border-t border-border-subtle dark:border-border-dark-subtle" />
                )}
                <MeasurementRow
                  icon="📏"
                  label={heightLabel}
                  value={heightUnit === "in"
                    ? cmToInches(measurements.height.value, 3).toFixed(3)
                    : measurements.height.value.toFixed(3)}
                  unit={heightUnit}
                  measuredAt={measurements.height.measuredAt}
                  percentile={measurements.height.percentile}
                  change={
                    measurements.height.change !== null
                      ? {
                          value: heightUnit === "in"
                            ? Math.round(cmToInches(measurements.height.change, 1) * 10) / 10
                            : measurements.height.change,
                          unit: heightUnit,
                        }
                      : null
                  }
                  isDark={isDark}
                />
              </>
            )}

            {measurements.head && (
              <>
                {(measurements.weight || measurements.height) && (
                  <View className="border-t border-border-subtle dark:border-border-dark-subtle" />
                )}
                <MeasurementRow
                  icon="👶"
                  label={t("growth.headCircumference")}
                  value={heightUnit === "in"
                    ? cmToInches(measurements.head.value, 3).toFixed(3)
                    : measurements.head.value.toFixed(3)}
                  unit={heightUnit}
                  measuredAt={measurements.head.measuredAt}
                  percentile={measurements.head.percentile}
                  change={
                    measurements.head.change !== null
                      ? {
                          value: heightUnit === "in"
                            ? Math.round(cmToInches(measurements.head.change, 1) * 10) / 10
                            : measurements.head.change,
                          unit: heightUnit,
                        }
                      : null
                  }
                  isDark={isDark}
                />
              </>
            )}
          </View>
        </View>

        <Pressable
          onPress={handlePress}
          className="py-3 border-t border-border-subtle dark:border-border-dark-subtle active:opacity-70"
          style={{ backgroundColor: isDark ? "rgba(136, 190, 176, 0.08)" : "rgba(106, 171, 156, 0.08)" }}
        >
          <View className="flex-row items-center justify-center">
            <Text
              className="text-sm font-semibold"
              style={{ color: accentColor }}
            >
              {t("growth.viewCharts")}
            </Text>
            <Text className="text-sm ml-1.5" style={{ color: accentColor }}>
              →
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default GrowthStatsCard;
