/**
 * Export type definitions
 * Types for CSV export functionality
 */

export type ExportDataType =
  | "feedings"
  | "sleep"
  | "diapers"
  | "pumping"
  | "growth"
  | "tummyTime";

export const EXPORT_DATA_TYPES: ExportDataType[] = [
  "feedings",
  "sleep",
  "diapers",
  "pumping",
  "growth",
  "tummyTime",
];

export interface ExportOptions {
  dataTypes: ExportDataType[];
  startDate: Date;
  endDate: Date;
  babyId: string;
  babyName: string;
  includeNotes: boolean;
  /** Resolves the selected range from the server into local storage before any read. */
  ensureRangesLoaded: () => Promise<void>;
  volumeUnit?: "ml" | "oz";
  weightUnit?: "kg" | "lbs";
  heightUnit?: "cm" | "in";
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
  recordCount: number;
}

export interface ExportRecordCounts {
  feedings: number;
  sleep: number;
  diapers: number;
  pumping: number;
  growth: number;
  tummyTime: number;
}

export type DateRangePreset = "last7days" | "last30days" | "last90days" | "allTime" | "custom";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: DateRangePreset;
}

export interface CSVColumn {
  key: string;
  header: string;
}

export const FEEDING_CSV_COLUMNS: CSVColumn[] = [
  { key: "date", header: "Date" },
  { key: "time", header: "Time" },
  { key: "type", header: "Type" },
  { key: "duration", header: "Duration" },
  { key: "side", header: "Side" },
  { key: "amountMl", header: "Amount (ml)" },
  { key: "contentType", header: "Content Type" },
  { key: "foodType", header: "Food" },
  { key: "amount", header: "Solid Amount" },
  { key: "reaction", header: "Reaction" },
  { key: "notes", header: "Notes" },
  { key: "loggedBy", header: "Logged By" },
];

export const SLEEP_CSV_COLUMNS: CSVColumn[] = [
  { key: "date", header: "Date" },
  { key: "startTime", header: "Start Time" },
  { key: "endTime", header: "End Time" },
  { key: "duration", header: "Duration" },
  { key: "type", header: "Type" },
  { key: "notes", header: "Notes" },
  { key: "loggedBy", header: "Logged By" },
];

export const DIAPER_CSV_COLUMNS: CSVColumn[] = [
  { key: "date", header: "Date" },
  { key: "time", header: "Time" },
  { key: "type", header: "Type" },
  { key: "stoolColor", header: "Stool Color" },
  { key: "notes", header: "Notes" },
  { key: "loggedBy", header: "Logged By" },
];

export const PUMPING_CSV_COLUMNS: CSVColumn[] = [
  { key: "date", header: "Date" },
  { key: "time", header: "Time" },
  { key: "duration", header: "Duration" },
  { key: "volumeMl", header: "Volume (ml)" },
  { key: "side", header: "Side" },
  { key: "notes", header: "Notes" },
  { key: "loggedBy", header: "Logged By" },
];

export const GROWTH_CSV_COLUMNS: CSVColumn[] = [
  { key: "date", header: "Date" },
  { key: "weightKg", header: "Weight (kg)" },
  { key: "heightCm", header: "Height (cm)" },
  { key: "headCircumferenceCm", header: "Head Circumference (cm)" },
  { key: "notes", header: "Notes" },
  { key: "loggedBy", header: "Logged By" },
];

export const TUMMY_TIME_CSV_COLUMNS: CSVColumn[] = [
  { key: "date", header: "Date" },
  { key: "time", header: "Time" },
  { key: "duration", header: "Duration" },
  { key: "notes", header: "Notes" },
  { key: "loggedBy", header: "Logged By" },
];
