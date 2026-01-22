/**
 * CSV Generator Utility
 * Functions for generating CSV content from tracking data
 */

import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { ExportDataType } from "@/types/export";

export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

export function formatCSVDate(date: Date | string | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatCSVTime(date: Date | string | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return "";

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function formatCSVDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) {
    return "";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function generateCSVRow(values: unknown[]): string {
  return values.map(escapeCSVValue).join(",");
}

export function generateCSVHeader(columns: string[]): string {
  return generateCSVRow(columns);
}

export function formatFeedingsAsCSV(
  feedings: StoredFeedingEntry[],
  includeNotes: boolean
): string {
  const headers = [
    "Date",
    "Time",
    "Type",
    "Duration",
    "Side",
    "Amount (ml)",
    "Content Type",
    "Food",
    "Solid Amount",
    "Reaction",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = feedings.map((feeding) => {
    const values = [
      formatCSVDate(feeding.startedAt),
      formatCSVTime(feeding.startedAt),
      feeding.type,
      formatCSVDuration(feeding.durationSeconds),
      feeding.side || feeding.lastFinishedSide || "",
      feeding.amountMl || "",
      feeding.contentType || "",
      feeding.foodType || "",
      feeding.amount || "",
      feeding.reaction || "",
      ...(includeNotes ? [feeding.notes || ""] : []),
      feeding.loggedBy || "",
    ];
    return generateCSVRow(values);
  });

  return [generateCSVHeader(headers), ...rows].join("\n");
}

export function formatSleepAsCSV(
  sleeps: StoredSleepEntry[],
  includeNotes: boolean
): string {
  const headers = [
    "Date",
    "Start Time",
    "End Time",
    "Duration",
    "Type",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = sleeps.map((sleep) => {
    const values = [
      formatCSVDate(sleep.startedAt),
      formatCSVTime(sleep.startedAt),
      sleep.endedAt ? formatCSVTime(sleep.endedAt) : "",
      formatCSVDuration(sleep.durationSeconds),
      sleep.type,
      ...(includeNotes ? [sleep.notes || ""] : []),
      sleep.loggedBy || "",
    ];
    return generateCSVRow(values);
  });

  return [generateCSVHeader(headers), ...rows].join("\n");
}

export function formatDiapersAsCSV(
  diapers: StoredDiaperEntry[],
  includeNotes: boolean
): string {
  const headers = [
    "Date",
    "Time",
    "Type",
    "Stool Color",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = diapers.map((diaper) => {
    const values = [
      formatCSVDate(diaper.changedAt),
      formatCSVTime(diaper.changedAt),
      diaper.type,
      diaper.stoolColor || "",
      ...(includeNotes ? [diaper.notes || ""] : []),
      diaper.loggedBy || "",
    ];
    return generateCSVRow(values);
  });

  return [generateCSVHeader(headers), ...rows].join("\n");
}

export function formatPumpingAsCSV(
  pumpings: StoredPumpingEntry[],
  includeNotes: boolean
): string {
  const headers = [
    "Date",
    "Time",
    "Duration",
    "Volume (ml)",
    "Side",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = pumpings.map((pumping) => {
    const values = [
      formatCSVDate(pumping.startedAt),
      formatCSVTime(pumping.startedAt),
      formatCSVDuration(pumping.durationSeconds),
      pumping.volumeMl || "",
      pumping.side,
      ...(includeNotes ? [pumping.notes || ""] : []),
      pumping.loggedBy || "",
    ];
    return generateCSVRow(values);
  });

  return [generateCSVHeader(headers), ...rows].join("\n");
}

export function formatGrowthAsCSV(
  growth: StoredGrowthEntry[],
  includeNotes: boolean
): string {
  const headers = [
    "Date",
    "Weight (kg)",
    "Height (cm)",
    "Head Circumference (cm)",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = growth.map((entry) => {
    const values = [
      formatCSVDate(entry.measuredAt),
      entry.weightKg || "",
      entry.heightCm || "",
      entry.headCircumferenceCm || "",
      ...(includeNotes ? [entry.notes || ""] : []),
      entry.loggedBy || "",
    ];
    return generateCSVRow(values);
  });

  return [generateCSVHeader(headers), ...rows].join("\n");
}

export function formatTummyTimeAsCSV(
  tummyTimes: StoredTummyTimeEntry[],
  includeNotes: boolean
): string {
  const headers = [
    "Date",
    "Time",
    "Duration",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = tummyTimes.map((entry) => {
    const values = [
      formatCSVDate(entry.startedAt),
      formatCSVTime(entry.startedAt),
      formatCSVDuration(entry.durationSeconds),
      ...(includeNotes ? [entry.notes || ""] : []),
      entry.loggedBy || "",
    ];
    return generateCSVRow(values);
  });

  return [generateCSVHeader(headers), ...rows].join("\n");
}

export interface CombinedExportData {
  feedings: StoredFeedingEntry[];
  sleep: StoredSleepEntry[];
  diapers: StoredDiaperEntry[];
  pumping: StoredPumpingEntry[];
  growth: StoredGrowthEntry[];
  tummyTime: StoredTummyTimeEntry[];
}

export function generateCombinedExport(
  data: CombinedExportData,
  selectedTypes: ExportDataType[],
  includeNotes: boolean
): string {
  const sections: string[] = [];

  const formatters: Record<ExportDataType, () => string> = {
    feedings: () => formatFeedingsAsCSV(data.feedings, includeNotes),
    sleep: () => formatSleepAsCSV(data.sleep, includeNotes),
    diapers: () => formatDiapersAsCSV(data.diapers, includeNotes),
    pumping: () => formatPumpingAsCSV(data.pumping, includeNotes),
    growth: () => formatGrowthAsCSV(data.growth, includeNotes),
    tummyTime: () => formatTummyTimeAsCSV(data.tummyTime, includeNotes),
  };

  const dataArrays: Record<ExportDataType, unknown[]> = {
    feedings: data.feedings,
    sleep: data.sleep,
    diapers: data.diapers,
    pumping: data.pumping,
    growth: data.growth,
    tummyTime: data.tummyTime,
  };

  for (const type of selectedTypes) {
    if (dataArrays[type].length > 0) {
      const sectionHeader = `=== ${type.toUpperCase()} ===`;
      const csvContent = formatters[type]();
      sections.push(`${sectionHeader}\n${csvContent}`);
    }
  }

  return sections.join("\n\n");
}
