import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useGrowth } from "@/contexts/growth-context";
import { useBaby } from "@/contexts/baby-context";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import { GrowthChart, PercentileDisplay } from "@/components";
import { calculateAgeInMonths } from "@/utils/percentile-calculator";
import { isUnderTwoYears } from "@/utils/growth-helpers";
import type { GrowthMeasurementType } from "@/types/growth-chart";

const GROWTH_TEAL = "#009B77";

type TabType = "weight" | "height" | "head";

const getTabLabel = (key: TabType, babyBirthDate: string | undefined, t: TFunction): string => {
  if (key === "height") {
    return isUnderTwoYears(babyBirthDate) ? t("growth.length") : t("growth.height");
  }
  if (key === "weight") return t("growth.weight");
  return t("growth.headCircumference");
};

const TABS: Array<{ key: TabType; icon: string }> = [
  { key: "weight", icon: "⚖️" },
  { key: "height", icon: "📏" },
  { key: "head", icon: "👶" },
];

export default function GrowthChartsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { getMeasurementHistory } = useGrowth();
  const { width: screenWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<TabType>("weight");

  // Calculate baby's birth date and current age
  const babyBirthDate = useMemo(() => {
    if (!selectedBaby?.birthDate) return null;
    return new Date(selectedBaby.birthDate);
  }, [selectedBaby]);

  const currentAgeMonths = useMemo(() => {
    if (!babyBirthDate) return null;
    return calculateAgeInMonths(babyBirthDate);
  }, [babyBirthDate]);

  // Transform measurements for chart
  const chartMeasurements = useMemo(() => {
    if (!babyBirthDate) return { weight: [], height: [], head: [] };

    const allMeasurements = getMeasurementHistory();

    const weight: Array<{
      date: Date;
      value: number;
      ageMonths: number;
      id: string;
    }> = [];
    const height: Array<{
      date: Date;
      value: number;
      ageMonths: number;
      id: string;
    }> = [];
    const head: Array<{
      date: Date;
      value: number;
      ageMonths: number;
      id: string;
    }> = [];

    allMeasurements.forEach((m) => {
      const measuredDate = new Date(m.measuredAt);
      const ageMonths = calculateAgeInMonths(babyBirthDate, measuredDate);

      if (m.weightKg != null) {
        weight.push({
          date: measuredDate,
          value: m.weightKg,
          ageMonths,
          id: m.id,
        });
      }

      if (m.heightCm != null) {
        height.push({
          date: measuredDate,
          value: m.heightCm,
          ageMonths,
          id: m.id,
        });
      }

      if (m.headCircumferenceCm != null) {
        head.push({
          date: measuredDate,
          value: m.headCircumferenceCm,
          ageMonths,
          id: m.id,
        });
      }
    });

    // Sort by age
    weight.sort((a, b) => a.ageMonths - b.ageMonths);
    height.sort((a, b) => a.ageMonths - b.ageMonths);
    head.sort((a, b) => a.ageMonths - b.ageMonths);

    return { weight, height, head };
  }, [babyBirthDate, getMeasurementHistory]);

  // Get the latest measurement for the active tab
  const latestMeasurement = useMemo(() => {
    const data = chartMeasurements[activeTab];
    if (data.length === 0) return null;
    return data[data.length - 1];
  }, [chartMeasurements, activeTab]);

  // Baby gender - default to female if not set
  const gender = selectedBaby?.gender || "female";

  // Calculate chart width
  const chartWidth = Math.min(screenWidth - 32, 400);

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  if (!babyBirthDate) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center px-6">
        <Text className="text-5xl mb-4">📅</Text>
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center">
          {t("growth.birthDateRequired")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center">
          {t("growth.birthDateRequiredDescription")}
        </Text>
      </SafeAreaView>
    );
  }

  const activeMeasurements = chartMeasurements[activeTab];
  const hasNoData = activeMeasurements.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="growth-charts-screen">
      {/* Header with drag handle */}
      <View className="items-center pt-2 pb-3">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("growth.charts")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name} •{" "}
          {currentAgeMonths !== null
            ? `${Math.floor(currentAgeMonths)} ${t("growth.monthsOld")}`
            : ""}
        </Text>
      </View>

      {/* Tab Selector */}
      <View className="flex-row mx-4 mb-4 p-1 bg-surface-secondary dark:bg-surface-dark-secondary rounded-full">
        {TABS.map((tab) => {
          const label = getTabLabel(tab.key, selectedBaby?.birthDate, t);
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-3 rounded-full items-center justify-center ${
                activeTab === tab.key
                  ? "bg-surface-card dark:bg-surface-dark-card"
                  : ""
              }`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
              accessibilityLabel={label}
            >
              <Text className="text-sm mb-0.5">{tab.icon}</Text>
              <Text
                className={`text-sm font-medium ${
                  activeTab === tab.key
                    ? "text-content-primary dark:text-content-dark-primary"
                    : "text-content-tertiary dark:text-content-dark-tertiary"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {hasNoData ? (
          // Empty state
          <View className="items-center py-12">
            <Text className="text-5xl mb-4">📊</Text>
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center">
              {t("growth.noMeasurements")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center mb-6">
              {t("growth.noMeasurementsDescription")}
            </Text>
            <Pressable
              onPress={() => router.replace("/growth")}
              className="px-6 py-3 rounded-full"
              style={{ backgroundColor: GROWTH_TEAL }}
              accessibilityRole="button"
              accessibilityLabel={t("growth.addMeasurement")}
            >
              <Text className="text-white font-semibold">
                {t("growth.addMeasurement")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Percentile Display */}
            {latestMeasurement && (
              <View className="mb-4">
                <PercentileDisplay
                  percentile={
                    latestMeasurement
                      ? (() => {
                          const { calculatePercentileFromMeasurement } =
                            require("@/utils/percentile-calculator");
                          const result = calculatePercentileFromMeasurement(
                            gender,
                            latestMeasurement.ageMonths,
                            latestMeasurement.value,
                            activeTab as GrowthMeasurementType
                          );
                          return result?.percentile ?? 50;
                        })()
                      : 50
                  }
                  measurementType={activeTab}
                  value={latestMeasurement.value}
                  unit={activeTab === "weight" ? t("settings.kg") : t("settings.cm")}
                  label={getTabLabel(activeTab, selectedBaby?.birthDate, t)}
                />
              </View>
            )}

            {/* Growth Chart */}
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-3 mb-4">
              <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary mb-2 text-center">
                {t("growth.whoPercentiles")}
              </Text>
              <GrowthChart
                gender={gender}
                measurementType={activeTab as GrowthMeasurementType}
                measurements={activeMeasurements}
                width={chartWidth - 24}
                height={280}
              />
            </View>

            {/* Measurement History */}
            <View className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-4">
              <Text className="text-sm font-semibold text-content-primary dark:text-content-dark-primary mb-3">
                {t("growth.measurementHistory")}
              </Text>

              {activeMeasurements
                .slice()
                .reverse()
                .slice(0, 5)
                .filter((m) => m.value != null && Number.isFinite(m.value))
                .map((m, index) => (
                  <View
                    key={m.id}
                    className={`flex-row justify-between items-center py-2 ${
                      index > 0
                        ? "border-t border-border-subtle dark:border-border-dark-subtle"
                        : ""
                    }`}
                  >
                    <View>
                      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                        {m.date.toLocaleDateString()}
                      </Text>
                      <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
                        {m.ageMonths.toFixed(1)} {t("growth.months")}
                      </Text>
                    </View>
                    <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
                      {activeTab === "weight"
                        ? `${m.value.toFixed(2)} kg`
                        : `${m.value.toFixed(1)} cm`}
                    </Text>
                  </View>
                ))}

              {activeMeasurements.length > 5 && (
                <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary text-center mt-2">
                  {t("growth.showingRecent", { count: 5 })}
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Measurement Button */}
      {!hasNoData && (
        <View className="px-4 pb-4">
          <Pressable
            onPress={() => router.replace("/growth")}
            className="w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98]"
            style={{ backgroundColor: GROWTH_TEAL }}
            accessibilityRole="button"
            accessibilityLabel={t("growth.addMeasurement")}
          >
            <Text className="text-white text-lg font-semibold">
              {t("growth.addMeasurement")}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
