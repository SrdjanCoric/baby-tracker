import { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useGrowth } from "@/contexts/growth-context";
import { useBaby } from "@/contexts/baby-context";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS, BORDER } from "@/constants/colors";
import { calculatePercentileFromMeasurement, calculateAgeInMonths } from "@/utils/percentile-calculator";
import { isUnderTwoYears, getGrowthTrendArrow } from "@/utils/growth-helpers";
import { useUnits } from "@/contexts";
import { kgToLbs, cmToInches } from "@/utils/growth";

interface MeasurementData {
  value: number;
  measuredAt: string;
  percentile: number | null;
  change: number | null;
}

export function GrowthStatsView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { selectedBaby } = useBaby();
  const { getMeasurementHistory } = useGrowth();
  const { weightUnit, heightUnit } = useUnits();

  const accentColor = isDark ? ACTIVITY.growth.accentDark : ACTIVITY.growth.accent;
  const textAccent = isDark ? ACTIVITY.growth.textAccentDark : ACTIVITY.growth.textAccent;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT_COLORS.dark.primary : TEXT_COLORS.light.primary;
  const textSecondary = isDark ? TEXT_COLORS.dark.secondary : TEXT_COLORS.light.secondary;
  const textTertiary = isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary;
  const borderColor = isDark ? BORDER.dark.subtle : BORDER.light.subtle;

  const measurements = useMemo(() => {
    const history = getMeasurementHistory();
    if (history.length === 0) return null;

    const babyBirthDate = selectedBaby?.birthDate ? new Date(selectedBaby.birthDate) : null;
    const gender = (selectedBaby?.gender as "male" | "female") || "female";

    const findLatestWithValue = (
      key: "weightKg" | "heightCm" | "headCircumferenceCm",
      measurementType: "weight" | "height" | "head"
    ): MeasurementData | null => {
      const withValue = history.filter((m) => m[key] != null);
      if (withValue.length === 0) return null;

      const latest = withValue[0];
      const latestDate = new Date(latest.measuredAt);
      const ageMonths = babyBirthDate ? calculateAgeInMonths(babyBirthDate, latestDate) : 0;
      const percentileResult = babyBirthDate
        ? calculatePercentileFromMeasurement(gender, ageMonths, latest[key]!, measurementType)
        : null;

      let change: number | null = null;
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      const weekAgo = withValue.find((m) => {
        const diff = latestDate.getTime() - new Date(m.measuredAt).getTime();
        return diff >= fiveDaysMs && diff <= tenDaysMs;
      });

      if (weekAgo && weekAgo[key] != null) {
        if (key === "weightKg") {
          change = Math.round((latest[key]! - weekAgo[key]!) * 1000);
        } else {
          change = Math.round((latest[key]! - weekAgo[key]!) * 10) / 10;
        }
      }

      return { value: latest[key]!, measuredAt: latest.measuredAt, percentile: percentileResult?.percentile ?? null, change };
    };

    const weight = findLatestWithValue("weightKg", "weight");
    const height = findLatestWithValue("heightCm", "height");
    const head = findLatestWithValue("headCircumferenceCm", "head");
    const hasAny = weight !== null || height !== null || head !== null;
    const latestDate = [weight, height, head].filter(Boolean).sort(
      (a, b) => new Date(b!.measuredAt).getTime() - new Date(a!.measuredAt).getTime()
    )[0]?.measuredAt;

    return { weight, height, head, hasAny, latestDate };
  }, [getMeasurementHistory, selectedBaby]);

  const heightLabel = isUnderTwoYears(selectedBaby?.birthDate)
    ? t("stats.growth.length")
    : t("growth.height");

  if (!measurements || !measurements.hasAny) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📊</Text>
          <Text style={{ fontSize: 14, color: textSecondary, textAlign: "center" }}>
            {t("stats.common.noData")}
          </Text>
          <Text style={{ fontSize: 12, color: textTertiary, textAlign: "center", marginTop: 4 }}>
            {t("stats.common.noDataDescription")}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const renderRow = (
    label: string,
    data: MeasurementData,
    unit: string,
    changeUnit: string,
    isLast: boolean
  ) => (
    <View
      key={label}
      style={{
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: borderColor,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: textSecondary }}>{label}</Text>
        {data.change !== null && data.change !== 0 && (
          <Text style={{ fontSize: 12, color: textAccent, marginTop: 2 }}>
            {getGrowthTrendArrow(data.change)} {data.change > 0 ? "+" : ""}{data.change}{changeUnit} {t("stats.growth.change", { value: "" }).replace("+", "").trim()}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: textPrimary }}>
              {data.value.toFixed(3)}
            </Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginLeft: 2 }}>{unit}</Text>
          </View>
        </View>
        {data.percentile !== null && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: `${accentColor}20`,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: textAccent }}>
              {Math.round(data.percentile)}th
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const isImperialWeight = weightUnit === "lbs";
  const isImperialHeight = heightUnit === "in";

  const convertValue = (data: MeasurementData, type: "weight" | "height"): MeasurementData => {
    if (type === "weight" && isImperialWeight) {
      return {
        ...data,
        value: kgToLbs(data.value, 3),
        change: data.change !== null ? Math.round(data.change * 2.20462) : null,
      };
    }
    if (type === "height" && isImperialHeight) {
      return {
        ...data,
        value: cmToInches(data.value, 3),
        change: data.change !== null ? Math.round(cmToInches(data.change, 1) * 10) / 10 : null,
      };
    }
    return data;
  };

  const rows = [
    measurements.weight && {
      label: t("stats.growth.weight"),
      data: convertValue(measurements.weight, "weight"),
      unit: weightUnit,
      changeUnit: isImperialWeight ? "oz" : "g",
    },
    measurements.height && {
      label: heightLabel,
      data: convertValue(measurements.height, "height"),
      unit: heightUnit,
      changeUnit: heightUnit,
    },
    measurements.head && {
      label: t("stats.growth.headCircumference"),
      data: convertValue(measurements.head, "height"),
      unit: heightUnit,
      changeUnit: heightUnit,
    },
  ].filter(Boolean) as { label: string; data: MeasurementData; unit: string; changeUnit: string }[];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 12,
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, color: textAccent }}>
              {t("stats.growth.latestMeasurements")}
            </Text>
            {measurements.latestDate && (
              <Text style={{ fontSize: 12, color: textTertiary }}>
                {formatDate(measurements.latestDate)}
              </Text>
            )}
          </View>

          {rows.map((row, i) => renderRow(row.label, row.data, row.unit, row.changeUnit, i === rows.length - 1))}
        </View>

        <Pressable
          onPress={() => router.push("/growth/charts")}
          style={{
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            backgroundColor: `${accentColor}10`,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: textAccent }}>
              {t("stats.growth.viewGrowthCharts")}
            </Text>
            <Text style={{ fontSize: 14, marginLeft: 6, color: textAccent }}>→</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}
