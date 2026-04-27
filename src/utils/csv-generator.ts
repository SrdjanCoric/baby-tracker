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

/**
 * Characters that could trigger formula execution in spreadsheet applications
 */
const FORMULA_TRIGGER_CHARS = /^[=+\-@|]/;

/**
 * Sanitizes a value to prevent CSV formula injection
 * Prefixes values starting with dangerous characters with a single quote
 */
function sanitizeFormulaInjection(value: string): string {
  if (FORMULA_TRIGGER_CHARS.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let stringValue = String(value);

  stringValue = sanitizeFormulaInjection(stringValue);

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
  includeNotes: boolean,
  volumeUnit: "ml" | "oz" = "ml"
): string {
  const convertVolume = (val: number | undefined | null) => {
    if (val == null) return "";
    if (volumeUnit === "oz") return Number((val / 29.5735).toFixed(1));
    return val;
  };

  const headers = [
    "Date",
    "Time",
    "Type",
    "Duration",
    "Side",
    `Amount (${volumeUnit})`,
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
      convertVolume(feeding.amountMl),
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
  includeNotes: boolean,
  volumeUnit: "ml" | "oz" = "ml"
): string {
  const convertVolume = (val: number | undefined | null) => {
    if (val == null) return "";
    if (volumeUnit === "oz") return Number((val / 29.5735).toFixed(1));
    return val;
  };

  const headers = [
    "Date",
    "Time",
    "Duration",
    `Volume (${volumeUnit})`,
    "Side",
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const rows = pumpings.map((pumping) => {
    const values = [
      formatCSVDate(pumping.startedAt),
      formatCSVTime(pumping.startedAt),
      formatCSVDuration(pumping.durationSeconds),
      convertVolume(pumping.volumeMl),
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
  includeNotes: boolean,
  weightUnit: "kg" | "lbs" = "kg",
  heightUnit: "cm" | "in" = "cm"
): string {
  const headers = [
    "Date",
    `Weight (${weightUnit})`,
    `Height (${heightUnit})`,
    `Head Circumference (${heightUnit})`,
    ...(includeNotes ? ["Notes"] : []),
    "Logged By",
  ];

  const convertWeight = (val: number | undefined | null) => {
    if (val == null) return "";
    if (weightUnit === "lbs") return Number((val / 0.453592).toFixed(1));
    return val;
  };

  const convertLength = (val: number | undefined | null) => {
    if (val == null) return "";
    if (heightUnit === "in") return Number((val / 2.54).toFixed(1));
    return val;
  };

  const rows = growth.map((entry) => {
    const values = [
      formatCSVDate(entry.measuredAt),
      convertWeight(entry.weightKg),
      convertLength(entry.heightCm),
      convertLength(entry.headCircumferenceCm),
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

export interface ExportUnitPreferences {
  volumeUnit?: "ml" | "oz";
  weightUnit?: "kg" | "lbs";
  heightUnit?: "cm" | "in";
}

export function generateCombinedExport(
  data: CombinedExportData,
  selectedTypes: ExportDataType[],
  includeNotes: boolean,
  units: ExportUnitPreferences = {}
): string {
  const { volumeUnit = "ml", weightUnit = "kg", heightUnit = "cm" } = units;
  const sections: string[] = [];

  const formatters: Record<ExportDataType, () => string> = {
    feedings: () => formatFeedingsAsCSV(data.feedings, includeNotes, volumeUnit),
    sleep: () => formatSleepAsCSV(data.sleep, includeNotes),
    diapers: () => formatDiapersAsCSV(data.diapers, includeNotes),
    pumping: () => formatPumpingAsCSV(data.pumping, includeNotes, volumeUnit),
    growth: () => formatGrowthAsCSV(data.growth, includeNotes, weightUnit, heightUnit),
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
