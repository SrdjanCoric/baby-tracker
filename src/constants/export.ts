/**
 * Export constants
 * Default values and configuration for CSV export
 */

import type { DateRangePreset, ExportDataType, ExportRecordCounts } from "@/types/export";

export const DEFAULT_DATE_RANGE_PRESET: DateRangePreset = "last30days";

export const DATE_RANGE_PRESETS: { value: DateRangePreset; days: number | null }[] = [
  { value: "last7days", days: 7 },
  { value: "last30days", days: 30 },
  { value: "last90days", days: 90 },
  { value: "allTime", days: null },
  { value: "custom", days: null },
];

export const DEFAULT_EXPORT_OPTIONS = {
  includeNotes: true,
  dataTypes: [
    "feedings",
    "sleep",
    "diapers",
    "pumping",
    "growth",
    "tummyTime",
  ] as ExportDataType[],
};

export const EMPTY_RECORD_COUNTS: ExportRecordCounts = {
  feedings: 0,
  sleep: 0,
  diapers: 0,
  pumping: 0,
  growth: 0,
  tummyTime: 0,
};

export const CSV_MIME_TYPE = "text/csv";
export const CSV_FILE_EXTENSION = ".csv";
export const UTF8_BOM = "\uFEFF";

export const DATA_TYPE_LABELS: Record<ExportDataType, string> = {
  feedings: "Feedings",
  sleep: "Sleep",
  diapers: "Diapers",
  pumping: "Pumping",
  growth: "Growth",
  tummyTime: "Tummy Time",
};

export const DATA_TYPE_ICONS: Record<ExportDataType, string> = {
  feedings: "🍼",
  sleep: "😴",
  diapers: "👶",
  pumping: "🤱",
  growth: "📏",
  tummyTime: "🧸",
};
