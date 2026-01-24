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

export type WeeklySummaryType = "great" | "improving" | "stable" | "attention" | "noData";

export interface WeeklySummary {
  type: WeeklySummaryType;
  emoji: string;
  titleKey: string;
  descriptionKey: string;
  descriptionParams?: Record<string, string>;
}

export function generateWeeklySummary(trends: TrendData[]): WeeklySummary {
  const significantTrends = trends.filter(
    (t) => t.direction !== "stable" && isSignificantChange(t.percentageChange)
  );

  const hasData = trends.some((t) => t.currentValue > 0 || t.previousValue > 0);
  if (!hasData) {
    return {
      type: "noData",
      emoji: "📊",
      titleKey: "insights.summary.noData",
      descriptionKey: "insights.summary.noDataDescription",
    };
  }

  if (significantTrends.length === 0) {
    return {
      type: "stable",
      emoji: "✓",
      titleKey: "insights.summary.stable",
      descriptionKey: "insights.summary.stableDescription",
    };
  }

  const sleepTrend = trends.find((t) => t.type === "sleep");
  const feedingTrend = trends.find((t) => t.type === "feeding");

  const positiveChanges = significantTrends.filter(
    (t) =>
      (t.type === "sleep" && t.direction === "increase") ||
      (t.type === "tummyTime" && t.direction === "increase")
  );

  const concerningChanges = significantTrends.filter(
    (t) =>
      (t.type === "diaper" && t.direction === "decrease" && t.percentageChange < -30) ||
      (t.type === "feeding" && t.direction === "decrease" && t.percentageChange < -30)
  );

  if (concerningChanges.length > 0) {
    const concern = concerningChanges[0];
    const activityName = concern.type === "feeding" ? "feedings" : "diapers";
    return {
      type: "attention",
      emoji: "👀",
      titleKey: "insights.summary.attention",
      descriptionKey: "insights.summary.attentionDescription",
      descriptionParams: { activity: activityName },
    };
  }

  if (positiveChanges.length > 0) {
    const bestImprovement = positiveChanges.reduce((best, current) =>
      current.percentageChange > best.percentageChange ? current : best
    );
    const activityName = bestImprovement.type === "sleep" ? "sleep" : "tummy time";
    return {
      type: "great",
      emoji: "🌟",
      titleKey: "insights.summary.great",
      descriptionKey: "insights.summary.greatDescription",
      descriptionParams: { activity: activityName },
    };
  }

  if (sleepTrend && sleepTrend.direction === "increase" && isSignificantChange(sleepTrend.percentageChange)) {
    return {
      type: "improving",
      emoji: "😊",
      titleKey: "insights.summary.improving",
      descriptionKey: "insights.summary.improvingDescription",
    };
  }

  if (feedingTrend && isSignificantChange(feedingTrend.percentageChange)) {
    const direction = feedingTrend.direction === "increase" ? "more" : "less";
    return {
      type: "stable",
      emoji: "📈",
      titleKey: "insights.summary.feedingChange",
      descriptionKey: "insights.summary.feedingChangeDescription",
      descriptionParams: { direction },
    };
  }

  return {
    type: "stable",
    emoji: "✓",
    titleKey: "insights.summary.stable",
    descriptionKey: "insights.summary.stableDescription",
  };
}
