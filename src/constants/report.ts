/**
 * Report constants
 * Default values and configuration for PDF report generation
 */

import type { ReportSection } from "@/types/report";

export const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  "summary",
  "feeding",
  "sleep",
  "diapers",
  "pumping",
  "growth",
  "tummyTime",
];

export const SECTION_LABELS: Record<ReportSection, string> = {
  summary: "Summary",
  feeding: "Feeding",
  sleep: "Sleep",
  diapers: "Diapers",
  pumping: "Pumping",
  growth: "Growth",
  tummyTime: "Tummy Time",
};

export const SECTION_ICONS: Record<ReportSection, string> = {
  summary: "📊",
  feeding: "🤱",
  sleep: "😴",
  diapers: "🚼",
  pumping: "🫙",
  growth: "📏",
  tummyTime: "💪",
};

export const SECTION_DESCRIPTIONS: Record<ReportSection, string> = {
  summary: "Overview of all activities",
  feeding: "Breastfeeding, bottles, and solid foods",
  sleep: "Naps and night sleep patterns",
  diapers: "Diaper changes and stool tracking",
  pumping: "Pumping sessions and volumes",
  growth: "Weight, height, and head measurements",
  tummyTime: "Tummy time sessions and goals",
};

export const PDF_MIME_TYPE = "application/pdf";
export const PDF_FILE_EXTENSION = ".pdf";

export const REPORT_COLORS = {
  primary: "#009B77",
  primaryLight: "#E8F5F1",
  secondary: "#6B7280",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  background: "#FFFFFF",
  tableHeader: "#F3F4F6",
  tableRowAlt: "#F9FAFB",
};

export const PERCENTILE_COLORS_HEX: Record<number, string> = {
  3: "#EF4444",
  15: "#F97316",
  50: "#22C55E",
  85: "#F97316",
  97: "#EF4444",
};
