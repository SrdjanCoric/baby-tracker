import { useCallback, useEffect, useState } from "react";
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
import { ExportService } from "@/services/export-service";
import {
  toInclusiveUtcRange,
  useActivityRangeResolver,
} from "@/hooks/useActivityRangeResolver";
import { DataTypeSelector, DateRangePicker } from "@/components/export";
import type {
  ExportDataType,
  ExportRecordCounts,
  DateRange,
} from "@/types/export";
import { DEFAULT_DATE_RANGE_PRESET, EMPTY_RECORD_COUNTS } from "@/constants/export";

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

export default function ExportScreen() {
  const { t } = useTranslation();
  const { selectedBaby } = useBaby();
  const { volumeUnit, weightUnit, heightUnit } = useUnits();

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [rangeLoadError, setRangeLoadError] = useState(false);
  const [recordCounts, setRecordCounts] = useState<ExportRecordCounts>(
    EMPTY_RECORD_COUNTS
  );
  const [selectedTypes, setSelectedTypes] = useState<ExportDataType[]>([
    "feedings",
    "sleep",
    "diapers",
    "pumping",
    "growth",
    "tummyTime",
  ]);
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange());
  const [includeNotes, setIncludeNotes] = useState(true);

  const resolveRanges = useActivityRangeResolver();
  const ensureRangesLoaded = useCallback(
    () =>
      resolveRanges(
        toInclusiveUtcRange(dateRange.startDate, dateRange.endDate)
      ),
    [resolveRanges, dateRange.startDate, dateRange.endDate]
  );

  const loadRecordCounts = useCallback(async () => {
    if (!selectedBaby) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setRangeLoadError(false);
    try {
      const counts = await ExportService.getRecordCountsInRange(
        selectedBaby.id,
        dateRange.startDate,
        dateRange.endDate,
        ensureRangesLoaded
      );
      setRecordCounts(counts);
    } catch (error) {
      console.error("Failed to load record counts:", error);
      setRangeLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBaby, dateRange.startDate, dateRange.endDate, ensureRangesLoaded]);

  useEffect(() => {
    loadRecordCounts();
  }, [loadRecordCounts]);

  const handleExport = useCallback(async () => {
    if (!selectedBaby || selectedTypes.length === 0) return;

    setIsExporting(true);
    try {
      const result = await ExportService.exportToCSV({
        dataTypes: selectedTypes,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        babyId: selectedBaby.id,
        babyName: selectedBaby.name,
        includeNotes,
        volumeUnit,
        weightUnit,
        heightUnit,
        ensureRangesLoaded,
      });

      if (result.success && result.content && result.fileName) {
        await ExportService.shareCSV(result.content, result.fileName);
      } else if (!result.success) {
        Alert.alert(
          t("export.exportFailed"),
          result.error || t("export.unknownError")
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sharing is not available")) {
        Alert.alert(t("export.sharingNotAvailable"), t("export.sharingNotAvailableMessage"));
      } else {
        Alert.alert(t("export.exportFailed"), t("export.unknownError"));
      }
    } finally {
      setIsExporting(false);
    }
  }, [selectedBaby, selectedTypes, dateRange, includeNotes, volumeUnit, weightUnit, heightUnit, ensureRangesLoaded, t]);

  const totalSelectedRecords = selectedTypes.reduce(
    (sum, type) => sum + recordCounts[type],
    0
  );

  const canExport = selectedTypes.length > 0 && totalSelectedRecords > 0;

  if (!selectedBaby) {
    return (
      <SafeAreaView
        className="flex-1 bg-surface dark:bg-surface-dark"
        edges={["top", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
            {t("export.noBabySelected")}
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
          {t("export.title")}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-6">
          {t("export.description", { babyName: selectedBaby.name })}
        </Text>

        <View className="mb-6">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </View>

        {isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" />
            <Text className="text-content-secondary dark:text-content-dark-secondary mt-2">
              {t("export.loadingCounts")}
            </Text>
          </View>
        ) : rangeLoadError ? (
          <View className="py-8 items-center" testID="export-range-error">
            <Text className="text-content-secondary dark:text-content-dark-secondary text-center">
              {t("export.rangeLoadError")}
            </Text>
            <Pressable
              onPress={loadRecordCounts}
              accessibilityRole="button"
              accessibilityLabel={t("common.retry")}
              testID="export-range-retry"
              className="mt-3 py-2 px-6 rounded-button-lg bg-primary-500 active:bg-primary-600"
            >
              <Text className="text-white font-semibold">
                {t("common.retry")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="mb-6">
              <DataTypeSelector
                selectedTypes={selectedTypes}
                recordCounts={recordCounts}
                onSelectionChange={setSelectedTypes}
              />
            </View>

            <View className="mb-6">
              <View className="flex-row items-center justify-between py-4 px-4 bg-surface-secondary dark:bg-surface-dark-secondary rounded-xl">
                <View className="flex-1">
                  <Text className="text-base text-content-primary dark:text-content-dark-primary">
                    {t("export.includeNotes")}
                  </Text>
                  <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5">
                    {t("export.includeNotesDescription")}
                  </Text>
                </View>
                <Switch
                  value={includeNotes}
                  onValueChange={setIncludeNotes}
                  accessibilityLabel={t("export.includeNotes")}
                  testID="include-notes-switch"
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View className="px-4 pb-4 pt-2 border-t border-border-subtle dark:border-border-dark-subtle">
        {totalSelectedRecords > 0 && (
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center mb-3">
            {t("export.recordsSummary", { count: totalSelectedRecords })}
          </Text>
        )}

        <Pressable
          onPress={handleExport}
          disabled={!canExport || isExporting}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canExport || isExporting }}
          accessibilityLabel={t("export.exportButton")}
          testID="export-button"
          className={`py-4 rounded-button-lg items-center ${
            canExport && !isExporting
              ? "bg-primary-500 active:bg-primary-600"
              : "bg-gray-300 dark:bg-gray-700"
          }`}
        >
          {isExporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-lg font-semibold ${
                canExport ? "text-white" : "text-gray-500"
              }`}
            >
              {t("export.exportButton")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
