import { describe, it, expect } from "vitest";
import {
  generateInsight,
  generateInsights,
  prioritizeInsights,
  type Insight,
  type TrendData,
} from "./insights";

describe("generateInsight", () => {
  it("generates insight for increased sleep", () => {
    const trendData: TrendData = {
      type: "sleep",
      direction: "increase",
      absoluteChange: 3600,
      percentageChange: 25,
      currentValue: 18000,
      previousValue: 14400,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("sleep");
    expect(insight?.direction).toBe("increase");
    expect(insight?.percentageChange).toBe(25);
    expect(insight?.messageKey).toBe("insights.sleepIncrease");
  });

  it("generates insight for decreased sleep", () => {
    const trendData: TrendData = {
      type: "sleep",
      direction: "decrease",
      absoluteChange: -3600,
      percentageChange: -25,
      currentValue: 10800,
      previousValue: 14400,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("sleep");
    expect(insight?.direction).toBe("decrease");
    expect(insight?.messageKey).toBe("insights.sleepDecrease");
  });

  it("generates insight for increased feedings", () => {
    const trendData: TrendData = {
      type: "feeding",
      direction: "increase",
      absoluteChange: 5,
      percentageChange: 25,
      currentValue: 25,
      previousValue: 20,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("feeding");
    expect(insight?.direction).toBe("increase");
    expect(insight?.messageKey).toBe("insights.feedingIncrease");
  });

  it("generates insight for decreased feedings", () => {
    const trendData: TrendData = {
      type: "feeding",
      direction: "decrease",
      absoluteChange: -5,
      percentageChange: -25,
      currentValue: 15,
      previousValue: 20,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.direction).toBe("decrease");
    expect(insight?.messageKey).toBe("insights.feedingDecrease");
  });

  it("generates insight for increased diapers", () => {
    const trendData: TrendData = {
      type: "diaper",
      direction: "increase",
      absoluteChange: 10,
      percentageChange: 25,
      currentValue: 50,
      previousValue: 40,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("diaper");
    expect(insight?.messageKey).toBe("insights.diaperIncrease");
  });

  it("generates insight for decreased diapers", () => {
    const trendData: TrendData = {
      type: "diaper",
      direction: "decrease",
      absoluteChange: -10,
      percentageChange: -25,
      currentValue: 30,
      previousValue: 40,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.messageKey).toBe("insights.diaperDecrease");
  });

  it("returns null for stable trends", () => {
    const trendData: TrendData = {
      type: "sleep",
      direction: "stable",
      absoluteChange: 0,
      percentageChange: 0,
      currentValue: 14400,
      previousValue: 14400,
    };

    const insight = generateInsight(trendData);

    expect(insight).toBeNull();
  });

  it("returns null for non-significant changes (< 20%)", () => {
    const trendData: TrendData = {
      type: "sleep",
      direction: "increase",
      absoluteChange: 1000,
      percentageChange: 10,
      currentValue: 11000,
      previousValue: 10000,
    };

    const insight = generateInsight(trendData);

    expect(insight).toBeNull();
  });

  it("generates insight for exactly 20% change", () => {
    const trendData: TrendData = {
      type: "feeding",
      direction: "increase",
      absoluteChange: 4,
      percentageChange: 20,
      currentValue: 24,
      previousValue: 20,
    };

    const insight = generateInsight(trendData);

    expect(insight).not.toBeNull();
    expect(insight?.percentageChange).toBe(20);
  });
});

describe("generateInsights", () => {
  it("generates multiple insights from trend data array", () => {
    const trends: TrendData[] = [
      {
        type: "sleep",
        direction: "increase",
        absoluteChange: 3600,
        percentageChange: 25,
        currentValue: 18000,
        previousValue: 14400,
      },
      {
        type: "feeding",
        direction: "decrease",
        absoluteChange: -5,
        percentageChange: -25,
        currentValue: 15,
        previousValue: 20,
      },
    ];

    const insights = generateInsights(trends);

    expect(insights).toHaveLength(2);
    expect(insights[0].type).toBe("sleep");
    expect(insights[1].type).toBe("feeding");
  });

  it("filters out non-significant trends", () => {
    const trends: TrendData[] = [
      {
        type: "sleep",
        direction: "increase",
        absoluteChange: 3600,
        percentageChange: 25,
        currentValue: 18000,
        previousValue: 14400,
      },
      {
        type: "feeding",
        direction: "increase",
        absoluteChange: 2,
        percentageChange: 10,
        currentValue: 22,
        previousValue: 20,
      },
      {
        type: "diaper",
        direction: "stable",
        absoluteChange: 0,
        percentageChange: 0,
        currentValue: 40,
        previousValue: 40,
      },
    ];

    const insights = generateInsights(trends);

    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("sleep");
  });

  it("returns empty array when no significant trends", () => {
    const trends: TrendData[] = [
      {
        type: "sleep",
        direction: "stable",
        absoluteChange: 0,
        percentageChange: 0,
        currentValue: 14400,
        previousValue: 14400,
      },
    ];

    const insights = generateInsights(trends);

    expect(insights).toHaveLength(0);
  });

  it("handles empty trend array", () => {
    const insights = generateInsights([]);
    expect(insights).toHaveLength(0);
  });
});

describe("prioritizeInsights", () => {
  it("sorts insights by absolute percentage change (highest first)", () => {
    const insights: Insight[] = [
      {
        type: "feeding",
        direction: "increase",
        percentageChange: 25,
        messageKey: "insights.feedingIncrease",
        absoluteChange: 5,
        currentValue: 25,
        previousValue: 20,
      },
      {
        type: "sleep",
        direction: "increase",
        percentageChange: 50,
        messageKey: "insights.sleepIncrease",
        absoluteChange: 7200,
        currentValue: 21600,
        previousValue: 14400,
      },
      {
        type: "diaper",
        direction: "decrease",
        percentageChange: -35,
        messageKey: "insights.diaperDecrease",
        absoluteChange: -14,
        currentValue: 26,
        previousValue: 40,
      },
    ];

    const prioritized = prioritizeInsights(insights);

    expect(prioritized[0].type).toBe("sleep");
    expect(prioritized[0].percentageChange).toBe(50);
    expect(prioritized[1].type).toBe("diaper");
    expect(prioritized[1].percentageChange).toBe(-35);
    expect(prioritized[2].type).toBe("feeding");
    expect(prioritized[2].percentageChange).toBe(25);
  });

  it("limits to top N insights when specified", () => {
    const insights: Insight[] = [
      {
        type: "feeding",
        direction: "increase",
        percentageChange: 25,
        messageKey: "insights.feedingIncrease",
        absoluteChange: 5,
        currentValue: 25,
        previousValue: 20,
      },
      {
        type: "sleep",
        direction: "increase",
        percentageChange: 50,
        messageKey: "insights.sleepIncrease",
        absoluteChange: 7200,
        currentValue: 21600,
        previousValue: 14400,
      },
      {
        type: "diaper",
        direction: "decrease",
        percentageChange: -35,
        messageKey: "insights.diaperDecrease",
        absoluteChange: -14,
        currentValue: 26,
        previousValue: 40,
      },
    ];

    const prioritized = prioritizeInsights(insights, 2);

    expect(prioritized).toHaveLength(2);
    expect(prioritized[0].type).toBe("sleep");
    expect(prioritized[1].type).toBe("diaper");
  });

  it("handles empty array", () => {
    const prioritized = prioritizeInsights([]);
    expect(prioritized).toHaveLength(0);
  });

  it("returns all insights when limit exceeds array length", () => {
    const insights: Insight[] = [
      {
        type: "sleep",
        direction: "increase",
        percentageChange: 50,
        messageKey: "insights.sleepIncrease",
        absoluteChange: 7200,
        currentValue: 21600,
        previousValue: 14400,
      },
    ];

    const prioritized = prioritizeInsights(insights, 5);

    expect(prioritized).toHaveLength(1);
  });
});
