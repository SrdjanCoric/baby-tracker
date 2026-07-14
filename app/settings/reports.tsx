import { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useBaby, useUnits } from "@/contexts";
import { PDFService } from "@/services/pdf-service";
import { SectionSelector } from "@/components/reports";
import { DateRangePicker } from "@/components/export";
import type { ReportSection } from "@/types/report";
import type { DateRange } from "@/types/export";
import { DEFAULT_REPORT_SECTIONS } from "@/constants/report";
import { DEFAULT_DATE_RANGE_PRESET } from "@/constants/export";

function getInitialDateRange(): DateRange {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - 29);

  return {
    startDate,
    endDate,
    preset: DEFAULT_DATE_RANGE_PRESET,
  };
}

export default function ReportsScreen() {
  const { t } = useTranslation();
  const { selectedBaby } = useBaby();
  const { weightUnit, heightUnit } = useUnits();

  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSections, setSelectedSections] = useState<ReportSection[]>(
    DEFAULT_REPORT_SECTIONS
  );
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange());
  const [includeCharts, setIncludeCharts] = useState(true);

  const handleGenerate = useCallback(async () => {
    if (!selectedBaby || selectedSections.length === 0) return;

    setIsGenerating(true);
    try {
      const result = await PDFService.generateReport({
        sections: selectedSections,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        babyId: selectedBaby.id,
        babyName: selectedBaby.name,
        babyBirthDate: selectedBaby.birthDate
          ? new Date(selectedBaby.birthDate)
          : undefined,
        babyGender: selectedBaby.gender,
        includeCharts,
        weightUnit,
        heightUnit,
      });

      if (result.success && result.filePath && result.fileName) {
        await PDFService.shareReport(result.filePath, result.fileName);
      } else if (!result.success) {
        Alert.alert(
          t("reports.generateFailed"),
          result.error || t("reports.unknownError")
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Sharing is not available")
      ) {
        Alert.alert(
          t("export.sharingNotAvailable"),
          t("export.sharingNotAvailableMessage")
        );
      } else {
        Alert.alert(t("reports.generateFailed"), t("reports.unknownError"));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [selectedBaby, selectedSections, dateRange, includeCharts, weightUnit, heightUnit, t]);

  const canGenerate = selectedSections.length > 0;

  if (!selectedBaby) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface dark:bg-surface-dark"
        edges={["top", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t("reports.noBabySelected")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-surface dark:bg-surface-dark"
      edges={["top", "bottom"]}
    >
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("reports.title")}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-6">
          {t("reports.description", { babyName: selectedBaby.name })}
        </Text>

        <View className="mb-6">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </View>

        <View className="mb-6">
          <SectionSelector
            selectedSections={selectedSections}
            onSelectionChange={setSelectedSections}
          />
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between py-4 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-xl">
            <View className="flex-1">
              <Text className="text-base text-content-primary dark:text-content-dark-primary">
                {t("reports.includeCharts")}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
                {t("reports.includeChartsDescription")}
              </Text>
            </View>
            <Switch
              value={includeCharts}
              onValueChange={setIncludeCharts}
              accessibilityLabel={t("reports.includeCharts")}
              testID="include-charts-switch"
            />
          </View>
        </View>
      </ScrollView>

      <View className="px-4 pb-4 pt-2 border-t border-border-subtle dark:border-border-dark-subtle">
        {selectedSections.length > 0 && (
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center mb-3">
            {t("reports.sectionsSummary", { count: selectedSections.length })}
          </Text>
        )}

        <Pressable
          onPress={handleGenerate}
          disabled={!canGenerate || isGenerating}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGenerate || isGenerating }}
          accessibilityLabel={t("reports.generateButton")}
          testID="generate-report-button"
          className={`py-4 rounded-button-lg items-center ${
            canGenerate && !isGenerating
              ? "bg-primary-500 active:bg-primary-600"
              : "bg-gray-300 dark:bg-gray-700"
          }`}
        >
          {isGenerating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-lg font-semibold ${
                canGenerate ? "text-white" : "text-gray-500"
              }`}
            >
              {t("reports.generateButton")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
