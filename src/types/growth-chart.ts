/**
 * Types for WHO growth chart calculations and display
 */

import type { TFunction } from "i18next";

export type Gender = "male" | "female";

export type GrowthMeasurementType = "weight" | "height" | "head";

export type PercentileLine = 3 | 15 | 50 | 85 | 97;

export const PERCENTILE_LINES: PercentileLine[] = [3, 15, 50, 85, 97];

/**
 * LMS parameters for percentile calculation
 * L = power in the Box-Cox transformation
 * M = median
 * S = coefficient of variation
 */
export interface LMSParameters {
  L: number;
  M: number;
  S: number;
}

/**
 * WHO data point for a specific age in months
 */
export interface WHODataPoint {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
}

/**
 * Complete WHO dataset for a specific measurement type and gender
 */
export interface WHODataset {
  measurementType: GrowthMeasurementType;
  gender: Gender;
  dataPoints: WHODataPoint[];
}

/**
 * Percentile calculation result
 */
export interface PercentileResult {
  percentile: number;
  zScore: number;
  measurement: number;
  ageMonths: number;
  measurementType: GrowthMeasurementType;
}

/**
 * Point to be plotted on a growth chart
 */
export interface GrowthChartPoint {
  ageMonths: number;
  value: number;
  percentile: number;
  zScore: number;
  date: Date;
  measurementId: string;
}

/**
 * Percentile line data for chart rendering
 */
export interface PercentileLineData {
  percentile: PercentileLine;
  points: Array<{
    ageMonths: number;
    value: number;
  }>;
}

/**
 * Chart configuration
 */
export interface GrowthChartConfig {
  measurementType: GrowthMeasurementType;
  gender: Gender;
  minAgeMonths: number;
  maxAgeMonths: number;
  yAxisLabel: string;
  yAxisUnit: string;
}

/**
 * Labels and configuration for each measurement type
 */
export const MEASUREMENT_CONFIG: Record<
  GrowthMeasurementType,
  {
    label: string;
    unit: string;
    yAxisLabel: string;
    valueRange: { min: number; max: number };
  }
> = {
  weight: {
    label: "Weight",
    unit: "kg",
    yAxisLabel: "Weight (kg)",
    valueRange: { min: 0, max: 25 },
  },
  height: {
    label: "Height",
    unit: "cm",
    yAxisLabel: "Height (cm)",
    valueRange: { min: 40, max: 120 },
  },
  head: {
    label: "Head Circumference",
    unit: "cm",
    yAxisLabel: "Head (cm)",
    valueRange: { min: 30, max: 55 },
  },
};

/**
 * Age range for charts (0-24 months)
 */
export const CHART_AGE_RANGE = {
  min: 0,
  max: 24,
};

/**
 * Percentile classification for display
 */
export type PercentileClassification =
  | "very_low"
  | "low"
  | "normal"
  | "high"
  | "very_high";

export function classifyPercentile(percentile: number): PercentileClassification {
  if (percentile < 3) return "very_low";
  if (percentile < 15) return "low";
  if (percentile <= 85) return "normal";
  if (percentile <= 97) return "high";
  return "very_high";
}

/**
 * Get user-friendly label for percentile classification
 */
export function getPercentileClassificationLabel(
  classification: PercentileClassification,
  t: TFunction
): string {
  switch (classification) {
    case "very_low":
      return t("growth.percentileVeryLow");
    case "low":
      return t("growth.percentileLow");
    case "normal":
      return t("growth.percentileNormal");
    case "high":
      return t("growth.percentileHigh");
    case "very_high":
      return t("growth.percentileVeryHigh");
  }
}

/**
 * Colors for percentile lines
 */
export const PERCENTILE_COLORS: Record<PercentileLine, string> = {
  3: "#ef4444", // red
  15: "#f97316", // orange
  50: "#22c55e", // green
  85: "#f97316", // orange
  97: "#ef4444", // red
};

/**
 * Colors for percentile zones (shaded areas)
 */
export const PERCENTILE_ZONE_COLORS = {
  extreme_low: "rgba(239, 68, 68, 0.1)", // below 3rd
  low: "rgba(249, 115, 22, 0.1)", // 3rd-15th
  normal: "rgba(34, 197, 94, 0.1)", // 15th-85th
  high: "rgba(249, 115, 22, 0.1)", // 85th-97th
  extreme_high: "rgba(239, 68, 68, 0.1)", // above 97th
};
