/**
 * Report type definitions
 * Types for PDF report generation
 */

import type { Gender } from "./growth-chart";

export type ReportSection =
  | "summary"
  | "feeding"
  | "sleep"
  | "diapers"
  | "pumping"
  | "growth"
  | "tummyTime";

export const REPORT_SECTIONS: ReportSection[] = [
  "summary",
  "feeding",
  "sleep",
  "diapers",
  "pumping",
  "growth",
  "tummyTime",
];

export interface ReportOptions {
  sections: ReportSection[];
  startDate: Date;
  endDate: Date;
  babyId: string;
  babyName: string;
  babyBirthDate?: Date;
  babyGender?: Gender;
  includeCharts: boolean;
}

export interface ReportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface ReportMetadata {
  babyName: string;
  babyAgeMonths?: number;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  totalDays: number;
}

export interface SummaryStats {
  totalFeedings: number;
  totalSleepMinutes: number;
  totalDiapers: number;
  totalPumpingMl: number;
  totalTummyTimeMinutes: number;
  growthMeasurements: number;
}

export interface FeedingReportStats {
  total: number;
  byType: {
    breast: number;
    bottle: number;
    solid: number;
  };
  breastfeeding: {
    totalSessions: number;
    totalMinutes: number;
    avgDurationMinutes: number;
    leftMinutes: number;
    rightMinutes: number;
  };
  bottle: {
    totalSessions: number;
    totalMl: number;
    avgMl: number;
    byContentType: {
      formula: number;
      breastMilk: number;
    };
  };
  solid: {
    totalSessions: number;
    uniqueFoods: string[];
  };
  avgPerDay: number;
}

export interface SleepReportStats {
  totalMinutes: number;
  totalSessions: number;
  avgDurationMinutes: number;
  avgPerDay: number;
  byType: {
    nap: {
      count: number;
      totalMinutes: number;
      avgMinutes: number;
    };
    night: {
      count: number;
      totalMinutes: number;
      avgMinutes: number;
    };
  };
  longestSleepMinutes: number;
  shortestSleepMinutes: number;
}

export interface DiaperReportStats {
  total: number;
  avgPerDay: number;
  byType: {
    wet: number;
    dirty: number;
    mixed: number;
  };
  stoolColors: Record<string, number>;
}

export interface PumpingReportStats {
  totalSessions: number;
  totalMl: number;
  avgMlPerSession: number;
  avgSessionsPerDay: number;
  totalMinutes: number;
  avgMinutesPerSession: number;
  bySide: {
    left: { sessions: number; totalMl: number };
    right: { sessions: number; totalMl: number };
    both: { sessions: number; totalMl: number };
  };
}

export interface GrowthMeasurementPoint {
  date: Date;
  ageMonths: number;
  weight?: number;
  weightPercentile?: number;
  height?: number;
  heightPercentile?: number;
  headCircumference?: number;
  headPercentile?: number;
}

export interface GrowthReportStats {
  measurements: GrowthMeasurementPoint[];
  latestWeight?: {
    value: number;
    percentile?: number;
    date: Date;
  };
  latestHeight?: {
    value: number;
    percentile?: number;
    date: Date;
  };
  latestHeadCircumference?: {
    value: number;
    percentile?: number;
    date: Date;
  };
  weightGain?: {
    startValue: number;
    endValue: number;
    change: number;
  };
  heightGain?: {
    startValue: number;
    endValue: number;
    change: number;
  };
}

export interface TummyTimeReportStats {
  totalSessions: number;
  totalMinutes: number;
  avgMinutesPerSession: number;
  avgSessionsPerDay: number;
  longestSessionMinutes: number;
  dailyGoalMinutes?: number;
  daysGoalMet: number;
  totalDays: number;
}

export interface AggregatedReportData {
  metadata: ReportMetadata;
  summary?: SummaryStats;
  feeding?: FeedingReportStats;
  sleep?: SleepReportStats;
  diapers?: DiaperReportStats;
  pumping?: PumpingReportStats;
  growth?: GrowthReportStats;
  tummyTime?: TummyTimeReportStats;
}
