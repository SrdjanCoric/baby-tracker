/**
 * Insight generation utilities for statistics
 */

import { isSignificantChange, type TrendDirection } from "./trends";

export type InsightType = "sleep" | "feeding" | "diaper" | "pumping" | "tummyTime";

export interface TrendData {
  type: InsightType;
  direction: TrendDirection;
  absoluteChange: number;
  percentageChange: number;
  currentValue: number;
  previousValue: number;
}

export interface Insight {
  type: InsightType;
  direction: TrendDirection;
  percentageChange: number;
  messageKey: string;
  absoluteChange: number;
  currentValue: number;
  previousValue: number;
}

const MESSAGE_KEY_MAP: Record<InsightType, { increase: string; decrease: string }> = {
  sleep: {
    increase: "insights.sleepIncrease",
    decrease: "insights.sleepDecrease",
  },
  feeding: {
    increase: "insights.feedingIncrease",
    decrease: "insights.feedingDecrease",
  },
  diaper: {
    increase: "insights.diaperIncrease",
    decrease: "insights.diaperDecrease",
  },
  pumping: {
    increase: "insights.pumpingIncrease",
    decrease: "insights.pumpingDecrease",
  },
  tummyTime: {
    increase: "insights.tummyTimeIncrease",
    decrease: "insights.tummyTimeDecrease",
  },
};

export function generateInsight(trendData: TrendData): Insight | null {
  if (trendData.direction === "stable") {
    return null;
  }

  if (!isSignificantChange(trendData.percentageChange)) {
    return null;
  }

  const messageKeys = MESSAGE_KEY_MAP[trendData.type];
  const messageKey = trendData.direction === "increase"
    ? messageKeys.increase
    : messageKeys.decrease;

  return {
    type: trendData.type,
    direction: trendData.direction,
    percentageChange: trendData.percentageChange,
    messageKey,
    absoluteChange: trendData.absoluteChange,
    currentValue: trendData.currentValue,
    previousValue: trendData.previousValue,
  };
}

export function generateInsights(trends: TrendData[]): Insight[] {
  return trends
    .map(generateInsight)
    .filter((insight): insight is Insight => insight !== null);
}

export function prioritizeInsights(insights: Insight[], limit?: number): Insight[] {
  const sorted = [...insights].sort(
    (a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange)
  );

  if (limit !== undefined && limit > 0) {
    return sorted.slice(0, limit);
  }

  return sorted;
}
