/**
 * Export Service
 * Handles CSV export generation and sharing
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { FeedingStorageService, StoredFeedingEntry } from "./feeding-storage";
import { SleepStorageService, StoredSleepEntry } from "./sleep-storage";
import { DiaperStorageService, StoredDiaperEntry } from "./diaper-storage";
import { PumpingStorageService, StoredPumpingEntry } from "./pumping-storage";
import { GrowthStorageService, StoredGrowthEntry } from "./growth-storage";
import { TummyTimeStorageService, StoredTummyTimeEntry } from "./tummyTime-storage";
import {
  generateCombinedExport,
  CombinedExportData,
  type ExportUnitPreferences,
} from "@/utils/csv-generator";
import type {
  ExportOptions,
  ExportResult,
  ExportRecordCounts,
  ExportDataType,
} from "@/types/export";
import { CSV_MIME_TYPE, UTF8_BOM } from "@/constants/export";

function getDateFromEntry(
  entry: StoredFeedingEntry | StoredSleepEntry | StoredPumpingEntry | StoredTummyTimeEntry
): Date {
  return new Date(entry.startedAt);
}

function getDateFromDiaper(entry: StoredDiaperEntry): Date {
  return new Date(entry.changedAt);
}

function getDateFromGrowth(entry: StoredGrowthEntry): Date {
  return new Date(entry.measuredAt);
}

function isInDateRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

function filterByDateRange<T>(
  entries: T[],
  startDate: Date,
  endDate: Date,
  getDate: (entry: T) => Date
): T[] {
  return entries.filter((entry) => {
    const entryDate = getDate(entry);
    return isInDateRange(entryDate, startDate, endDate);
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
}

interface ExportResultWithContent extends ExportResult {
  content?: string;
}

export const ExportService = {
  async getRecordCounts(babyId: string): Promise<ExportRecordCounts> {
    const [feedings, sleeps, diapers, pumpings, growth, tummyTimes] =
      await Promise.all([
        FeedingStorageService.getAllFeedings(babyId),
        SleepStorageService.getAllSleeps(babyId),
        DiaperStorageService.getAllDiapers(babyId),
        PumpingStorageService.getAllPumpings(babyId),
        GrowthStorageService.getAllMeasurements(babyId),
        TummyTimeStorageService.getAllTummyTimes(babyId),
      ]);

    return {
      feedings: feedings.length,
      sleep: sleeps.length,
      diapers: diapers.length,
      pumping: pumpings.length,
      growth: growth.length,
      tummyTime: tummyTimes.length,
    };
  },

  async getRecordCountsInRange(
    babyId: string,
    startDate: Date,
    endDate: Date,
    ensureRangesLoaded: () => Promise<void>
  ): Promise<ExportRecordCounts> {
    await ensureRangesLoaded();

    const [feedings, sleeps, diapers, pumpings, growth, tummyTimes] =
      await Promise.all([
        FeedingStorageService.getAllFeedings(babyId),
        SleepStorageService.getAllSleeps(babyId),
        DiaperStorageService.getAllDiapers(babyId),
        PumpingStorageService.getAllPumpings(babyId),
        GrowthStorageService.getAllMeasurements(babyId),
        TummyTimeStorageService.getAllTummyTimes(babyId),
      ]);

    const filteredFeedings = filterByDateRange(
      feedings,
      startDate,
      endDate,
      getDateFromEntry
    );
    const filteredSleeps = filterByDateRange(
      sleeps,
      startDate,
      endDate,
      getDateFromEntry
    );
    const filteredDiapers = filterByDateRange(
      diapers,
      startDate,
      endDate,
      getDateFromDiaper
    );
    const filteredPumpings = filterByDateRange(
      pumpings,
      startDate,
      endDate,
      getDateFromEntry
    );
    const filteredGrowth = filterByDateRange(
      growth,
      startDate,
      endDate,
      getDateFromGrowth
    );
    const filteredTummyTimes = filterByDateRange(
      tummyTimes,
      startDate,
      endDate,
      getDateFromEntry
    );

    return {
      feedings: filteredFeedings.length,
      sleep: filteredSleeps.length,
      diapers: filteredDiapers.length,
      pumping: filteredPumpings.length,
      growth: filteredGrowth.length,
      tummyTime: filteredTummyTimes.length,
    };
  },

  async exportToCSV(options: ExportOptions): Promise<ExportResultWithContent> {
    try {
      const { dataTypes, startDate, endDate, babyId, babyName, includeNotes } =
        options;

      await options.ensureRangesLoaded();

      const [feedings, sleeps, diapers, pumpings, growth, tummyTimes] =
        await Promise.all([
          dataTypes.includes("feedings")
            ? FeedingStorageService.getAllFeedings(babyId)
            : Promise.resolve([]),
          dataTypes.includes("sleep")
            ? SleepStorageService.getAllSleeps(babyId)
            : Promise.resolve([]),
          dataTypes.includes("diapers")
            ? DiaperStorageService.getAllDiapers(babyId)
            : Promise.resolve([]),
          dataTypes.includes("pumping")
            ? PumpingStorageService.getAllPumpings(babyId)
            : Promise.resolve([]),
          dataTypes.includes("growth")
            ? GrowthStorageService.getAllMeasurements(babyId)
            : Promise.resolve([]),
          dataTypes.includes("tummyTime")
            ? TummyTimeStorageService.getAllTummyTimes(babyId)
            : Promise.resolve([]),
        ]);

      const filteredFeedings = filterByDateRange(
        feedings,
        startDate,
        endDate,
        getDateFromEntry
      );
      const filteredSleeps = filterByDateRange(
        sleeps,
        startDate,
        endDate,
        getDateFromEntry
      );
      const filteredDiapers = filterByDateRange(
        diapers,
        startDate,
        endDate,
        getDateFromDiaper
      );
      const filteredPumpings = filterByDateRange(
        pumpings,
        startDate,
        endDate,
        getDateFromEntry
      );
      const filteredGrowth = filterByDateRange(
        growth,
        startDate,
        endDate,
        getDateFromGrowth
      );
      const filteredTummyTimes = filterByDateRange(
        tummyTimes,
        startDate,
        endDate,
        getDateFromEntry
      );

      const data: CombinedExportData = {
        feedings: filteredFeedings,
        sleep: filteredSleeps,
        diapers: filteredDiapers,
        pumping: filteredPumpings,
        growth: filteredGrowth,
        tummyTime: filteredTummyTimes,
      };

      const totalRecords =
        filteredFeedings.length +
        filteredSleeps.length +
        filteredDiapers.length +
        filteredPumpings.length +
        filteredGrowth.length +
        filteredTummyTimes.length;

      const units: ExportUnitPreferences = {
        volumeUnit: options.volumeUnit,
        weightUnit: options.weightUnit,
        heightUnit: options.heightUnit,
      };

      const csvContent = generateCombinedExport(
        data,
        dataTypes as ExportDataType[],
        includeNotes,
        units
      );

      const fileName = this.generateFileName(babyName, new Date());

      return {
        success: true,
        fileName,
        recordCount: totalRecords,
        content: csvContent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
        recordCount: 0,
      };
    }
  },

  generateFileName(babyName: string, date: Date): string {
    const sanitizedName = sanitizeFileName(babyName);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${sanitizedName}_export_${year}-${month}-${day}.csv`;
  },

  async shareCSV(content: string, filename: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is not available on this device");
    }

    const file = new File(Paths.document, filename);

    try {
      const contentWithBOM = UTF8_BOM + content;

      await file.write(contentWithBOM);

      await Sharing.shareAsync(file.uri, {
        mimeType: CSV_MIME_TYPE,
        dialogTitle: "Export Baby Tracker Data",
        UTI: "public.comma-separated-values-text",
      });
    } finally {
      try {
        await file.delete();
      } catch {
        // Ignore cleanup errors
      }
    }
  },
};
